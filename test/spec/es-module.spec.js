/* eslint-env ebdd/ebdd */

import assert                       from 'assert/strict';
import { isModuleNamespaceObject }  from 'util/types';

describe
(
    'ES module',
    () =>
    {
        const SPECIFIER = '../fixtures/es-module.mjs';

        let namespace;

        before
        (
            async () =>
            {
                const { default: import0 } = await import('import0');
                namespace = await import0(SPECIFIER);
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

        it
        (
            'import.meta.url',
            () =>
            {
                const actual = namespace.meta.url;
                const expected = new URL(SPECIFIER, import.meta.url).toString();
                assert.equal(actual, expected);
            },
        );

        it
        (
            'import.meta.resolve',
            async () =>
            {
                const { resolve } = namespace.meta;
                assert.equal(typeof resolve, 'function');
                // eslint-disable-next-line require-await
                const AsyncFunction = (async () => null).constructor;
                assert.equal(Object.getPrototypeOf(resolve), AsyncFunction.prototype);
                assert.equal(resolve.length, 1);
                assert.equal(resolve.name, 'resolve');
                assert.equal(resolve.prototype, undefined);
                const actual = await resolve('.');
                const expected = new URL('.', new URL(SPECIFIER, import.meta.url)).toString();
                assert.strictEqual(actual, expected);
            },
        );

        it('this', () => assert.equal(namespace.thisValue, undefined));
    },
);
