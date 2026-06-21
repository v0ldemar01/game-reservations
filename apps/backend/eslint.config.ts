import tsPlugin from '@typescript-eslint/eslint-plugin';
import { type ESLint, type Linter } from 'eslint';
import globals from 'globals';

import baseConfig from '../../eslint.config.js';

const ignoresConfig = {
  ignores: ['dist', 'coverage', 'eslint.config.ts', 'lint-staged.config.js']
} satisfies Linter.Config;

const nestjsConfig: Linter.Config[] = [
  {
    // Limit project-aware parsing to app source — excludes eslint/lint-staged configs
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        // Required for NestJS decorator metadata emission
        emitDecoratorMetadata: true,
        project: './tsconfig.json'
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin as unknown as ESLint.Plugin
    },
    rules: {
      // NestJS uses `public` implicitly for decorated methods; `no-public` omits redundant keyword
      '@typescript-eslint/explicit-member-accessibility': [
        'error',
        { accessibility: 'no-public' }
      ],
      // @Module({}) classes are intentionally empty decorator containers
      '@typescript-eslint/no-extraneous-class': ['off'],
      // NestJS lifecycle hooks like onModuleInit return a Promise without needing async
      '@typescript-eslint/require-await': ['off'],
      // NestJS uses extensionless TypeScript imports via path aliases
      'import/extensions': ['off'],
      // NestJS resolvers use multiple @Args() decorators — allow more params
      'max-params': ['error', 5],
      // Remove ExportNamedDeclaration restriction: NestJS uses inline class exports
      'no-restricted-syntax': [
        'error',
        {
          message: 'Export all (*) is forbidden.',
          selector: 'ExportAllDeclaration'
        },
        {
          message: 'TS enum declarations are forbidden.',
          selector: 'TSEnumDeclaration'
        },
        {
          message:
            "Avoid import/export type { Type } from './module'. Prefer import/export { type Type } from './module'.",
          // :has(ExportSpecifier) excludes `export interface`/`export type X = Y` which are not re-exports
          selector:
            'ImportDeclaration[importKind=type],ExportNamedDeclaration[exportKind=type]:has(ExportSpecifier)'
        }
      ],
      // Backend targets ES2021; toSorted/toReversed are ES2023+ only
      'unicorn/no-array-sort': ['off'],
      // NestJS compiles to CommonJS; ESM-only APIs are unavailable
      'unicorn/prefer-module': ['off'],
      // Allow common NestJS / domain abbreviations
      'unicorn/prevent-abbreviations': [
        'error',
        {
          allowList: {
            args: true,
            ctx: true,
            db: true,
            dto: true,
            fn: true,
            params: true,
            props: true,
            req: true,
            res: true,
            tx: true
          }
        }
      ]
    }
  },
  {
    files: ['test/**/*.ts', 'prisma/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json'
      }
    }
  },
  {
    // Seed script: allow console, magic numbers, process.exit — it's a one-shot CLI
    files: ['prisma/**/*.ts'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': ['off'],
      '@typescript-eslint/no-magic-numbers': ['off'],
      '@typescript-eslint/no-unsafe-assignment': ['off'],
      '@typescript-eslint/no-unsafe-call': ['off'],
      '@typescript-eslint/no-unsafe-member-access': ['off'],
      '@typescript-eslint/no-unsafe-return': ['off'],
      '@typescript-eslint/use-unknown-in-catch-callback-variable': ['off'],
      'no-console': ['off'],
      'sonarjs/pseudo-random': ['off'],
      'unicorn/no-process-exit': ['off'],
      'unicorn/prefer-top-level-await': ['off']
    }
  },
  {
    files: ['**/*.spec.ts', 'test/**/*.ts'],
    languageOptions: {
      globals: globals.jest
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': ['off'],
      '@typescript-eslint/no-floating-promises': ['off'],
      '@typescript-eslint/no-magic-numbers': ['off'],
      '@typescript-eslint/no-non-null-assertion': ['off'],
      '@typescript-eslint/no-unsafe-assignment': ['off'],
      '@typescript-eslint/no-unsafe-call': ['off'],
      '@typescript-eslint/no-unsafe-member-access': ['off'],
      '@typescript-eslint/no-unsafe-return': ['off'],
      '@typescript-eslint/unbound-method': ['off'],
      '@typescript-eslint/use-unknown-in-catch-callback-variable': ['off'],
      'sonarjs/no-duplicate-string': ['off'],
      // jest mocks often require explicit `undefined` to satisfy generic type constraints
      'unicorn/no-useless-undefined': ['off']
    }
  },
  {
    // main.ts uses CommonJS — top-level await is unavailable in CJS entry points
    files: ['src/main.ts'],
    rules: {
      'unicorn/prefer-top-level-await': ['off']
    }
  }
];

const config = [
  ...baseConfig,
  ignoresConfig,
  ...nestjsConfig
] satisfies Linter.Config[];

export default config;
