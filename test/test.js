#!/usr/bin/env node

import { readdir }                      from 'node:fs/promises';
import { join }                         from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SPEC_DIR = 'test/spec';

const cwd = fileURLToPath(new URL('..', import.meta.url));
process.chdir(cwd);

const fileNames = await readdir(SPEC_DIR);
for (const fileName of fileNames)
{
    if (fileName.endsWith('.spec.js'))
    {
        const path = join(SPEC_DIR, fileName);
        const url = pathToFileURL(path);
        await import(url);
    }
}
