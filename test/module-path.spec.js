/* eslint-env ebdd/ebdd */

import assert               from 'assert';
import { fileURLToPath }    from 'url';

describe
(
    'Module path resolution',
    () =>
    {
        let import0;

        before
        (
            async () =>
            {
                ({ default: import0 } = await import('../import0.js'));
            },
        );

        it
        (
            'file URL object',
            async () =>
            {
                const url = new URL('./fixtures/any.js', import.meta.url);
                await assert.doesNotReject(() => import0(url));
            },
        );

        it
        (
            'file URL without "///" after "file:"',
            async () =>
            {
                let url = new URL('./fixtures/any.js', import.meta.url);
                url = url.toString().replace(/^file:\/\/\//, 'file:');
                await assert.doesNotReject(() => import0(url));
            },
        );

        it
        (
            'relative path',
            () => assert.doesNotReject(() => import0('./fixtures/any.js')),
        );

        it.when(process.platform !== 'win32')
        (
            'absolute path',
            async () =>
            {
                const url = new URL('./fixtures/any.js', import.meta.url);
                const path = fileURLToPath(url);
                await assert.doesNotReject(() => import0(path));
            },
        );
    },
);
