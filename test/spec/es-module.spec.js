/* eslint-env ebdd/ebdd */

import assert from 'assert/strict';

describe
(
    'ES module',
    () =>
    {
        let namespace;

        before
        (
            async () =>
            {
                const { default: import0 } = await import('../../import0.js');
                namespace = await import0('../fixtures/es-module.mjs');
            },
        );

        it
        (
            'import.meta',
            () =>
            {
                const { meta } = namespace;
                const url =
                new URL('../fixtures/es-module.mjs', import.meta.url).toString();
                assert.deepStrictEqual(meta, { __proto__: null, url });
                assert.deepStrictEqual
                (
                    Object.getOwnPropertyDescriptor(meta, 'url'),
                    { value: url, writable: true, enumerable: true, configurable: true },
                );
            },
        );

        it
        (
            'this',
            () => assert.strictEqual(namespace.thisValue, undefined),
        );
    },
);
