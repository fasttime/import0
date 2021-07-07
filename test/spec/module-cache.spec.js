/* eslint-env ebdd/ebdd */

import assert from 'assert/strict';

describe
(
    'Module cache',
    () =>
    {
        it.per
        (
            [
                { name: 'builtin',  specifier: '../fixtures/module-importer/builtin.mjs'    },
                { name: 'CommonJS', specifier: '../fixtures/module-importer/cjs.mjs'        },
                { name: 'ES',       specifier: '../fixtures/module-importer/esm.mjs'        },
            ],
        )
        (
            'for a #.name module',
            async ({ specifier }) =>
            {
                const { default: import0 } = await import('import0');
                const { default: [expected, actual] } = await import0(specifier);
                assert.equal(actual, expected);
            },
        );
    },
);
