import assert               from 'node:assert/strict';
import { existsSync }       from 'node:fs';
import { createRequire }    from 'node:module';
import test                 from 'node:test';

const IMPORT_0_PATH = '#import0';

await test
(
    'Call site resolution',
    async ctx =>
    {
        await ctx.test
        (
            'from a ES module',
            async () =>
            {
                const { default: import0 } = await import(IMPORT_0_PATH);
                await assert.doesNotReject(() => import0('../fixtures/any.js'));
            },
        );

        await ctx.test
        (
            'from a CommonJS module',
            async () =>
            {
                const require = createRequire(import.meta.url);
                const importer = require('../fixtures/cjs-any-importer.cjs');
                await assert.doesNotReject(importer);
            },
        );

        await ctx.test
        (
            'from an arrow function',
            async () =>
            {
                const { default: import0 } = await import(IMPORT_0_PATH);
                await assert.doesNotReject(() => import0('../fixtures/any.js'));
            },
        );

        await ctx.test
        (
            'from dynamic code',
            async () =>
            {
                // eslint-disable-next-line require-await
                const AsyncFunction = (async () => undefined).constructor;
                const import_ =
                AsyncFunction
                (
                    `const { default: import0 } = await import('${IMPORT_0_PATH}');\n` +
                    '\n' +
                    'await import0(\'../fixtures/any.js\');\n',
                );
                await assert.doesNotReject(import_);
            },
        );

        await ctx.test
        (
            'from native code',
            async () =>
            {
                const { default: import0 } = await import(IMPORT_0_PATH);
                await assert.rejects
                (
                    () => ['../fixtures/any.js', undefined].reduce(import0),
                    { code: 'ERR_UNSUPPORTED_CALL_SITE', constructor: Error },
                );
            },
        );

        for
        (
            const { moduleType, url } of
            [
                { moduleType: 'CommonJS module',    url: '../fixtures/(%0A).cjs'    },
                { moduleType: 'ES module',          url: '../fixtures/(%0A).mjs'    },
            ]
        )
        {
            const skip = !existsSync(new URL(url, import.meta.url));
            for
            (
                const { codeType, fnName } of
                [
                    { codeType: 'eval code',        fnName: 'importInEval'      },
                    { codeType: 'Function code',    fnName: 'importInFunction'  },
                ]
            )
            {
                await ctx.test
                (
                    `from ${codeType} in a ${moduleType} with special characters in its name`,
                    { skip },
                    async () =>
                    {
                        const namespace = await import(url);
                        const fn = namespace[fnName];
                        await assert.doesNotReject(fn);
                    },
                );
            }
        }
    },
);
