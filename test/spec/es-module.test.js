import { toDataURL }                from '../utils.js';
import assert                       from 'node:assert/strict';
import { readFile }                 from 'node:fs/promises';
import test                         from 'node:test';
import { isModuleNamespaceObject }  from 'node:util/types';

const FILE_URL = new URL('../fixtures/es-module.mjs', import.meta.url);

for
(
    const { assertResolveRelativeURL, description, urlProvider } of
    [
        {
            description: 'file URL',
            urlProvider: () => FILE_URL.toString(),
            assertResolveRelativeURL:
            resolveRelativeURL =>
            {
                const actual = resolveRelativeURL();
                const expected = new URL('.', FILE_URL).toString();
                assert.equal(actual, expected);
            },
        },
        {
            description: 'data URL',
            urlProvider:
            async () =>
            {
                const content = await readFile(FILE_URL, 'utf-8');
                const url = toDataURL(content);
                return url;
            },
            assertResolveRelativeURL:
            resolveRelativeURL =>
            assert.throws(resolveRelativeURL, { code: 'ERR_INVALID_URL', constructor: TypeError }),
        },
    ]
)
{
    await test
    (
        `ES module specified by ${description}`,
        async ctx =>
        {
            const url = await urlProvider();
            const { default: import0 } = await import('#import0');
            const namespace = await import0(url);

            await ctx.test('module namespace', () => assert(isModuleNamespaceObject(namespace)));

            await ctx.test
            (
                'import.meta',
                () =>
                {
                    const { meta } = namespace;
                    assert.equal(Object.getPrototypeOf(meta), null);
                    const { resolve, url } = meta;
                    assert.deepEqual
                    (
                        Object.getOwnPropertyDescriptors(meta),
                        {
                            resolve:
                            {
                                value:          resolve,
                                writable:       true,
                                enumerable:     true,
                                configurable:   true,
                            },
                            url:
                            {
                                value:          url,
                                writable:       true,
                                enumerable:     true,
                                configurable:   true,
                            },
                        },
                    );
                },
            );

            await ctx.test('import.meta.url', () => assert.equal(namespace.meta.url, url));

            await ctx.test
            (
                'import.meta.resolve',
                () =>
                {
                    const { resolve } = namespace.meta;
                    assert.equal(typeof resolve, 'function');
                    assert.equal(Object.getPrototypeOf(resolve), Function.prototype);
                    assert.equal(resolve.length, 1);
                    assert.equal(resolve.name, 'resolve');
                    assert.deepEqual(resolve.prototype, { });
                    {
                        const actual = resolve(url);
                        assert.equal(actual, url);
                    }
                    assertResolveRelativeURL(() => resolve('.'));
                },
            );

            await ctx.test('this', () => assert.equal(namespace.thisValue, undefined));
        },
    );
}
