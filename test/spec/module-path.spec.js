import assert               from 'node:assert/strict';
import test                 from 'node:test';
import { fileURLToPath }    from 'node:url';

const MODULE_IMPORTER_URL       = '../fixtures/module-importer.mjs';
const MODULE_IMPORTER_FULL_URL  = new URL(MODULE_IMPORTER_URL, import.meta.url).toString();

function makeExpectedError(code, specifier)
{
    const expectedError =
    { code, constructor: Error, specifier, referencingModuleURL: MODULE_IMPORTER_FULL_URL };
    return expectedError;
}

await test
(
    'Module path resolution',
    async ctx =>
    {
        function adapt(ctx)
        {
            ctx.testWithResolveModuleURL = testWithResolveModuleURL;
        }

        const getLastResolveModuleURLArgs = () => lastResolveModuleURLArgs;

        async function testWithResolveModuleURL(name, options, fn)
        {
            function resolveModuleURL(...args)
            {
                lastResolveModuleURLArgs = args;
                const promise = originalResolveModuleURL(...args);
                return promise;
            }

            if (arguments.length === 2)
                [options, fn] = [undefined, options];
            const originalResolveModuleURL = setResolveModuleURL(resolveModuleURL);
            try
            {
                await this.test(name, options, fn);
            }
            finally
            {
                setResolveModuleURL(originalResolveModuleURL);
                lastResolveModuleURLArgs = undefined;
            }
        }

        const { default: import0, setResolveModuleURL } = await import('#import0');

        let lastResolveModuleURLArgs;

        adapt(ctx);

        await ctx.testWithResolveModuleURL
        (
            'file URL',
            async () =>
            {
                const url = new URL('../fixtures/any.js', import.meta.url);
                await import0(url);
                assert.deepEqual(getLastResolveModuleURLArgs(), [url.toString(), import.meta.url]);
            },
        );

        await ctx.testWithResolveModuleURL
        (
            'file URL without "///" after "file:"',
            async () =>
            {
                const url = new URL('../fixtures/any.js', import.meta.url);
                const specifier = url.toString().replace(/^file:\/\/\//, 'file:');
                await import0(specifier);
                assert.deepEqual(getLastResolveModuleURLArgs(), [specifier, import.meta.url]);
            },
        );

        await ctx.testWithResolveModuleURL
        (
            'relative path',
            async () =>
            {
                const specifier = '../fixtures/any.js';
                await import0(specifier);
                assert.deepEqual(getLastResolveModuleURLArgs(), [specifier, import.meta.url]);
            },
        );

        await ctx.testWithResolveModuleURL
        (
            'absolute path',
            { skip: process.platform === 'win32' },
            async () =>
            {
                const url = new URL('../fixtures/any.js', import.meta.url);
                const specifier = fileURLToPath(url);
                await import0(specifier);
                assert.deepEqual(getLastResolveModuleURLArgs(), [specifier, import.meta.url]);
            },
        );

        await ctx.testWithResolveModuleURL
        (
            'package without subpath',
            async () =>
            {
                const { default: import_ } = await import0(MODULE_IMPORTER_URL);
                const specifier = 'any-package';
                await import_(specifier);
                assert.deepEqual
                (getLastResolveModuleURLArgs(), [specifier, MODULE_IMPORTER_FULL_URL]);
            },
        );

        await ctx.testWithResolveModuleURL
        (
            'package with valid subpath',
            async () =>
            {
                const { default: import_ } = await import0(MODULE_IMPORTER_URL);
                const specifier = 'any-package/any-module.mjs';
                await import_(specifier);
                assert.deepEqual
                (getLastResolveModuleURLArgs(), [specifier, MODULE_IMPORTER_FULL_URL]);
            },
        );

        await ctx.testWithResolveModuleURL
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
                assert.deepEqual
                (getLastResolveModuleURLArgs(), [specifier, MODULE_IMPORTER_FULL_URL]);
            },
        );

        await ctx.testWithResolveModuleURL
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
                assert.deepEqual
                (getLastResolveModuleURLArgs(), [specifier, MODULE_IMPORTER_FULL_URL]);
            },
        );

        await ctx.testWithResolveModuleURL
        (
            'package with main',
            async () =>
            {
                const { default: import_ } = await import0(MODULE_IMPORTER_URL);
                const specifier = 'package-with-main';
                await import_(specifier);
                assert.deepEqual
                (getLastResolveModuleURLArgs(), [specifier, MODULE_IMPORTER_FULL_URL]);
            },
        );

        for
        (
            const { type, existingSpecifier, notFoundSpecifier } of
            [
                {
                    type: 'exports',
                    existingSpecifier: 'imports-exports',
                    notFoundSpecifier: 'imports-exports/not-found',
                },
                {
                    type: 'imports',
                    existingSpecifier: '#main',
                    notFoundSpecifier: '#not-found',
                },
            ]
        )
        {
            await ctx.test
            (
                type,
                async ctx =>
                {
                    adapt(ctx);

                    for
                    (
                        const { importerType, importerURL } of
                        [
                            {
                                importerType: 'CommonJS module',
                                importerURL: '../fixtures/imports-exports/module-importer.cjs',
                            },
                            {
                                importerType: 'ES module',
                                importerURL: '../fixtures/imports-exports/module-importer.mjs',
                            },
                        ]
                    )
                    {
                        await ctx.testWithResolveModuleURL
                        (
                            `existing import mapping (from ${importerType})`,
                            async () =>
                            {
                                const { default: import_ } = await import0(importerURL);
                                const { default: actual } = await import_(existingSpecifier);
                                assert.equal(actual, 'ES module');
                                const importerFullURL = new URL(importerURL, import.meta.url);
                                assert.deepEqual
                                (
                                    getLastResolveModuleURLArgs(),
                                    [existingSpecifier, importerFullURL.toString()],
                                );
                            },
                        );

                        await ctx.test
                        (
                            `import mapping not found (from ${importerType})`,
                            async () =>
                            {
                                const { default: import_ } = await import0(importerURL);
                                await assert.rejects
                                (
                                    () => import_(notFoundSpecifier),
                                    { code: 'ERR_MODULE_NOT_FOUND', constructor: Error },
                                );
                            },
                        );
                    }

                    await ctx.testWithResolveModuleURL
                    (
                        'existing require mapping',
                        async () =>
                        {
                            const requirerURL =
                            new URL
                            ('../fixtures/imports-exports/module-requirer.cjs', import.meta.url);
                            const { default: require } = await import0(requirerURL);
                            const actual = require(existingSpecifier);
                            assert.equal(actual, 'CommonJS module');
                            assert.deepEqual
                            (
                                getLastResolveModuleURLArgs(),
                                [requirerURL.toString(), import.meta.url],
                            );
                        },
                    );

                    await ctx.test
                    (
                        'require mapping not found',
                        async () =>
                        {
                            const requirerURL =
                            new URL
                            ('../fixtures/imports-exports/module-requirer.cjs', import.meta.url);
                            const { default: require } = await import0(requirerURL);
                            assert.throws
                            (
                                () => require(notFoundSpecifier),
                                { code: 'MODULE_NOT_FOUND', constructor: Error },
                            );
                        },
                    );
                },
            );
        }

        await ctx.testWithResolveModuleURL
        (
            'package with missing main',
            async () =>
            {
                const { default: import_ } = await import0(MODULE_IMPORTER_URL);
                const specifier = 'package-with-missing-main';
                await
                assert.rejects
                (() => import_(specifier), { code: 'ERR_MODULE_NOT_FOUND', constructor: Error });
                assert.deepEqual
                (getLastResolveModuleURLArgs(), [specifier, MODULE_IMPORTER_FULL_URL]);
            },
        );

        await ctx.testWithResolveModuleURL
        (
            'missing package',
            async () =>
            {
                const { default: import_ } = await import0(MODULE_IMPORTER_URL);
                const specifier = 'missing-package';
                await
                assert.rejects
                (() => import_(specifier), { code: 'ERR_MODULE_NOT_FOUND', constructor: Error });
                assert.deepEqual
                (getLastResolveModuleURLArgs(), [specifier, MODULE_IMPORTER_FULL_URL]);
            },
        );
    },
);
