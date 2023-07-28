import { toDataURL }    from '../utils.js';
import assert           from 'node:assert/strict';
import { extname }      from 'node:path';
import test             from 'node:test';

const IMPORT_0_PATH = '#import0';

function makeExpectedError(code, specifier, constructor = Error)
{
    const expectedError = { code, constructor, specifier, referencingModuleURL: import.meta.url };
    return expectedError;
}

await test
(
    'Module format detection',
    async ctx =>
    {
        const { default: import0 } = await import(IMPORT_0_PATH);

        await ctx.test
        (
            'file with extension ".cjs"',
            async () =>
            {
                const { default: actual } = await import0('../fixtures/cjs-module.cjs');
                assert.equal(actual, 'CommonJS module');
            },
        );

        await ctx.test
        (
            'file with extension ".mjs"',
            async () =>
            {
                const { default: actual } = await import0('../fixtures/es-module.mjs');
                assert.equal(actual, 'ES module');
            },
        );

        await ctx.test
        (
            'file with extension ".js" when the next "package.json" file has type commonjs',
            async () =>
            {
                const { default: actual } = await import0('../fixtures/cjs/module.js');
                assert.equal(actual, 'CommonJS module');
            },
        );

        await ctx.test
        (
            'file with extension ".js" when the next "package.json" file is inside "node_modules"',
            async () =>
            {
                const { default: actual } = await import0('../fixtures/node_modules/module.js');
                assert.equal(actual, 'CommonJS module');
            },
        );

        await ctx.test
        (
            'file with extension ".js" when the next "package.json" file has type module',
            async () =>
            {
                const { default: actual } = await import0('../fixtures/esm/module.js');
                assert.equal(actual, 'ES module');
            },
        );

        await ctx.test
        (
            'file with extension ".js" ignoring a "package.json" directory',
            async () =>
            {
                const { default: actual } =
                await import0('../fixtures/dir-package-json-dir/module.js');
                assert.equal(actual, 'ES module');
            },
        );

        await ctx.test
        (
            'file with extension ".js" ignoring a self-targeting "package.json" link',
            async () =>
            {
                const { default: actual } =
                await import0('../fixtures/self-link-package-json-dir/module.js');
                assert.equal(actual, 'ES module');
            },
        );

        await ctx.test
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

        await ctx.test
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

        await ctx.test
        (
            'unprefixed builtin specifier',
            async () =>
            {
                const { default: actual } = await import0('assert/strict');
                assert.equal(actual, assert);
            },
        );

        await ctx.test
        (
            'builtin specifier prefixed with "node:"',
            async () =>
            {
                const { default: actual } = await import0('node:assert/strict');
                assert.equal(actual, assert);
            },
        );

        await ctx.test
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

        await ctx.test
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

        await ctx.test
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

        await ctx.test
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

        await ctx.test
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

        await ctx.test
        (
            'file with extension ".js" when the next "package.json" file is null',
            async () =>
            {
                const specifier = '../fixtures/null-package-json-dir/any.js';
                await assert.rejects(() => import0(specifier), TypeError);
            },
        );

        for
        (
            const { description, specifier } of
            [
                {
                    description:    'supported extension',
                    specifier:      '../fixtures/missing.js',
                },
                {
                    description:    'unsupported extension',
                    specifier:      '../fixtures/missing.png',
                },
                {
                    description:    'extension ".js" when the next "package.json" file is invalid',
                    specifier:      '../fixtures/invalid-package-json-dir/missing.js',
                },
            ]
        )
        {
            await ctx.test
            (
                `missing path with ${description}`,
                () =>
                assert.rejects
                (() => import0(specifier), { code: 'ERR_MODULE_NOT_FOUND', constructor: Error }),
            );
        }

        for (const separator of ['/', '\\'])
        {
            await ctx.test
            (
                `path with trailing "${separator}"`,
                async () =>
                {
                    const specifier = `../fixtures/missing-dir${separator}`;
                    const expectedError =
                    process.platform === 'win32' ?
                    { code: 'ERR_MODULE_NOT_FOUND', constructor: Error } :
                    makeExpectedError('ERR_UNSUPPORTED_DIR_IMPORT', specifier);
                    await assert.rejects(() => import0(specifier), expectedError);
                },
            );
        }

        for
        (
            const { description, specifier } of
            [
                { description: 'HTTP', specifier: 'http://example.com' },
                {
                    description:    'blob',
                    specifier:      'blob:nodedata:00000000-0000-0000-0000-000000000000',
                },
            ]
        )
        {
            await ctx.test
            (
                `unsupported ${description} URL`,
                () =>
                assert.rejects
                (
                    () => import0(specifier),
                    { code: 'ERR_INVALID_URL_SCHEME', constructor: TypeError },
                ),
            );
        }

        // Node.js 18 treats an empty string as a valid specifier.
        await ctx.test
        (
            'empty path',
            () =>
            assert.rejects(() => import0(''), { code: 'ERR_MODULE_NOT_FOUND', constructor: Error }),
        );

        for
        (
            const { description, specifier } of
            [
                { specifier: '@#$%', description: 'starting with "@"' },
                { specifier: 'foo\\bar', description: 'containing a "\\" in the package name' },
                { specifier: 'foo%bar', description: 'containing a "%" in the package name' },
                { specifier: 'file:%2f', description: 'containing an encoded "/"' },
                { specifier: 'file:%5C', description: 'containing an encoded "\\"' },
            ]
        )
        {
            await ctx.test
            (
                `invalid module specifier ${description}`,
                () =>
                assert.rejects
                (
                    () => import0(specifier),
                    { code: 'ERR_INVALID_MODULE_SPECIFIER', constructor: TypeError },
                ),
            );
        }

        await ctx.test
        (
            'inaccessible file (POSIX)',
            { skip: process.platform === 'win32' },
            () =>
            assert.rejects
            (
                () => import0('/dev/null/any.js'),
                { code: 'ERR_MODULE_NOT_FOUND', constructor: Error },
            ),
        );

        await ctx.test
        (
            'inaccessible file (Windows)',
            { skip: process.platform !== 'win32' },
            () =>
            assert.rejects
            (
                () => import0('file:///C:/System%20Volume%20Information'),
                { code: 'ERR_MODULE_NOT_FOUND', constructor: Error },
            ),
        );

        await ctx.test
        (
            'self-targeting link',
            () =>
            assert.rejects
            (
                () => import0('../fixtures/self-link.js'),
                { code: 'ERR_MODULE_NOT_FOUND', constructor: Error },
            ),
        );
    },
);
