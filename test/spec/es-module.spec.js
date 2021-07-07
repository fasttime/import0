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
                const url = new URL(SPECIFIER, import.meta.url).toString();
                assert.deepEqual(meta, { __proto__: null, url });
                assert.deepEqual
                (
                    Object.getOwnPropertyDescriptor(meta, 'url'),
                    { value: url, writable: true, enumerable: true, configurable: true },
                );
            },
        );

        it('this', () => assert.equal(namespace.thisValue, undefined));
    },
);
