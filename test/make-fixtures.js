#!/usr/bin/env node

import { mkdir, rm, symlink, writeFile }    from 'fs/promises';
import { dirname, join }                    from 'path';
import { fileURLToPath }                    from 'url';

function SymLink(target)
{
    const thisValue = new.target ? this : Object.create(SymLink.prototype);
    thisValue.target = target;
    return thisValue;
}

const FIXTURES =
{
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
        const { default: import0 } = await import('import0');

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
    'cjs-module.js':
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
    'dir-package-json-dir':
    {
        'module.js':
        `
        export default 'ES module';
        `,
        'package.json': { },
    },
    'es-module.mjs':
    `
    export default 'ES module';

    const meta = import.meta;
    const thisValue = this;

    export { meta, thisValue };
    `,
    'esm':
    {
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
    'imports-exports':
    {
        'cjs-module.cjs':
        `
        module.exports = 'CommonJS module';
        `,
        'es-module.mjs':
        `
        export default 'ES module';
        `,
        'module-importer.cjs':
        `
        module.exports = specifier => import(specifier);
        `,
        'module-importer.mjs':
        `
        export default specifier => import(specifier);
        `,
        'module-requirer.cjs':
        `
        module.exports = require;
        `,
        'package.json':
        `
        {
            "name": "imports-exports",
            "exports":
            {
                ".":
                {
                    "import": "./es-module.mjs",
                    "require": "./cjs-module.cjs"
                }
            },
            "imports":
            {
                "#test":
                {
                    "import": "./es-module.mjs",
                    "require": "./cjs-module.cjs"
                }
            }
        }
        `,
    },
    'invalid-package-json-dir':
    {
        'any.js':
        `
        `,
        'package.json':
        `
        ?
        `,
    },
    'module-importer.mjs':
    `
    export default specifier => import(specifier);
    `,
    'multi-module-importer.mjs':
    `
    export default
    (...specifiers) => Promise.allSettled(specifiers.map(specifier => import(specifier)));
    `,
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
        'package-with-missing-main':
        {
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
    'null-package-json-dir':
    {
        'any.js':
        `
        `,
        'package.json':
        `
        null
        `,
    },
    'self-link-package-json-dir':
    {
        'module.js':
        `
        export default 'ES module';
        `,
        'package.json': SymLink('package.json'),
    },
    'self-link.js': SymLink('self-link.js'),
};

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
        if (data instanceof SymLink)
        {
            const { target } = data;
            await symlink(target, path);
        }
        else
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
