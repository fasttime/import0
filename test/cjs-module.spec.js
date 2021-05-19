/* eslint-env ebdd/ebdd */

import assert               from 'assert';
import Module               from 'module';
import { fileURLToPath }    from 'url';

describe
(
    'CommonJS module',
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
            'exports',
            async () =>
            {
                const actual = await import0('./fixtures/cjs-exports-module.cjs');
                const expected =
                {
                    __proto__: null,
                    aux: 'Auxiliary export',
                    default:
                    { aux: 'Auxiliary export', default: 'Default export', ext: 'Extended export' },
                    ext: 'Extended export',
                };
                Object.defineProperty(expected, Symbol.toStringTag, { value: 'Module' });
                assert.deepStrictEqual(actual, expected);
                assert.deepStrictEqual
                (Reflect.ownKeys(actual), ['aux', 'default', 'ext', Symbol.toStringTag]);
                assert.deepStrictEqual
                (Reflect.ownKeys(actual.default), ['ext', 'default', 'aux']);
            },
        );

        it
        (
            'default exports',
            async () =>
            {
                const actual = await import0('./fixtures/cjs-no-exports-module.cjs');
                const expected = { __proto__: null, default: { } };
                Object.defineProperty(expected, Symbol.toStringTag, { value: 'Module' });
                assert.deepStrictEqual(actual, expected);
                assert.deepStrictEqual(Reflect.ownKeys(actual), ['default', Symbol.toStringTag]);
                assert.deepStrictEqual(Reflect.ownKeys(actual.default), []);
            },
        );

        it
        (
            'runtime variables',
            async () =>
            {
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
                await import0('./fixtures/cjs-vars-module.cjs');
                assert.strictEqual(thisValue, exports);
                assert.strictEqual(exports, defaultExport);
                assert.strictEqual(typeof require, 'function');
                assert.strictEqual(require.length, 1);
                assert.strictEqual(require.name, 'require');
                assert.strictEqual(module.constructor, Module);
                const expectedFilename =
                fileURLToPath(new URL('./fixtures/cjs-vars-module.cjs', import.meta.url));
                assert.strictEqual(__filename, expectedFilename);
                const expectedDirname = fileURLToPath(new URL('./fixtures', import.meta.url));
                assert.strictEqual(__dirname, expectedDirname);
            },
        );
    },
);
