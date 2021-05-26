/* eslint-env ebdd/ebdd */

import assert from 'assert/strict';

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
                ({ default: import0 } = await import('../../import0.js'));
            },
        );

        it
        (
            'file with extension ".cjs"',
            async () =>
            {
                const { default: actual } = await import0('../fixtures/cjs-module.cjs');
                assert.strictEqual(actual, 'CommonJS module');
            },
        );

        it
        (
            'file with extension ".mjs"',
            async () =>
            {
                const { default: actual } = await import0('../fixtures/es-module.mjs');
                assert.strictEqual(actual, 'ES module');
            },
        );

        it
        (
            'file with extension ".js" when the next "package.json" file has type commonjs',
            async () =>
            {
                const { default: actual } = await import0('../fixtures/cjs/module.js');
                assert.strictEqual(actual, 'CommonJS module');
            },
        );

        it
        (
            'file with extension ".js" when the next "package.json" file is inside "node_modules"',
            async () =>
            {
                const { default: actual } = await import0('../fixtures/node_modules/module.js');
                assert.strictEqual(actual, 'CommonJS module');
            },
        );

        it
        (
            'file with extension ".js" when the next "package.json" file has type module',
            async () =>
            {
                const { default: actual } = await import0('../fixtures/esm/module.js');
                assert.strictEqual(actual, 'ES module');
            },
        );

        it
        (
            'file with extension ".js" ignoring a "package.json" directory',
            async () =>
            {
                const { default: actual } =
                await import0('../fixtures/esm/dir-package-json/module.js');
                assert.strictEqual(actual, 'ES module');
            },
        );

        it
        (
            'unprefixed builtin specifier',
            async () =>
            {
                const { default: actual } = await import0('assert/strict');
                assert.strictEqual(actual, assert);
            },
        );

        it
        (
            'builtin specifier prefixed with "node:"',
            async () =>
            {
                const { default: actual } = await import0('node:assert/strict');
                assert.strictEqual(actual, assert);
            },
        );

        it
        (
            'unknown specifier prefixed with "node:"',
            () =>
            assert.rejects
            (
                () => import0('node:missing'),
                makeExpectedError('ERR_UNKNOWN_BUILTIN_MODULE', 'node:missing'),
            ),
        );

        it
        (
            'directory with extension ".js"',
            () =>
            assert.rejects
            (
                () => import0('../fixtures/dir-any.js'),
                makeExpectedError('ERR_UNSUPPORTED_DIR_IMPORT', '../fixtures/dir-any.js'),
            ),
        );

        it
        (
            'directory without extension',
            () =>
            assert.rejects
            (
                () => import0('.'),
                makeExpectedError('ERR_UNSUPPORTED_DIR_IMPORT', '.'),
            ),
        );

        it
        (
            'file with an unsupported extension',
            () =>
            assert.rejects
            (
                () => import0('../fixtures/cjs-capext-module.CJS'),
                makeExpectedError
                ('ERR_UNKNOWN_FILE_EXTENSION', '../fixtures/cjs-capext-module.CJS', TypeError),
            ),
        );

        it
        (
            'file with extension ".js" when the next "package.json" file is invalid',
            () =>
            assert.rejects
            (
                () => import0('../fixtures/invalid-package-json-dir/any.js'),
                makeExpectedError
                ('ERR_INVALID_PACKAGE_CONFIG', '../fixtures/invalid-package-json-dir/any.js'),
            ),
        );

        // Node 16 fails with a TypeError instead.
        it
        (
            'file with extension ".js" when the next "package.json" file is null',
            () =>
            assert.rejects
            (
                () => import0('../fixtures/null-package-json-dir/any.js'),
                makeExpectedError
                ('ERR_INVALID_PACKAGE_CONFIG', '../fixtures/null-package-json-dir/any.js'),
            ),
        );

        it
        (
            'missing path with supported extension',
            () =>
            assert.rejects
            (
                () => import0('../fixtures/missing.js'),
                makeExpectedError('ERR_MODULE_NOT_FOUND', '../fixtures/missing.js'),
            ),
        );

        it
        (
            'missing path with unsupported extension',
            () =>
            assert.rejects
            (
                () => import0('../fixtures/missing.png'),
                makeExpectedError('ERR_MODULE_NOT_FOUND', '../fixtures/missing.png'),
            ),
        );

        it
        (
            'missing path with extension ".js" when the next "package.json" file is invalid',
            () =>
            assert.rejects
            (
                () => import0('../fixtures/invalid-package-json-dir/missing.js'),
                makeExpectedError
                ('ERR_MODULE_NOT_FOUND', '../fixtures/invalid-package-json-dir/missing.js'),
            ),
        );

        it
        (
            'path with trailing "/"',
            () =>
            assert.rejects
            (
                () => import0('../fixtures/dir-missing/'),
                makeExpectedError('ERR_UNSUPPORTED_DIR_IMPORT', '../fixtures/dir-missing/'),
            ),
        );

        it
        (
            'path with trailing "\\"',
            () =>
            assert.rejects
            (
                () => import0('../fixtures/dir-missing\\'),
                makeExpectedError('ERR_UNSUPPORTED_DIR_IMPORT', '../fixtures/dir-missing\\'),
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
    },
);
