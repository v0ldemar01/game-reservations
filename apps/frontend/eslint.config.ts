import { type Linter } from 'eslint';
import globals from 'globals';

import baseConfig from '../../eslint.config.js';

const ignoresConfig = {
  ignores: ['dist', 'coverage']
} satisfies Linter.Config;

const reactConfig: Linter.Config[] = [
  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        project: './tsconfig.json'
      }
    },
    rules: {
      // React components use default exports
      'import/no-default-export': ['off'],
      // Vite handles extensionless TypeScript imports
      'import/extensions': ['off'],
      // JSX return types are inferred reliably — not required for .tsx files
      '@typescript-eslint/explicit-function-return-type': ['off'],
      // Remove ExportNamedDeclaration restriction: React components use inline exports.
      // Use [declaration=null] to only ban re-export form (export type { X } from '...'),
      // allowing export interface and export type X = ... declarations.
      'no-restricted-syntax': [
        'error',
        {
          message: 'Export/Import all (*) is forbidden.',
          selector: 'ExportAllDeclaration,ImportAllDeclaration'
        },
        {
          message: 'TS enum declarations are forbidden.',
          selector: 'TSEnumDeclaration'
        },
        {
          message:
            "Avoid import/export type { Type } from './module'. Prefer import/export { type Type } from './module'.",
          selector:
            'ImportDeclaration[importKind=type],ExportNamedDeclaration[exportKind=type][declaration=null]'
        }
      ],
      // Allow common React / domain abbreviations
      'unicorn/prevent-abbreviations': [
        'error',
        {
          allowList: {
            args: true,
            ctx: true,
            fn: true,
            params: true,
            prop: true,
            props: true,
            ref: true,
            req: true,
            res: true
          }
        }
      ]
    }
  },
  {
    files: ['eslint.config.ts', 'vite.config.ts'],
    rules: {
      '@typescript-eslint/no-magic-numbers': ['off'],
      'import/no-default-export': ['off']
    }
  },
  {
    // env.d.ts uses Vite-mandated names (ImportMetaEnv, env) that can't be renamed
    files: ['src/env.d.ts'],
    rules: {
      'unicorn/prevent-abbreviations': ['off'],
      'perfectionist/sort-modules': ['off']
    }
  }
];

const config = [
  ...baseConfig,
  ignoresConfig,
  ...reactConfig
] satisfies Linter.Config[];

export default config;
