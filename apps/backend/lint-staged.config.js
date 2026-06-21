import baseConfig from '../../lint-staged.config.js';

/** @type {import('lint-staged').Configuration} */
const config = {
  ...baseConfig,
  '**/*.ts': [() => 'pnpm run lint:js', () => 'pnpm run lint:types']
};

export default config;
