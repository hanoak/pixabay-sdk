import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'
import eslintConfigPrettier from 'eslint-config-prettier'

export default tseslint.config(
  {
    // docs/api is TypeDoc's generated output (npm run docs:api) — browser JS
    // it ships, not source this project owns.
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'docs/api/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.node },
    },
    rules: {
      // No exception here (unlike the sibling MCP server's `allow: ['error']`):
      // this SDK's default logger is silent, and the one legitimate console.*
      // call (the opt-in createConsoleLogger()) gets a scoped
      // eslint-disable-next-line, not a blanket rule allowance.
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // Plain-JS verification scripts run directly via `node`, outside the
    // TS project — a console-logging CLI script, not library code, so
    // no-console doesn't apply here.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
)
