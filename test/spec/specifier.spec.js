/* eslint-env ebdd/ebdd */

import assert from 'assert/strict';

describe
(
    'Specifier',
    () =>
    {
        let import0;

        before
        (
            async () =>
            {
                ({ default: import0 } = await import('#import0'));
            },
        );

        it.per
        (
            ['$*!?', 123.456, { }, undefined],
            specifier => ({ specifier, type: typeof specifier }),
        )
        (
            'of type #.type',
            async ({ specifier }) =>
            {
                await
                assert.rejects
                (
                    () => import0(specifier),
                    { code: 'ERR_MODULE_NOT_FOUND', constructor: Error },
                );
            },
        );

        it
        (
            'of type symbol',
            async () =>
            {
                await
                assert.rejects
                (
                    () => import0(Symbol.iterator),
                    { constructor: TypeError },
                );
            },
        );
    },
);
