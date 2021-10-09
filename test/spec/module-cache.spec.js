/* eslint-env ebdd/ebdd */

import assert                       from 'assert/strict';
import { isModuleNamespaceObject }  from 'util/types';

const MULTI_MODULE_IMPORTER_URL = '../fixtures/multi-module-importer.mjs';

describe
(
    'Caching',
    () =>
    {
        let import0;

        before
        (
            async () =>
            {
                ({ default: import0 } = await import('import0'));
            },
        );

        it.per
        (
            [
                { name: 'builtin',  specifier1: 'fs',               specifier2: 'node:fs' },
                { name: 'CommonJS', specifier1: './cjs/module.js',  specifier2: './cjs/module.js' },
                { name: 'ES',       specifier1: './esm/module.js',  specifier2: './esm/module.js' },
            ],
        )
        (
            '#.name module',
            async ({ specifier1, specifier2 }) =>
            {
                const { default: importer } = await import0(MULTI_MODULE_IMPORTER_URL);
                const [{ value: namespace1 }, { value: namespace2 }] =
                await importer(specifier1, specifier2);
                assert(isModuleNamespaceObject(namespace1));
                assert.equal(namespace1, namespace2);
            },
        );

        it
        (
            'modules with the same path but different URLs',
            async () =>
            {
                const specifier1 = './any.js#1';
                const specifier2 = './any.js#2';
                const { default: importer } = await import0(MULTI_MODULE_IMPORTER_URL);
                const [{ value: namespace1 }, { value: namespace2 }] =
                await importer(specifier1, specifier2);
                assert.notEqual(namespace1, namespace2);
            },
        );

        it
        (
            'invalid package configuration',
            async () =>
            {
                const specifier1 = './invalid-package-json-dir/any.js#1';
                const specifier2 = './invalid-package-json-dir/any.js#2';
                const { default: importer } = await import0(MULTI_MODULE_IMPORTER_URL);
                const [{ reason: error1 }, { reason: error2 }] =
                await importer(specifier1, specifier2);
                assert.notEqual(error1, error2);
                assert.strictEqual(error1.code, 'ERR_INVALID_PACKAGE_CONFIG');
                assert.strictEqual(error2.code, 'ERR_INVALID_PACKAGE_CONFIG');
                assert.strictEqual(error1.specifier, specifier1);
                assert.strictEqual(error2.specifier, specifier2);
            },
        );
    },
);
