import assert               from 'node:assert/strict';
import Module               from 'node:module';
import test                 from 'node:test';
import { fileURLToPath }    from 'node:url';

await test
(
    'CommonJS module',
    async ctx =>
    {
        const { default: import0 } = await import('#import0');

        await ctx.test
        (
            'exports',
            async () =>
            {
                const actual = await import0('../fixtures/cjs-exports-module.cjs');
                const expected =
                {
                    __proto__: null,
                    aux: 'Auxiliary export',
                    default:
                    { aux: 'Auxiliary export', default: 'Default export', ext: 'Extended export' },
                    ext: 'Extended export',
                };
                Object.defineProperty(expected, Symbol.toStringTag, { value: 'Module' });
                assert.deepEqual(actual, expected);
                assert.deepEqual
                (Reflect.ownKeys(actual), ['aux', 'default', 'ext', Symbol.toStringTag]);
                assert.deepEqual(Reflect.ownKeys(actual.default), ['ext', 'default', 'aux']);
            },
        );

        await ctx.test
        (
            'default exports',
            async () =>
            {
                const actual = await import0('../fixtures/cjs-no-exports-module.cjs');
                const expected = { __proto__: null, default: { } };
                Object.defineProperty(expected, Symbol.toStringTag, { value: 'Module' });
                assert.deepEqual(actual, expected);
                assert.deepEqual(Reflect.ownKeys(actual), ['default', Symbol.toStringTag]);
                assert.deepEqual(Reflect.ownKeys(actual.default), []);
            },
        );

        await ctx.test
        (
            'runtime variables',
            async () =>
            {
                const specifier = '../fixtures/cjs-vars-module.cjs';
                const
                {
                    default: defaultExport,
                    this: thisValue,
                    exports,
                    require,
                    module,
                    __filename,
                    __dirname,
                } =
                await import0(specifier);
                assert.equal(thisValue, exports);
                assert.equal(exports, defaultExport);
                assert.equal(typeof require, 'function');
                assert.equal(require.length, 1);
                assert.equal(require.name, 'require');
                assert.equal(module.constructor, Module);
                const expectedFilename = fileURLToPath(new URL(specifier, import.meta.url));
                assert.equal(__filename, expectedFilename);
                const expectedDirname = fileURLToPath(new URL('../fixtures', import.meta.url));
                assert.equal(__dirname, expectedDirname);
            },
        );
    },
);
