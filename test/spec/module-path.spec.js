/* eslint-env ebdd/ebdd */

import assert                           from 'assert/strict';
import { dirname, resolve }             from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

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
        let import0;

        before
        (
            async () =>
            {
                ({ default: import0 } = await import('../../import0.js'));
            },
        );

        it
        (
            'file URL object',
            async () =>
            {
                const url = new URL('../fixtures/any.js', import.meta.url);
                await assert.doesNotReject(() => import0(url));
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
            },
        );

        it
        (
            'relative path',
            () => assert.doesNotReject(() => import0('../fixtures/any.js')),
        );

        it.when(process.platform !== 'win32')
        (
            'absolute path',
            async () =>
            {
                const url = new URL('../fixtures/any.js', import.meta.url);
                const path = fileURLToPath(url);
                await assert.doesNotReject(() => import0(path));
            },
        );

        it
        (
            'package without subpath',
            () =>
            assert.doesNotReject
            (() => import0('../fixtures/any-package-importer-without-subpath.mjs')),
        );

        it
        (
            'package with subpath',
            () =>
            assert.doesNotReject
            (() => import0('../fixtures/any-package-importer-with-subpath.mjs')),
        );

        it
        (
            'package with main',
            () =>
            assert.doesNotReject
            (() => import0('../fixtures/package-with-main-importer.mjs')),
        );

        it
        (
            'package with missing main',
            () => assert.rejects
            (
                () => import0('../fixtures/package-with-missing-main-importer.mjs'),
                makeExpectedError
                (
                    'ERR_MODULE_NOT_FOUND',
                    'package-with-missing-main',
                    '../fixtures/package-with-missing-main-importer.mjs',
                ),
            ),
        );

        it
        (
            'missing package',
            () => assert.rejects
            (
                () => import0('../fixtures/missing-package-importer.mjs'),
                makeExpectedError
                (
                    'ERR_MODULE_NOT_FOUND',
                    'missing-package',
                    '../fixtures/missing-package-importer.mjs',
                ),
            ),
        );
    },
);
