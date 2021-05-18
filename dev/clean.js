#!/usr/bin/env node

import { promises as fsPromises }   from 'fs';
import { resolve }                  from 'path';
import { fileURLToPath }            from 'url';

const workspaceFolder = resolve(fileURLToPath(import.meta.url), '../..');
process.chdir(workspaceFolder);
await fsPromises.rm('coverage', { force: true, recursive: true });
