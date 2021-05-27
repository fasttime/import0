/* eslint-env ebdd/ebdd */

import assert from 'assert/strict';

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

        it
        (
            'import.meta',
            () =>
            {
                const { meta } = namespace;
                const url = new URL(SPECIFIER, import.meta.url).toString();
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
