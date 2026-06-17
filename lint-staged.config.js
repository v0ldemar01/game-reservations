/** @type {import('lint-staged').Configuration} */
const config = {
  '*': [
    () => 'pnpm run lint:editor',
    () => 'pnpm run lint:files',
    () => 'pnpm run lint:format'
  ]
};

export default config;
