import { init, parse }                              from 'cjs-module-lexer';
import { promises as fsPromises }                   from 'fs';
import Module, { builtinModules, createRequire }    from 'module';
import { dirname, extname, join, resolve }          from 'path';
import { fileURLToPath, pathToFileURL }             from 'url';
import
{
    SourceTextModule,
    SyntheticModule,
    compileFunction,
    createContext,
}                                                   from 'vm';

const CREATE_FUNCTION_PARAMS =
[
    'exports',
    'require',
    'module',
    '__filename',
    '__dirname',
];

const MAIN_FILE_BASE_NAMES = ['index.js', 'index.json', 'index.node'];

const MAIN_FILE_POSTFIXES =
['', '.js', '.json', '.node', '/index.js', '/index.json', '/index.node'];

const _Error_captureStackTrace  = Error.captureStackTrace;
const _JSON_parse               = JSON.parse;
const _Object_keys              = Object.keys;
const { readFile, stat }        = fsPromises;

function captureStackTrace(constructorOpt, stackTraceLimit)
{
    const targetObject = { };
    const originalStackTraceLimit = Error.stackTraceLimit;
    Error.stackTraceLimit = stackTraceLimit;
    _Error_captureStackTrace(targetObject, constructorOpt);
    Error.stackTraceLimit = originalStackTraceLimit;
    return targetObject.stack;
}

async function checkModulePath(modulePath, specifier, referencingModuleURL)
{
    if (!/[/\\]$/.test(modulePath))
    {
        const stats = await tryStat(modulePath);
        if (!stats)
        {
            const referencedSpecifier = formatReferencedSpecifier(specifier, referencingModuleURL);
            const message = `Module ${referencedSpecifier} not found`;
            throwNodeError('ERR_MODULE_NOT_FOUND', message);
        }
        if (!stats.isDirectory())
            return;
    }
    {
        const referencedSpecifier = formatReferencedSpecifier(specifier, referencingModuleURL);
        const message = `Directory import ${referencedSpecifier} is not supported`;
        throwNodeError('ERR_UNSUPPORTED_DIR_IMPORT', message);
    }
}

