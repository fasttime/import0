#!/usr/bin/env node

import { promises as fsPromises }   from 'fs';
import { resolve }                  from 'path';
import { fileURLToPath }            from 'url';

const workspaceFolder = resolve(fileURLToPath(import.meta.url), '../..');
process.chdir(workspaceFolder);
const paths = ['coverage', 'test/fixtures'];
const { rm } = fsPromises;
const options = { force: true, recursive: true };
const promises = paths.map(path => rm(path, options));
await Promise.all(promises);
