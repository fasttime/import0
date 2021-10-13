import { init, parse }                              from 'cjs-module-lexer';
import { randomUUID }                               from 'crypto';
import { readFile, stat }                           from 'fs/promises';
import Module, { builtinModules, createRequire }    from 'module';
import { basename, dirname, extname, join }         from 'path';
import { fileURLToPath, pathToFileURL }             from 'url';
import { format }                                   from 'util';

import { SourceTextModule, SyntheticModule, compileFunction, createContext }
from 'vm';

const CREATE_FUNCTION_PARAMS    = ['exports', 'require', 'module', '__filename', '__dirname'];

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

function createImportMetaResolve(defaultParentURL)
{
    const resolve =
    async (specifier, referencingModuleURL = defaultParentURL) =>
    // eslint-disable-next-line no-return-await
    await resolveModuleURL(specifier, referencingModuleURL);
    return resolve;
}

function createImportModuleDynamically()
{
    async function getIsESModuleFlagSupplier(packagePath)
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
                return null;
            const { type } = json;
            const isESModuleFlag = type === 'module';
            return isESModuleFlag;
        }
    }

    async function importModuleDynamically(specifier, { context, identifier: referencingModuleURL })
    {
        async function getIsESModuleFlag(packagePath)
        {
            const isESModuleFlagPromise =
            isESModuleFlagCache[packagePath] ??
            (isESModuleFlagCache[packagePath] = getIsESModuleFlagSupplier(packagePath));
            const isESModuleFlag = await isESModuleFlagPromise;
            if (isESModuleFlag === null)
                throwPackageConfigError(packagePath, specifier, referencingModuleURL);
            return isESModuleFlag;
        }

        async function getPackageScopeIsESModuleFlag(packagePath)
        {
            while (basename(packagePath) !== 'node_modules')
            {
                const isESModuleFlag = await getIsESModuleFlag(packagePath);
                if (isESModuleFlag != null)
                    return isESModuleFlag;
                const nextPackagePath = dirname(packagePath);
                if (nextPackagePath === packagePath)
                    break;
                packagePath = nextPackagePath;
            }
        }

        async function isESModule(modulePath)
        {
            const extension = extname(modulePath);
            switch (extension)
            {
            case '.js':
            {
                const packagePath = dirname(modulePath);
                const isESModuleFlag = await getPackageScopeIsESModuleFlag(packagePath) ?? false;
                return isESModuleFlag;
            }
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

        {
            let identifier;
            let moduleSupplier;
            specifier = `${specifier}`;
            const protocol = specifier.match(/^[a-z][+\-.0-9a-z]*:/i)?.[0];
            if (protocol === 'data:')
                identifier = specifier;
            else if (protocol === 'node:')
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
                    const module =
                    createSyntheticESModule
                    (
                        namespace,
                        { context, identifier, importModuleDynamically, initializeImportMeta },
                    );
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
                {
                    const match =
                    specifier.match(/^([^%@\\][^%/\\]*|@[^%/\\]+\/[^%/\\]+)(?:\/(.*))?$/s);
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
                    moduleURL = await resolveModuleURL(specifier, referencingModuleURL);
                }
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
                identifier = moduleURL.toString();
                const modulePath = fileURLToPath(moduleURL);
                moduleSupplier =
                async () =>
                {
                    let module;
                    await checkModulePath(modulePath, specifier, referencingModuleURL);
                    const isESModuleFlag = await isESModule(modulePath);
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
                        compiledWrapper.context     = context;
                        compiledWrapper.identifier  = identifier;
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
    }

    const isESModuleFlagCache = { __proto__: null };
    const moduleCache = { __proto__: null };
    return importModuleDynamically;
}

function createSourceTextModule(source, options)
{
    // Required to disable importModuleDynamically caching.
    // See https://github.com/nodejs/node/issues/36351
    source += `\n// Added by import0: ${randomUUID()}`;
    const module = wrapModuleConstructor(SourceTextModule, source, options);
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

function createSyntheticESModule(namespace, options)
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
    const url = module.identifier;
    meta.url = url;
    meta.resolve = createImportMetaResolve(url);
}

function noop()
{ }

let readTextFile = path => readFile(path, 'utf-8');

let resolveModuleURL = import.meta.resolve;

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

function throwPackageConfigError(packagePath, specifier, referencingModuleURL)
{
    const packageJSONPath = join(packagePath, 'package.json');
    const messageFormat =
    `Invalid package configuration file "${packageJSONPath}" found while resolving %s`;
    throwImportError('ERR_INVALID_PACKAGE_CONFIG', messageFormat, specifier, referencingModuleURL);
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

export function setReadTextFile(newReadTextFile)
{
    const oldReadTextFile = readTextFile;
    readTextFile = newReadTextFile;
    return oldReadTextFile;
}

export function setResolveModuleURL(newResolveModuleURL)
{
    const oldResolveModuleURL = resolveModuleURL;
    resolveModuleURL = newResolveModuleURL;
    return oldResolveModuleURL;
}