function createImportModuleDynamically()
{
    async function getPackageConfig(packageJSONPath, specifier, referencingModuleURL)
    {
        let packageConfig;
        if (packageJSONPath in packageConfigCache)
            packageConfig = packageConfigCache[packageJSONPath];
        else
        {
            let text;
            try
            {
                text = await readTextFile(packageJSONPath);
            }
            catch (error)
            {
                const { code } = error;
                if (code !== 'ENOENT' && code !== 'EISDIR')
                    throw error;
            }
            if (text != null)
            {
                let json;
                try
                {
                    json = _JSON_parse(text);
                }
                catch
                {
                    const referencedSpecifier =
                    formatReferencedSpecifier(specifier, referencingModuleURL);
                    const message =
                    `Invalid package config "${packageJSONPath}" while resolving ` +
                    `${referencedSpecifier}`;
                    throwNodeError('ERR_INVALID_PACKAGE_CONFIG', message);
                }
                const { main, type } = json ?? { };
                const isESModuleFlag = type === 'module';
                const packageMain = typeof main === 'string' ? main : undefined;
                packageConfig = { isESModuleFlag, packageMain };
            }
            packageConfigCache[packageJSONPath] = packageConfig;
        }
        return packageConfig;
    }

    async function importModuleDynamically(specifier, { context, identifier: referencingModuleURL })
    {
        let identifier;
        let module;
        specifier = String(specifier);
        if (specifier.startsWith('node:'))
            identifier = specifier;
        else if (builtinModules.includes(specifier))
            identifier = `node:${specifier}`;
        if (identifier)
        {
            module = moduleCache[identifier];
            if (module)
                return module;
            const namespace = await import(identifier);
            module = createSyntheticBuiltinModule(namespace, { context, identifier });
        }
        else
        {
            let moduleURL;
            if (/^(?:[./]|file:)/.test(specifier))
            {
                moduleURL =
                new URL(specifier, /^[./]/.test(specifier) ? referencingModuleURL : undefined);
            }
            else
                moduleURL = await resolvePackage(specifier, referencingModuleURL);
            const modulePath = fileURLToPath(moduleURL);
            identifier = moduleURL.toString();
            module = moduleCache[identifier];
            if (module)
                return module;
            await checkModulePath(modulePath, specifier, referencingModuleURL);
            const isESModuleFlag = await isESModule(modulePath, specifier, referencingModuleURL);
            const source = await readTextFile(modulePath);
            if (isESModuleFlag)
            {
                module =
                createSourceTextModule
                (source, { context, identifier, importModuleDynamically, initializeImportMeta });
            }
            else
            {
                const compiledWrapper =
                compileFunction
                (source, CREATE_FUNCTION_PARAMS, { filename: modulePath, importModuleDynamically });
                const { exports: exportNames } = parse(source);
                module =
                createSyntheticCJSModule
                (modulePath, compiledWrapper, exportNames, { context, identifier });
            }
        }
        moduleCache[identifier] = module;
        await module.link(importModuleDynamically);
        await module.evaluate();
        return module;
    }

    async function isESModule(modulePath, specifier, referencingModuleURL)
    {
        const extension = extname(modulePath);
        switch (extension)
        {
        case '.js':
            for (let packageJSONPath = resolve(modulePath, '../package.json'); ;)
            {
                if (/[/\\]node_modules[/\\]package\.json$/.test(packageJSONPath))
                    break;
                const packageConfig =
                await getPackageConfig(packageJSONPath, specifier, referencingModuleURL);
                if (packageConfig)
                    return packageConfig.isESModuleFlag;
                const nextPackageJSONPath = resolve(packageJSONPath, '../../package.json');
                if (nextPackageJSONPath === packageJSONPath)
                    break;
                packageJSONPath = nextPackageJSONPath;
            }
            return false;
        case '.mjs':
            return true;
        case '.cjs':
            return false;
        default:
        {
            const referencedSpecifier = formatReferencedSpecifier(specifier, referencingModuleURL);
            const message = `Unrecognized file extension "${extension}" for ${referencedSpecifier}`;
            throwNodeError('ERR_UNKNOWN_FILE_EXTENSION', message, TypeError);
        }
        }
    }

    async function resolvePackage(specifier, referencingModuleURL)
    {
        const [, packageName, packageSubpath] =
        specifier.match(/^([^@][^/]*|@[^/]+\/[^/]+)(?:\/(.*))?$/s);
        let modulePath;
        const packagePath = await findPackagePath(packageName, specifier, referencingModuleURL);
        if (!packageSubpath || packageSubpath === '.')
        {
            const packageJSONPath = join(packagePath, 'package.json');
            const packageConfig =
            await getPackageConfig(packageJSONPath, specifier, referencingModuleURL);
            modulePath = await findMainPath(packagePath, packageConfig?.packageMain);
            if (modulePath == null)
            {
                const referencedSpecifier =
                formatReferencedSpecifier(specifier, referencingModuleURL);
                const message = `Module ${referencedSpecifier} not found`;
                throwNodeError('ERR_MODULE_NOT_FOUND', message);
            }
        }
        else
            modulePath = join(packagePath, packageSubpath);
        const moduleURL = pathToFileURL(modulePath);
        return moduleURL;
    }

    const packageConfigCache = { __proto__: null };
    const moduleCache = { __proto__: null };
    return importModuleDynamically;
}

function createSourceTextModule(source, options)
{
    const module = wrapModuleConstructor(SourceTextModule, source, options);
    return module;
}

function createSyntheticBuiltinModule(namespace, options)
{
    const exportNames = _Object_keys(namespace);
    const module =
    wrapModuleConstructor
    (
        SyntheticModule,
        exportNames,
        function ()
        {
            for (const exportName of exportNames)
            {
                const exportValue = namespace[exportName];
                this.setExport(exportName, exportValue);
            }
        },
        options,
    );
    return module;
}

