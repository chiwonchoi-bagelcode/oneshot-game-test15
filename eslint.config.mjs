// Static checks for the game, editor and tools. npx eslint .
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['out/**', 'node_modules/**', '.cache/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'editor/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.browser, __DEV__: 'readonly' } },
    rules: { 'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }], 'no-empty': ['error', { allowEmptyCatch: true }] },
  },
  {
    files: ['tools/**/*.mjs', 'tools/**/*.js', 'eslint.config.mjs'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.node, ...globals.browser } },
    rules: { 'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }], 'no-empty': ['error', { allowEmptyCatch: true }] },
  },
];
