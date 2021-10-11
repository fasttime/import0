/* eslint-env ebdd/ebdd */

import assert       from 'assert/strict';
import { extname }  from 'path';

const IMPORT_0_PATH = 'import0';

function makeExpectedError(code, specifier, constructor = Error)
{
    const expectedError =
    {
        code,
        constructor,
        specifier,
        referencingModuleURL: import.meta.url,
    };
    return expectedError;
}

describe
(
    'Module format detection',
    () =>
    {
        let import0;

        before
        (
            async () =>
            {
                ({ default: import0 } = await import(IMPORT_0_PATH));
            },
        );

        it
        (
            'file with extension ".cjs"',
            async () =>
            {
                const { default: actual } = await import0('../fixtures/cjs-module.cjs');
                assert.equal(actual, 'CommonJS module');
            },
        );

        it
        (
            'file with extension ".mjs"',
            async () =>
            {
                const { default: actual } = await import0('../fixtures/es-module.mjs');
                assert.equal(actual, 'ES module');
            },
        );

        it
        (
            'file with extension ".js" when the next "package.json" file has type commonjs',
            async () =>
            {
                const { default: actual } = await import0('../fixtures/cjs/module.js');
                assert.equal(actual, 'CommonJS module');
            },
        );

        it
        (
            'file with extension ".js" when the next "package.json" file is inside "node_modules"',
            async () =>
            {
                const { default: actual } = await import0('../fixtures/node_modules/module.js');
                assert.equal(actual, 'CommonJS module');
            },
        );

        it
        (
            'file with extension ".js" when the next "package.json" file has type module',
            async () =>
            {
                const { default: actual } = await import0('../fixtures/esm/module.js');
                assert.equal(actual, 'ES module');
            },
        );

        it
        (
            'file with extension ".js" ignoring a "package.json" directory',
            async () =>
            {
                const { default: actual } =
                await import0('../fixtures/dir-package-json-dir/module.js');
                assert.equal(actual, 'ES module');
            },
        );

        it
        (
            'file with extension ".js" ignoring a self-targeting "package.json" link',
            async () =>
            {
                const { default: actual } =
                await import0('../fixtures/self-link-package-json-dir/module.js');
                assert.equal(actual, 'ES module');
            },
        );

        it
        (
            'file with extension ".js" when no "package.json" exists',
            async () =>
            {
                const { setReadTextFile } = await import(IMPORT_0_PATH);
                const readTextFile =
                path =>
                {
                    if (extname(path) !== '.json')
                    {
                        const promise = originalReadTextFile(path);
                        return promise;
                    }
                };
                const originalReadTextFile = setReadTextFile(readTextFile);
                try
                {
                    const { default: actual } = await import0('../fixtures/cjs-module.js');
                    assert.equal(actual, 'CommonJS module');
                }
                finally
                {
                    setReadTextFile(originalReadTextFile);
                }
            },
        );

        it
        (
            'unprefixed builtin specifier',
            async () =>
            {
                const { default: actual } = await import0('assert/strict');
                assert.equal(actual, assert);
            },
        );

        it
        (
            'builtin specifier prefixed with "node:"',
            async () =>
            {
                const { default: actual } = await import0('node:assert/strict');
                assert.equal(actual, assert);
            },
        );

        it
        (
            'unknown specifier prefixed with "node:"',
            async () =>
            {
                const specifier = 'node:missing';
                await
                assert.rejects
                (
                    () => import0(specifier),
                    makeExpectedError('ERR_UNKNOWN_BUILTIN_MODULE', specifier),
                );
            },
        );

        it
        (
            'directory with extension ".js"',
            async () =>
            {
                const specifier = '../fixtures/dir-any.js';
                await
                assert.rejects
                (
                    () => import0(specifier),
                    makeExpectedError('ERR_UNSUPPORTED_DIR_IMPORT', specifier),
                );
            },
        );

        it
        (
            'directory without extension',
            async () =>
            {
                const specifier = '.';
                await
                assert.rejects
                (
                    () => import0('.'),
                    makeExpectedError('ERR_UNSUPPORTED_DIR_IMPORT', specifier),
                );
            },
        );

        it
        (
            'file with an unsupported extension',
            async () =>
            {
                const specifier = '../fixtures/cjs-capext-module.CJS';
                await
                assert.rejects
                (
                    () => import0(specifier),
                    makeExpectedError('ERR_UNKNOWN_FILE_EXTENSION', specifier, TypeError),
                );
            },
        );

        it
        (
            'file with extension ".js" when the next "package.json" file is invalid',
            async () =>
            {
                const specifier = '../fixtures/invalid-package-json-dir/any.js';
                await
                assert.rejects
                (
                    () => import0(specifier),
                    makeExpectedError('ERR_INVALID_PACKAGE_CONFIG', specifier),
                );
            },
        );

        // Node 16 fails with a TypeError instead.
        it
        (
            'file with extension ".js" when the next "package.json" file is null',
            async () =>
            {
                const specifier = '../fixtures/null-package-json-dir/any.js';
                await
                assert.rejects
                (
                    () => import0(specifier),
                    makeExpectedError('ERR_INVALID_PACKAGE_CONFIG', specifier),
                );
            },
        );

        it
        (
            'missing path with supported extension',
            async () =>
            {
                const specifier = '../fixtures/missing.js';
                await
                assert.rejects
                (
                    () => import0(specifier),
                    makeExpectedError('ERR_MODULE_NOT_FOUND', specifier),
                );
            },
        );

        it
        (
            'missing path with unsupported extension',
            async () =>
            {
                const specifier = '../fixtures/missing.png';
                await
                assert.rejects
                (
                    () => import0(specifier),
                    makeExpectedError('ERR_MODULE_NOT_FOUND', specifier),
                );
            },
        );

        it
        (
            'missing path with extension ".js" when the next "package.json" file is invalid',
            async () =>
            {
                const specifier = '../fixtures/invalid-package-json-dir/missing.js';
                await
                assert.rejects
                (
                    () => import0(specifier),
                    makeExpectedError('ERR_MODULE_NOT_FOUND', specifier),
                );
            },
        );

        it.per(['/', '\\'])
        (
            'path with trailing #',
            async separator =>
            {
                const specifier = `../fixtures/missing-dir${separator}`;
                await
                assert.rejects
                (
                    () => import0(specifier),
                    makeExpectedError('ERR_UNSUPPORTED_DIR_IMPORT', specifier),
                );
            },
        );

        it
        (
            'unsupported URL',
            async () =>
            {
                const specifier = 'https://example.com';
                await
                assert.rejects
                (
                    () => import0(specifier),
                    makeExpectedError('ERR_UNSUPPORTED_ESM_URL_SCHEME', specifier),
                );
            },
        );

        // Node 16 treats an empty string as a valid specifier and is inconsistent in forbidding
        // encoded backslashes.
        it.per
        (
            [
                { specifier: '', description: '""' },
                { specifier: '@#$%', description: 'starting with "@"' },
                { specifier: 'foo\\bar', description: 'containing a "\\" in the package name' },
                { specifier: 'foo%bar', description: 'containing a "%" in the package name' },
                { specifier: 'file:%2f', description: 'containing an encoded "/"' },
                { specifier: 'file:%5C', description: 'containing an encoded "\\"' },
            ],
        )
        (
            'invalid module specifier #.description',
            ({ specifier }) =>
            assert.rejects
            (
                () => import0(specifier),
                makeExpectedError('ERR_INVALID_MODULE_SPECIFIER', specifier),
            ),
        );

        it.when(process.platform !== 'win32')
        (
            'inaccessible file (POSIX)',
            () =>
            assert.rejects
            (
                () => import0('/dev/null/any.js'),
                { code: 'ENOTDIR', constructor: Error },
            ),
        );

        it.when(process.platform === 'win32')
        (
            'inaccessible file (Windows)',
            () =>
            assert.rejects
            (
                () => import0('file:///C:/System%20Volume%20Information'),
                { code: 'EPERM', constructor: Error },
            ),
        );

        it
        (
            'self-targeting link',
            () =>
            assert.rejects
            (
                () => import0('../fixtures/self-link.js'),
                { code: 'ELOOP', constructor: Error },
            ),
        );
    },
);
