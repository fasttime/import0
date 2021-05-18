/* eslint-env mocha */

import assert from 'assert';

describe
(
    'import.meta',
    () =>
    {
        it
        (
            'in a module',
            async () =>
            {
                const { default: import0 } = await import('../import0.js');

                const { meta } = await import0('./fixtures/es-module.mjs');
                const url = new URL('./fixtures/es-module.mjs', import.meta.url).toString();
                assert.deepStrictEqual(meta, { __proto__: null, url });
                assert.deepStrictEqual
                (
                    Object.getOwnPropertyDescriptor(meta, 'url'),
                    { value: url, writable: true, enumerable: true, configurable: true },
                );
            },
        );
    },
);
