/* eslint-env ebdd/ebdd */

import { toDataURL }    from '../utils.js';
import assert           from 'assert/strict';
import { extname }      from 'path';

const IMPORT_0_PATH = '#import0';

function makeExpectedError(code, specifier, constructor = Error)
{
    const expectedError = { code, constructor, specifier, referencingModuleURL: import.meta.url };
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
            'data URL specifier',
            async () =>
            {
                const expected = 'ES module';
                const url = toDataURL(`export default ${JSON.stringify(expected)};\n`);
                const { default: actual } = await import0(url);
                assert.equal(actual, expected);
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
                (() => import0('.'), makeExpectedError('ERR_UNSUPPORTED_DIR_IMPORT', specifier));
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
                    { code: 'ERR_INVALID_PACKAGE_CONFIG', constructor: Error },
                );
            },
        );

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
                    {
                        constructor: TypeError,
                        message:
                        'Cannot destructure property \'imports\' of \'packageJSON\' as it is null.',
                    },
                );
            },
        );

        it.per
        (
            [
                {
                    description: 'supported extension',
                    specifier: '../fixtures/missing.js',
                },
                {
                    description: 'unsupported extension',
                    specifier: '../fixtures/missing.png',
                },
                {
                    description: 'extension ".js" when the next "package.json" file is invalid',
                    specifier: '../fixtures/invalid-package-json-dir/missing.js',
                },
            ],
        )
        (
            'missing path with #.description',
            ({ specifier }) =>
            assert.rejects
            (() => import0(specifier), { code: 'ERR_MODULE_NOT_FOUND', constructor: Error }),
        );

        it.per(['/', '\\'])
        (
            'path with trailing "#"',
            async separator =>
            {
                const specifier = `../fixtures/missing-dir${separator}`;
                const expectedError =
                process.platform === 'win32' ?
                { code: 'ERR_MODULE_NOT_FOUND', constructor: Error } :
                makeExpectedError('ERR_UNSUPPORTED_DIR_IMPORT', specifier);
                await assert.rejects(() => import0(specifier), expectedError);
            },
        );

        it.per
        (
            [
                { description: 'HTTP', specifier: 'http://example.com' },
                {
                    description: 'blob',
                    specifier: 'blob:nodedata:00000000-0000-0000-0000-000000000000',
                },
            ],
        )
        (
            'unsupported #.description URL',
            ({ specifier }) =>
            assert.rejects
            (
                () => import0(specifier),
                { code: 'ERR_UNSUPPORTED_ESM_URL_SCHEME', constructor: Error },
            ),
        );

        // Node 17 treats an empty string as a valid specifier.
        it
        (
            'empty path',
            () =>
            assert.rejects(() => import0(''), { code: 'ERR_MODULE_NOT_FOUND', constructor: Error }),
        );

        it.per
        (
            [
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
                { code: 'ERR_INVALID_MODULE_SPECIFIER', constructor: TypeError },
            ),
        );

        it.when(process.platform !== 'win32')
        (
            'inaccessible file (POSIX)',
            () =>
            assert.rejects
            (() => import0('/dev/null/any.js'), { code: 'ENOTDIR', constructor: Error }),
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
            (() => import0('../fixtures/self-link.js'), { code: 'ELOOP', constructor: Error }),
        );
    },
);
