#!/usr/bin/env node

import { rm }               from 'node:fs/promises';
import { join }             from 'node:path';
import { fileURLToPath }    from 'node:url';

const workspaceFolder = join(fileURLToPath(import.meta.url), '../..');
process.chdir(workspaceFolder);
const paths = ['coverage', 'test/fixtures'];
const options = { force: true, recursive: true };
const promises = paths.map(path => rm(path, options));
await Promise.all(promises);
