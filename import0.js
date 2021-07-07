import { init, parse }                              from 'cjs-module-lexer';
import { readFile, stat }                           from 'fs/promises';
import Module, { builtinModules, createRequire }    from 'module';
import { basename, dirname, extname, join }         from 'path';
import { fileURLToPath, pathToFileURL }             from 'url';
import { format }                                   from 'util';
import
{
    SourceTextModule,
    SyntheticModule,
    compileFunction,
    createContext,
}                                                   from 'vm';

const CREATE_FUNCTION_PARAMS    = ['exports', 'require', 'module', '__filename', '__dirname'];

const MAIN_FILE_BASE_NAMES      = ['index.js', 'index.json', 'index.node'];

const MAIN_FILE_POSTFIXES       =
['', '.js', '.json', '.node', '/index.js', '/index.json', '/index.node'];

const _Error_captureStackTrace  = Error.captureStackTrace;
const _JSON_parse               = JSON.parse;
const _Object_keys              = Object.keys;

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
            handleModuleNotFound(specifier, referencingModuleURL);
        if (!stats.isDirectory())
            return;
    }
    throwImportError
    (
        'ERR_UNSUPPORTED_DIR_IMPORT',
        'Directory import %s is not supported',
        specifier,
        referencingModuleURL,
    );
}

