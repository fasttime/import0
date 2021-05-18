import { init, parse }                              from 'cjs-module-lexer';
import { promises as fsPromises }                   from 'fs';
import Module, { builtinModules, createRequire }    from 'module';
import { extname, resolve }                         from 'path';
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
    if (!modulePath.endsWith('/'))
    {
        try
        {
            const stats = await stat(modulePath);
            if (!stats.isDirectory())
                return;
        }
        catch (error)
        {
            if (error.code === 'ENOENT')
            {
                const referencedSpecifier =
                formatReferencedSpecifier(specifier, referencingModuleURL);
                const message = `Module ${referencedSpecifier} not found`;
                throwNodeError('ERR_MODULE_NOT_FOUND', message);
            }
            throw error;
        }
    }
    {
        const referencedSpecifier = formatReferencedSpecifier(specifier, referencingModuleURL);
        const message = `Directory import ${referencedSpecifier} is not supported`;
        throwNodeError('ERR_UNSUPPORTED_DIR_IMPORT', message);
    }
}

const formatReferencedSpecifier =
(specifier, referencingModuleURL) => `"${specifier}" imported by ${referencingModuleURL}`;

function createImportModuleDynamically()
{
    async function getPackageESModuleFlag(packageJSONPath, specifier, referencingModuleURL)
    {
        let isESModuleFlag = isESModuleFlagCache[packageJSONPath];
        if (isESModuleFlag !== undefined)
            return isESModuleFlag;
        try
        {
            const text = await readTextFile(packageJSONPath);
            const { type } = _JSON_parse(text);
            isESModuleFlag = type === 'module';
        }
        catch (error)
        {
            if (error instanceof SyntaxError)
            {
                const referencedSpecifier =
                formatReferencedSpecifier(specifier, referencingModuleURL);
                const message =
                `Invalid package config "${packageJSONPath}" while resolving ` +
                `${referencedSpecifier}`;
                throwNodeError('ERR_INVALID_PACKAGE_CONFIG', message);
            }
            const { code } = error;
            if (code !== 'ENOENT' && code !== 'EISDIR')
                throw error;
            isESModuleFlag = null;
        }
        isESModuleFlagCache[packageJSONPath] = isESModuleFlag;
        return isESModuleFlag;
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
            const moduleURL =
            new URL(specifier, /^[./]/.test(specifier) ? referencingModuleURL : undefined);
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
                if (packageJSONPath.endsWith('node_modules/package.json'))
                    break;
                const isESModuleFlag =
                await getPackageESModuleFlag(packageJSONPath, specifier, referencingModuleURL);
                if (typeof isESModuleFlag === 'boolean')
                    return isESModuleFlag;
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

    const isESModuleFlagCache = { __proto__: null };
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
