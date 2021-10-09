/* eslint-env ebdd/ebdd */

import assert                           from 'assert/strict';
import { dirname, resolve }             from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const MODULE_IMPORTER_URL       = '../fixtures/module-importer.mjs';
const MODULE_IMPORTER_FULL_URL  = new URL(MODULE_IMPORTER_URL, import.meta.url).toString();

function makeExpectedError(code, specifier, referencingModulePath)
{
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const path = resolve(__dirname, referencingModulePath);
    const referencingModuleURL = pathToFileURL(path).toString();
    const expectedError = { code, constructor: Error, specifier, referencingModuleURL };
    return expectedError;
}

describe
(
    'Module path resolution',
    () =>
    {
        function resolveModuleURL(...args)
        {
            lastResolveModuleURLArgs = args;
            const promise = originalResolveModuleURL(...args);
            return promise;
        }

        let import0;
        let setResolveModuleURL;

        before
        (
            async () =>
            {
                ({ default: import0, setResolveModuleURL } = await import('import0'));
            },
        );

        let lastResolveModuleURLArgs;
        let originalResolveModuleURL;

        beforeEach
        (
            () =>
            {
                originalResolveModuleURL = setResolveModuleURL(resolveModuleURL);
            },
        );

        afterEach
        (
            () =>
            {
                setResolveModuleURL(originalResolveModuleURL);
                originalResolveModuleURL = undefined;
                lastResolveModuleURLArgs = undefined;
            },
        );

        it
        (
            'file URL',
            async () =>
            {
                const url = new URL('../fixtures/any.js', import.meta.url);
                await assert.doesNotReject(() => import0(url));
                assert.deepEqual(lastResolveModuleURLArgs, undefined);
            },
        );

        it
        (
            'file URL without "///" after "file:"',
            async () =>
            {
                let url = new URL('../fixtures/any.js', import.meta.url);
                url = url.toString().replace(/^file:\/\/\//, 'file:');
                await assert.doesNotReject(() => import0(url));
                assert.deepEqual(lastResolveModuleURLArgs, undefined);
            },
        );

        it
        (
            'relative path',
            async () =>
            {
                await assert.doesNotReject(() => import0('../fixtures/any.js'));
                assert.deepEqual(lastResolveModuleURLArgs, undefined);
            },
        );

        it.when(process.platform !== 'win32')
        (
            'absolute path',
            async () =>
            {
                const url = new URL('../fixtures/any.js', import.meta.url);
                const path = fileURLToPath(url);
                await assert.doesNotReject(() => import0(path));
                assert.deepEqual(lastResolveModuleURLArgs, undefined);
            },
        );

        it
        (
            'package without subpath',
            async () =>
            {
                const { default: importer } = await import0(MODULE_IMPORTER_URL);
                const specifier = 'any-package';
                await assert.doesNotReject(() => importer(specifier));
                assert.deepEqual(lastResolveModuleURLArgs, [specifier, MODULE_IMPORTER_FULL_URL]);
            },
        );

        it
        (
            'package with valid subpath',
            async () =>
            {
                const { default: importer } = await import0(MODULE_IMPORTER_URL);
                const specifier = 'any-package/any-module.mjs';
                await assert.doesNotReject(() => importer(specifier));
                assert.deepEqual(lastResolveModuleURLArgs, [specifier, MODULE_IMPORTER_FULL_URL]);
            },
        );

        it
        (
            'package with subpath ""',
            async () =>
            {
                const specifier = 'any-package/';
                const { default: importer } = await import0(MODULE_IMPORTER_URL);
                await
                assert.rejects
                (
                    () => importer(specifier),
                    makeExpectedError('ERR_UNSUPPORTED_DIR_IMPORT', specifier, MODULE_IMPORTER_URL),
                );
                assert.deepEqual(lastResolveModuleURLArgs, [specifier, MODULE_IMPORTER_FULL_URL]);
            },
        );

        it
        (
            'package with subpath "."',
            async () =>
            {
                const specifier = 'any-package/.';
                const { default: importer } = await import0(MODULE_IMPORTER_URL);
                await
                assert.rejects
                (
                    () => importer(specifier),
                    makeExpectedError('ERR_UNSUPPORTED_DIR_IMPORT', specifier, MODULE_IMPORTER_URL),
                );
                assert.deepEqual(lastResolveModuleURLArgs, [specifier, MODULE_IMPORTER_FULL_URL]);
            },
        );

        it
        (
            'package with main',
            async () =>
            {
                const { default: importer } = await import0(MODULE_IMPORTER_URL);
                const specifier = 'package-with-main';
                await assert.doesNotReject(() => importer(specifier));
                assert.deepEqual(lastResolveModuleURLArgs, [specifier, MODULE_IMPORTER_FULL_URL]);
            },
        );

        it
        (
            'package with missing main',
            async () =>
            {
                const specifier = 'package-with-missing-main';
                const { default: importer } = await import0(MODULE_IMPORTER_URL);
                await
                assert.rejects
                (() => importer(specifier), { code: 'ERR_MODULE_NOT_FOUND', constructor: Error });
                assert.deepEqual(lastResolveModuleURLArgs, [specifier, MODULE_IMPORTER_FULL_URL]);
            },
        );

        it
        (
            'missing package',
            async () =>
            {
                const specifier = 'missing-package';
                const { default: importer } = await import0(MODULE_IMPORTER_URL);
                await
                assert.rejects
                (() => importer(specifier), { code: 'ERR_MODULE_NOT_FOUND', constructor: Error });
                assert.deepEqual(lastResolveModuleURLArgs, [specifier, MODULE_IMPORTER_FULL_URL]);
            },
        );
    },
);