function createImportModuleDynamically()
{
    function getPackageConfig(packagePath, specifier, referencingModuleURL)
    {
        const packageConfigPromise =
        packageConfigCache[packagePath] ??
        (
            packageConfigCache[packagePath] =
            (async () =>
            {
                let text;
                const packageJSONPath = join(packagePath, 'package.json');
                try
                {
                    text = await readTextFile(packageJSONPath);
                }
                catch
                { }
                if (text != null)
                {
                    let json;
                    try
                    {
                        json = _JSON_parse(text);
                    }
                    catch
                    { }
                    if (json == null)
                    {
                        const messageFormat =
                        `Invalid package config "${packageJSONPath}" found while resolving %s`;
                        throwImportError
                        (
                            'ERR_INVALID_PACKAGE_CONFIG',
                            messageFormat,
                            specifier,
                            referencingModuleURL,
                        );
                    }
                    const { main, type } = json;
                    const isESModuleFlag = type === 'module';
                    const packageMain = typeof main === 'string' ? main : undefined;
                    const packageConfig = { isESModuleFlag, packageMain };
                    return packageConfig;
                }
            }
            )()
        );
        return packageConfigPromise;
    }

    async function importModuleDynamically(specifier, { context, identifier: referencingModuleURL })
    {
        let identifier;
        let moduleSupplier;
        specifier = `${specifier}`;
        const protocol = specifier.match(/^[a-z][+\-.0-9a-z]*:/i)?.[0];
        if (protocol === 'node:')
        {
            if (!builtinModules.includes(specifier.slice(5)))
            {
                throwImportError
                (
                    'ERR_UNKNOWN_BUILTIN_MODULE',
                    'Unknown builtin module %s',
                    specifier,
                    referencingModuleURL,
                );
            }
            identifier = specifier;
        }
        else if (builtinModules.includes(specifier))
            identifier = `node:${specifier}`;
        if (identifier)
        {
            moduleSupplier =
            async () =>
            {
                const namespace = await import(identifier);
                const module = createSyntheticBuiltinModule(namespace, { context, identifier });
                return module;
            };
        }
        else
        {
            let moduleURL;
            if (protocol === 'file:' || /^[./]/.test(specifier))
            {
                const match = specifier.match(/%(?:2f|5c)/i);
                if (match)
                {
                    const messageFormat = `Invalid encoded character "${match}" in %s`;
                    throwImportError
                    (
                        'ERR_INVALID_MODULE_SPECIFIER',
                        messageFormat,
                        specifier,
                        referencingModuleURL,
                    );
                }
                moduleURL = new URL(specifier, protocol ? undefined : referencingModuleURL);
            }
            else if (!protocol)
                moduleURL = await resolvePackageURL(specifier, referencingModuleURL);
            else
            {
                throwImportError
                (
                    'ERR_UNSUPPORTED_ESM_URL_SCHEME',
                    `Unsupported URL protocol "${protocol}" in %s`,
                    specifier,
                    referencingModuleURL,
                );
            }
            const modulePath = fileURLToPath(moduleURL);
            identifier = moduleURL.toString();
            moduleSupplier =
            async () =>
            {
                let module;
                await checkModulePath(modulePath, specifier, referencingModuleURL);
                const isESModuleFlag =
                await isESModule(modulePath, specifier, referencingModuleURL);
                const source = await readTextFile(modulePath);
                if (isESModuleFlag)
                {
                    module =
                    createSourceTextModule
                    (
                        source,
                        { context, identifier, importModuleDynamically, initializeImportMeta },
                    );
                }
                else
                {
                    const compiledWrapper =
                    compileFunction
                    (
                        source,
                        CREATE_FUNCTION_PARAMS,
                        { filename: modulePath, importModuleDynamically },
                    );
                    const { exports: exportNames } = parse(source);
                    module =
                    createSyntheticCJSModule
                    (modulePath, compiledWrapper, exportNames, { context, identifier });
                }
                return module;
            };
        }
        const modulePromise =
        moduleCache[identifier] ??
        (
            moduleCache[identifier] =
            (async () =>
            {
                const module = await moduleSupplier();
                await module.link(importModuleDynamically);
                await module.evaluate();
                return module;
            }
            )()
        );
        return modulePromise;
    }

    async function isESModule(modulePath, specifier, referencingModuleURL)
    {
        const extension = extname(modulePath);
        switch (extension)
        {
        case '.js':
            for (let packagePath = dirname(modulePath); ;)
            {
                if (basename(packagePath) === 'node_modules')
                    break;
                const packageConfig =
                await getPackageConfig(packagePath, specifier, referencingModuleURL);
                if (packageConfig)
                    return packageConfig.isESModuleFlag;
                const nextPackagePath = dirname(packagePath);
                if (nextPackagePath === packagePath)
                    break;
                packagePath = nextPackagePath;
            }
            return false;
        case '.mjs':
            return true;
        case '.cjs':
            return false;
        default:
        {
            const messageFormat =
            `Unrecognized file extension "${extension}" for "${modulePath}" found while ` +
            'resolving %s';
            throwImportError
            (
                'ERR_UNKNOWN_FILE_EXTENSION',
                messageFormat,
                specifier,
                referencingModuleURL,
                TypeError,
            );
        }
        }
    }

    async function resolvePackageURL(specifier, referencingModuleURL)
    {
        const match = specifier.match(/^([^@][^/]*|@[^/]+\/[^/]+)(?:\/(.*))?$/s);
        if (!match)
        {
            throwImportError
            (
                'ERR_INVALID_MODULE_SPECIFIER',
                'Invalid specifier %s',
                specifier,
                referencingModuleURL,
            );
        }
        const [, packageName, packageSubpath] = match;
        let modulePath;
        const packagePath = await findPackagePath(packageName, specifier, referencingModuleURL);
        if (packageSubpath == null)
        {
            const packageConfig =
            await getPackageConfig(packagePath, specifier, referencingModuleURL);
            modulePath = await findMainPath(packagePath, packageConfig?.packageMain);
            if (modulePath == null)
                handleModuleNotFound(specifier, referencingModuleURL);
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
                compiledWrapper.call(exports, exports, require, module, modulePath, __dirname);
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
        const nextPath = dirname(path);
        if (nextPath === path)
            break;
        path = nextPath;
    }
    handleModuleNotFound(specifier, referencingModuleURL);
}

function getCallerURL()
{
    const stackTrace = captureStackTrace(import0, 1);
    const match = stackTrace.match(/^Error\n    at (?:.*\((.*):\d+:\d+\)|(.*):\d+:\d+)$/);
    const fileName = match?.[1] ?? match?.[2];
    if (fileName == null)
    {
        throwNodeError
        ('ERR_UNSUPPORTED_CALL_SITE', 'import0 was invoked from an unsupported call site');
    }
    const url = fileName.startsWith('file:') ? fileName : pathToFileURL(fileName).toString();
    return url;
}

function handleModuleNotFound(specifier, referencingModuleURL)
{
    throwImportError
    ('ERR_MODULE_NOT_FOUND', 'Module %s not found', specifier, referencingModuleURL);
}

export default async function import0(specifier)
{
    const url = getCallerURL();
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

function throwImportError(code, messageFormat, specifier, referencingModuleURL, constructor)
{
    const referencedSpecifier = `"${specifier}" imported by ${referencingModuleURL}`;
    const message = format(messageFormat, referencedSpecifier);
    const additionalProps = { specifier, referencingModuleURL };
    throwNodeError(code, message, constructor, throwImportError, additionalProps);
}

function throwNodeError
(code, message, constructor = Error, constructorOpt = throwNodeError, additionalProps = null)
{
    const stackTrace = captureStackTrace(constructorOpt, Infinity);
    const error = constructor(message);
    Object.assign(error, additionalProps);
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

await init();
