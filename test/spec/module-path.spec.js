/* eslint-env ebdd/ebdd */

import assert               from 'assert/strict';
import { fileURLToPath }    from 'url';

const MODULE_IMPORTER_URL       = '../fixtures/module-importer.mjs';
const MODULE_IMPORTER_FULL_URL  = new URL(MODULE_IMPORTER_URL, import.meta.url).toString();

function makeExpectedError(code, specifier)
{
    const expectedError =
    { code, constructor: Error, specifier, referencingModuleURL: MODULE_IMPORTER_FULL_URL };
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
                await import0(url);
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
                await import0(url);
                assert.deepEqual(lastResolveModuleURLArgs, undefined);
            },
        );

        it
        (
            'relative path',
            async () =>
            {
                await import0('../fixtures/any.js');
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
                const { default: import_ } = await import0(MODULE_IMPORTER_URL);
                const specifier = 'any-package';
                await import_(specifier);
                assert.deepEqual(lastResolveModuleURLArgs, [specifier, MODULE_IMPORTER_FULL_URL]);
            },
        );

        it
        (
            'package with valid subpath',
            async () =>
            {
                const { default: import_ } = await import0(MODULE_IMPORTER_URL);
                const specifier = 'any-package/any-module.mjs';
                await import_(specifier);
                assert.deepEqual(lastResolveModuleURLArgs, [specifier, MODULE_IMPORTER_FULL_URL]);
            },
        );

        it
        (
            'package with subpath ""',
            async () =>
            {
                const specifier = 'any-package/';
                const { default: import_ } = await import0(MODULE_IMPORTER_URL);
                await
                assert.rejects
                (
                    () => import_(specifier),
                    makeExpectedError('ERR_UNSUPPORTED_DIR_IMPORT', specifier),
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
                const { default: import_ } = await import0(MODULE_IMPORTER_URL);
                await
                assert.rejects
                (
                    () => import_(specifier),
                    makeExpectedError('ERR_UNSUPPORTED_DIR_IMPORT', specifier),
                );
                assert.deepEqual(lastResolveModuleURLArgs, [specifier, MODULE_IMPORTER_FULL_URL]);
            },
        );

        it
        (
            'package with main',
            async () =>
            {
                const { default: import_ } = await import0(MODULE_IMPORTER_URL);
                const specifier = 'package-with-main';
                await import_(specifier);
                assert.deepEqual(lastResolveModuleURLArgs, [specifier, MODULE_IMPORTER_FULL_URL]);
            },
        );

        describe.per
        (
            [
                { type: 'exports', specifier: 'imports-exports' },
                { type: 'imports', specifier: '#test' },
            ],
        )
        (
            '#.type',
            ({ specifier }) =>
            {
                it.per
                (
                    [
                        {
                            importerType: 'CommonJS module',
                            importerURL: '../fixtures/imports-exports/module-importer.cjs',
                        },
                        {
                            importerType: 'ES module',
                            importerURL: '../fixtures/imports-exports/module-importer.mjs',
                        },
                    ],
                )
                (
                    'import mapping (from #.importerType)',
                    async ({ importerURL }) =>
                    {
                        const { default: import_ } = await import0(importerURL);
                        const { default: actual } = await import_(specifier);
                        assert.equal(actual, 'ES module');
                        const importerFullURL = new URL(importerURL, import.meta.url);
                        assert.deepEqual
                        (lastResolveModuleURLArgs, [specifier, importerFullURL.toString()]);
                    },
                );

                it
                (
                    'require mapping',
                    async () =>
                    {
                        const requirerURL =
                        new URL('../fixtures/imports-exports/module-requirer.cjs', import.meta.url);
                        const { default: require } = await import0(requirerURL);
                        const actual = require(specifier);
                        assert.equal(actual, 'CommonJS module');
                        assert.equal(lastResolveModuleURLArgs, undefined);
                    },
                );
            },
        );

        it
        (
            'package with missing main',
            async () =>
            {
                const { default: import_ } = await import0(MODULE_IMPORTER_URL);
                const specifier = 'package-with-missing-main';
                await
                assert.rejects
                (() => import_(specifier), { code: 'ERR_MODULE_NOT_FOUND', constructor: Error });
                assert.deepEqual(lastResolveModuleURLArgs, [specifier, MODULE_IMPORTER_FULL_URL]);
            },
        );

        it
        (
            'missing package',
            async () =>
            {
                const { default: import_ } = await import0(MODULE_IMPORTER_URL);
                const specifier = 'missing-package';
                await
                assert.rejects
                (() => import_(specifier), { code: 'ERR_MODULE_NOT_FOUND', constructor: Error });
                assert.deepEqual(lastResolveModuleURLArgs, [specifier, MODULE_IMPORTER_FULL_URL]);
            },
        );
    },
);
