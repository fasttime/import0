/* eslint-env ebdd/ebdd */

import assert               from 'assert';
import { createRequire }    from 'module';

const IMPORT_0_PATH = '../import0.js';

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

                await assert.doesNotReject(() => import0('./fixtures/any.js'));
            },
        );

        it
        (
            'from a CommonJS module',
            async () =>
            {
                const require = createRequire(import.meta.url);
                const importer = require('./fixtures/cjs-importer.cjs');
                await assert.doesNotReject(importer);
            },
        );

        it
        (
            'from an arrow function',
            async () =>
            {
                const { default: import0 } = await import(IMPORT_0_PATH);

                await assert.doesNotReject(() => import0('./fixtures/any.js'));
            },
        );

        it
        (
            'from evaluated code',
            async () =>
            {
                // eslint-disable-next-line require-await
                const AsyncFunction = (async () => undefined).constructor;

                const importer =
                AsyncFunction
                (
                    `const { default: import0 } = await import('${IMPORT_0_PATH}');\n` +
                    '\n' +
                    'await import0(\'./fixtures/any.js\');\n',
                );
                await assert.doesNotReject(importer);
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
                    () => ['./fixtures/any.js', undefined].reduce(import0),
                    { code: 'ERR_UNSUPPORTED_CALL_SITE', constructor: Error },
                );
            },
        );
    },
);
