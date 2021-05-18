#!/usr/bin/env node

import { lint }             from '@fasttime/lint';
import { resolve }          from 'path';
import { fileURLToPath }    from 'url';

const workspaceFolder = resolve(fileURLToPath(import.meta.url), '../..');
process.chdir(workspaceFolder);
await lint
(
    {
        src: ['*.js', 'dev/*.js', 'test/*.js'],
        envs: 'node',
        parser: '@babel/eslint-parser',
        parserOptions:
        {
            babelOptions: { plugins: ['@babel/plugin-syntax-top-level-await'] },
            ecmaVersion: 2021,
            requireConfigFile: false,
            sourceType: 'module',
        },
    },
);