function createSyntheticCJSModule(modulePath, compiledWrapper, exportNames, options)
{
    const allExportNames =
    exportNames.includes('default') ? exportNames : [...exportNames, 'default'];
    const module =
    wrapModuleConstructor
    (
        SyntheticModule,
        allExportNames,
        function ()
        {
            const module = new Module(modulePath);
            {
                const { exports, path: __dirname } = module;
                const require = createRequire(modulePath);
                compiledWrapper.call
                (
                    exports,
                    exports,
                    require,
                    module,
                    modulePath,
                    __dirname,
                );
            }
            const { exports } = module;
            for (const exportName of exportNames)
            {
                const exportValue = exports[exportName];
                this.setExport(exportName, exportValue);
            }
            this.setExport('default', exports);
        },
        options,
    );
    return module;
}

async function fileExists(path)
{
    const stats = await tryStat(path);
    const result = stats != null && stats.isFile();
    return result;
}

async function findMainPath(packagePath, packageMain)
{
    if (packageMain !== undefined)
    {
        for (const postfix of MAIN_FILE_POSTFIXES)
        {
            const baseName = `${packageMain}${postfix}`;
            const guess = join(packagePath, baseName);
            if (await fileExists(guess))
                return guess;
        }
    }
    for (const baseName of MAIN_FILE_BASE_NAMES)
    {
        const guess = join(packagePath, baseName);
        if (await fileExists(guess))
            return guess;
    }
}

async function findPackagePath(packageName, specifier, referencingModuleURL)
{
    for (let path = fileURLToPath(new URL('.', referencingModuleURL)); ;)
    {
        const packagePath = join(path, 'node_modules', packageName);
        const stats = await tryStat(packagePath);
        if (stats?.isDirectory())
            return packagePath;
        const newPath = dirname(path);
        if (newPath === path)
        {
            const referencedSpecifier = formatReferencedSpecifier(specifier, referencingModuleURL);
            const message = `Module ${referencedSpecifier} not found`;
            throwNodeError('ERR_MODULE_NOT_FOUND', message);
        }
        path = newPath;
    }
}

const formatReferencedSpecifier =
(specifier, referencingModuleURL) => `"${specifier}" imported by ${referencingModuleURL}`;

function getCallerFileName()
{
    const stackTrace = captureStackTrace(import0, 1);
    const match = stackTrace.match(/^Error\n    at (?:.*\((.*):\d+:\d+\)|(.*):\d+:\d+)$/);
    if (!match)
        return;
    const fileName = match[1] ?? match[2];
    return fileName;
}

export default async function import0(specifier)
{
    const callerFileName = getCallerFileName();
    if (callerFileName == null)
    {
        throwNodeError
        ('ERR_UNSUPPORTED_CALL_SITE', 'import0 was invoked from an unsupported call site');
    }
    const url =
    callerFileName.startsWith('file:') ? callerFileName : pathToFileURL(callerFileName);
    const importModuleDynamically = createImportModuleDynamically();
    const context = createContext();
    const { namespace } = await importModuleDynamically(specifier, { context, identifier: url });
    return namespace;
}

function initializeImportMeta(meta, module)
{
    meta.url = module.identifier;
}

function noop()
{ }

const readTextFile = path => readFile(path, 'utf-8');

function throwNodeError(code, message, constructor = Error)
{
    const stackTrace = captureStackTrace(throwNodeError, Infinity);
    const error = constructor(message);
    error.code = code;
    error.stack = stackTrace.replace(/^Error\n/, `${constructor.name} [${code}]: ${message}\n`);
    throw error;
}

async function tryStat(path)
{
    try
    {
        const stats = await stat(path);
        return stats;
    }
    catch (error)
    {
        if (error.code !== 'ENOENT')
            throw error;
    }
}

function wrapModuleConstructor(constructor, ...args)
{
    process.emitWarning = noop;
    try
    {
        const module = new constructor(...args);
        return module;
    }
    finally
    {
        delete process.emitWarning;
    }
}

init();
