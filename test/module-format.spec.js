/* eslint-env mocha */

import assert from 'assert';

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
                ({ default: import0 } = await import('../import0.js'));
            },
        );

        it
        (
            'file with extension ".cjs"',
            async () =>
            {
                const { default: actual } = await import0('./fixtures/cjs-module.cjs');
                assert.strictEqual(actual, 'CommonJS module');
            },
        );

        it
        (
            'file with extension ".mjs"',
            async () =>
            {
                const { default: actual } = await import0('./fixtures/es-module.mjs');
                assert.strictEqual(actual, 'ES module');
            },
        );

        it
        (
            'file with extension ".js" when the next "package.json" file has type commonjs',
            async () =>
            {
                const { default: actual } = await import0('./fixtures/cjs/module.js');
                assert.strictEqual(actual, 'CommonJS module');
            },
        );

        it
        (
            'file with extension ".js" when the next "package.json" file is inside "node_modules"',
            async () =>
            {
                const { default: actual } = await import0('./fixtures/node_modules/module.js');
                assert.strictEqual(actual, 'CommonJS module');
            },
        );

        it
        (
            'file with extension ".js" when the next "package.json" file has type module',
            async () =>
            {
                const { default: actual } = await import0('./fixtures/esm/module.js');
                assert.strictEqual(actual, 'ES module');
            },
        );

        it
        (
            'file with extension ".js" ignoring a "package.json" directory',
            async () =>
            {
                const { default: actual } =
                await import0('./fixtures/esm/dir-package-json/module.js');
                assert.strictEqual(actual, 'ES module');
            },
        );

        it
        (
            'unprefixed builtin specifier',
            async () =>
            {
                const { default: actual } = await import0('assert');
                assert.strictEqual(actual, assert);
            },
        );

        it
        (
            'builtin specifier prefixed with "node:"',
            async () =>
            {
                const { default: actual } = await import0('node:assert');
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
                { code: 'ERR_UNKNOWN_BUILTIN_MODULE', constructor: Error },
            ),
        );

        it
        (
            'directory with extension ".js"',
            () =>
            assert.rejects
            (
                () => import0('./fixtures/dir-any.js'),
                { code: 'ERR_UNSUPPORTED_DIR_IMPORT', constructor: Error },
            ),
        );

        it
        (
            'directory without extension',
            () =>
            assert.rejects
            (
                () => import0('.'),
                { code: 'ERR_UNSUPPORTED_DIR_IMPORT', constructor: Error },
            ),
        );

        it
        (
            'file with an unsupported extension',
            () =>
            assert.rejects
            (
                () => import0('./fixtures/cjs-capext-module.CJS'),
                { code: 'ERR_UNKNOWN_FILE_EXTENSION', constructor: TypeError },
            ),
        );

        it
        (
            'file with extension ".js" when the next "package.json" file is invalid',
            () =>
            assert.rejects
            (
                () => import0('./fixtures/invalid/any.js'),
                { code: 'ERR_INVALID_PACKAGE_CONFIG', constructor: Error },
            ),
        );

        it
        (
            'missing path with supported extension',
            () =>
            assert.rejects
            (
                () => import0('./fixtures/missing.js'),
                { code: 'ERR_MODULE_NOT_FOUND', constructor: Error },
            ),
        );

        it
        (
            'missing path with unsupported extension',
            () =>
            assert.rejects
            (
                () => import0('./fixtures/missing.png'),
                { code: 'ERR_MODULE_NOT_FOUND', constructor: Error },
            ),
        );

        it
        (
            'missing path with extension ".js" when the next "package.json" file is invalid',
            () =>
            assert.rejects
            (
                () => import0('./fixtures/invalid/missing.js'),
                { code: 'ERR_MODULE_NOT_FOUND', constructor: Error },
            ),
        );

        it
        (
            'path with trailing "/"',
            () =>
            assert.rejects
            (
                () => import0('./fixtures/dir-missing/'),
                { code: 'ERR_UNSUPPORTED_DIR_IMPORT', constructor: Error },
            ),
        );

        it
        (
            'path with trailing "\\"',
            () =>
            assert.rejects
            (
                () => import0('./fixtures/dir-missing\\'),
                { code: 'ERR_UNSUPPORTED_DIR_IMPORT', constructor: Error },
            ),
        );

        it
        (
            'inaccessible file',
            () =>
            assert.rejects
            (
                () => import0('/dev/null/any.js'),
                { code: 'ENOTDIR', constructor: Error },
            ),
        );
    },
);
