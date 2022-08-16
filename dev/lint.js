#!/usr/bin/env node

import { lint }             from '@fasttime/lint';
import { resolve }          from 'node:path';
import { fileURLToPath }    from 'node:url';

const workspaceFolder = resolve(fileURLToPath(import.meta.url), '../..');
process.chdir(workspaceFolder);
await lint
(
    {
        src: ['*.{js,ts}', 'dev/*.js', 'test/**/*.js', '!test/fixtures'],
        jsVersion: 2022,
        envs: 'node',
        parserOptions: { project: 'tsconfig.json', sourceType: 'module' },
    },
);
