#!/usr/bin/env node

import { lint }             from '@fasttime/lint';
import { resolve }          from 'path';
import { fileURLToPath }    from 'url';

const workspaceFolder = resolve(fileURLToPath(import.meta.url), '../..');
process.chdir(workspaceFolder);
await lint
(
    {
        src: ['*.{js,ts}', 'dev/*.js', 'test/**/*.js', '!test/fixtures'],
        envs: 'node',
        parserOptions: { ecmaVersion: 2022, project: 'tsconfig.json', sourceType: 'module' },
        plugins: ['ebdd'],
    },
);
