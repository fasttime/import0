#!/usr/bin/env node

import c8js from 'c8js';

await c8js
(
    process.execPath,
    ['--experimental-import-meta-resolve', '--experimental-vm-modules', '--test', 'test/spec'],
    {
        cwd:            new URL('..', import.meta.url),
        reporter:       ['html', 'text-summary'],
        useC8Config:    false,
        watermarks:
        {
            branches:   [90, 100],
            functions:  [90, 100],
            lines:      [90, 100],
            statements: [90, 100],
        },
    },
);
