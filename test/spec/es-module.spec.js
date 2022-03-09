/* eslint-env ebdd/ebdd */

import { toDataURL }                from '../utils.js';
import assert                       from 'assert/strict';
import { readFile }                 from 'fs/promises';
import { isModuleNamespaceObject }  from 'util/types';

const FILE_URL = new URL('../fixtures/es-module.mjs', import.meta.url);

describe.per
(
    [
        {
            description: 'file URL',
            urlProvider: () => FILE_URL.toString(),
            assertResolveRelativeURL:
            async resolveRelativeURL =>
            {
                const actual = await resolveRelativeURL();
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
            assert.rejects
            (resolveRelativeURL, { code: 'ERR_INVALID_URL_SCHEME', constructor: TypeError }),
        },
    ],
)
(
    'ES module specified by #.description',
    async ({ assertResolveRelativeURL, urlProvider }) =>
    {
        const url = await urlProvider();

        let namespace;

        before
        (
            async () =>
            {
                const { default: import0 } = await import('#import0');
                namespace = await import0(url);
            },
        );

        it('module namespace', () => assert(isModuleNamespaceObject(namespace)));

        it
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
                        { value: resolve, writable: true, enumerable: true, configurable: true },
                        url:
                        { value: url, writable: true, enumerable: true, configurable: true },
                    },
                );
            },
        );

        it('import.meta.url', () => assert.equal(namespace.meta.url, url));

        it
        (
            'import.meta.resolve',
            async () =>
            {
                const { resolve } = namespace.meta;
                assert.equal(typeof resolve, 'function');
                // eslint-disable-next-line require-await
                const AsyncFunction = (async () => undefined).constructor;
                assert.equal(Object.getPrototypeOf(resolve), AsyncFunction.prototype);
                assert.equal(resolve.length, 1);
                assert.equal(resolve.name, 'resolve');
                assert.equal(resolve.prototype, undefined);
                {
                    const actual = await resolve(url);
                    assert.equal(actual, url);
                }
                await assertResolveRelativeURL(() => resolve('.'));
            },
        );

        it('this', () => assert.equal(namespace.thisValue, undefined));
    },
);
