/* eslint-env ebdd/ebdd */

import assert               from 'assert/strict';
import { existsSync }       from 'fs';
import { createRequire }    from 'module';

const IMPORT_0_PATH = '#import0';

describe
(
    'Call site resolution',
    () =>
    {
        it
        (
            'from a ES module',
            async () =>
            {
                const { default: import0 } = await import(IMPORT_0_PATH);
                await assert.doesNotReject(() => import0('../fixtures/any.js'));
            },
        );

        it
        (
            'from a CommonJS module',
            async () =>
            {
                const require = createRequire(import.meta.url);
                const importer = require('../fixtures/cjs-any-importer.cjs');
                await assert.doesNotReject(importer);
            },
        );

        it
        (
            'from an arrow function',
            async () =>
            {
                const { default: import0 } = await import(IMPORT_0_PATH);
                await assert.doesNotReject(() => import0('../fixtures/any.js'));
            },
        );

        it
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

        it
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

        it
        .per
        (
            [
                { moduleType: 'CommonJS module',    url: '../fixtures/(%0A).cjs'    },
                { moduleType: 'ES module',          url: '../fixtures/(%0A).mjs'    },
            ],
            param => when(existsSync(new URL(param.url, import.meta.url)), param),
        )
        .per
        (
            [
                { codeType: 'eval code',        fnName: 'importInEval'      },
                { codeType: 'Function code',    fnName: 'importInFunction'  },
            ],
        )
        (
            'from #2.codeType in a #1.moduleType with special characters in its name',
            async ({ url }, { fnName }) =>
            {
                const namespace = await import(url);
                const fn = namespace[fnName];
                await assert.doesNotReject(fn);
            },
        );
    },
);
