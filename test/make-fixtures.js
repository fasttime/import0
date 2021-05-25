#!/usr/bin/env node

import { promises as fsPromises }   from 'fs';
import { dirname, join }            from 'path';
import { fileURLToPath }            from 'url';

const FIXTURES =
{
    'any-package-importer-with-subpath.mjs':
    `
    import 'any-package/any-module.mjs';
    `,
    'any-package-importer-without-subpath.mjs':
    `
    import 'any-package';
    `,
    'any.js':
    `
    `,
    'cjs':
    {
        'module.js':
        `
        module.exports = 'CommonJS module';
        `,
        'package.json':
        `
        {
            "type": "commonjs"
        }
        `,
    },
    'cjs-any-importer.cjs':
    `
    module.exports =
    async () =>
    {
        const { default: import0 } = await import('../../import0.js');

        await import0('./any.js');
    };
    `,
    'cjs-capext-module.CJS':
    `
    module.exports = 'CommonJS module';
    `,
    'cjs-exports-module.cjs':
    `
    exports.ext     = 'Extended export';
    exports.default = 'Default export';
    exports.aux     = 'Auxiliary export';
    `,
    'cjs-module.cjs':
    `
    module.exports = 'CommonJS module';
    `,
    'cjs-no-exports-module.cjs':
    `
    `,
    'cjs-vars-module.cjs':
    `
    exports.this        = this;
    exports.exports     = exports;
    exports.require     = require;
    exports.module      = module;
    exports.__filename  = __filename;
    exports.__dirname   = __dirname;
    `,
    'dir-any.js': { },
    'es-module.mjs':
    `
    export default 'ES module';

    const meta = import.meta;

    export { meta };
    `,
    'esm':
    {
        'dir-package-json':
        {
            'module.js':
            `
            export default 'ES module';
            `,
            'package.json': { },
        },
        'module.js':
        `
        export default 'ES module';
        `,
        'package.json':
        `
        {
            "type": "module"
        }
        `,
    },
    'invalid':
    {
        'any.js':
        `
        `,
        'package.json':
        `
        ?
        `,
    },
    'node_modules':
    {
        'any-package':
        {
            'any-module.mjs':
            `
            export default 'ES module';
            `,
            'index.js':
            `
            module.exports = 'CommonJS module';
            `,
            'package.json':
            `
            {}
            `,
        },
        'module.js':
        `
        module.exports = 'CommonJS module';
        `,
        'package-with-main':
        {
            'main-dir':
            {
                'index.js':
                `
                module.exports = 'CommonJS module';
                `,
            },
            'package.json':
            `
            {
                "main": "main-dir"
            }
            `,
        },
        'package.json':
        `
        {
            "type": "module"
        }
        `,
    },
    'package-with-main-importer.mjs':
    `
    import 'package-with-main';
    `,
};

const { mkdir, rm, writeFile } = fsPromises;

async function makeObject(path, data)
{
    const dataType = typeof data;
    if (dataType === 'string')
    {
        const content = unindent(data);
        await writeFile(path, content);
    }
    else if (dataType === 'object')
    {
        await mkdir(path);
        const promises = [];
        for (const name in data)
        {
            const subPath = join(path, name);
            const subData = data[name];
            const promise = makeObject(subPath, subData);
            promises.push(promise);
        }
        await Promise.all(promises);
    }
}

function unindent(str)
{
    const lines = str.split('\n');
    let indent = Infinity;
    for (const line of lines)
    {
        const index = line.search(/[^ ]/);
        if (index >= 0 && index < indent)
            indent = index;
    }
    const unindentedLines = lines.map(line => line.substring(indent));
    if (unindentedLines[0] === '')
        unindentedLines.shift();
    const content = unindentedLines.join('\n');
    return content;
}

{
    const testFolder = dirname(fileURLToPath(import.meta.url));
    const path = join(testFolder, 'fixtures');
    await rm(path, { force: true, recursive: true });
    await makeObject(path, FIXTURES);
}
