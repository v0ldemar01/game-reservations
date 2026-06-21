/**
 * @import { Config } from "prettier";
 */

const config = /** @type {const} @satisfies {Config} */ ({
  arrowParens: 'always',
  bracketSpacing: true,
  printWidth: 80,
  quoteProps: 'preserve',
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'none',
  useTabs: false
});

export default config;
