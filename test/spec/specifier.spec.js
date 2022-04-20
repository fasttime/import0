import assert   from 'node:assert/strict';
import test     from 'node:test';

await test
(
    'Specifier',
    async ctx =>
    {
        const { default: import0 } = await import('#import0');

        for (const specifier of ['$*!?', 123.456, { }, undefined])
        {
            const type = typeof specifier;
            await ctx.test
            (
                `of type ${type}`,
                async () =>
                {
                    await
                    assert.rejects
                    (
                        () => import0(specifier),
                        { code: 'ERR_MODULE_NOT_FOUND', constructor: Error },
                    );
                },
            );
        }

        await ctx.test
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
