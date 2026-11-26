// Lint rules: type-aware TypeScript checks, SonarJS maintainability rules, documented
// public APIs and hard size limits.
import js from '@eslint/js';
import jsdoc from 'eslint-plugin-jsdoc';
import sonarjs from 'eslint-plugin-sonarjs';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'node_modules/', '.vercel/'] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  sonarjs.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      complexity: ['error', 8],
      'max-depth': ['error', 3],
      'max-lines': ['error', { max: 200, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 30, skipBlankLines: true, skipComments: true }],
      'max-params': ['error', 3],
      'no-console': 'error',
      'no-restricted-properties': [
        'error',
        {
          property: 'innerHTML',
          message: 'Build DOM nodes from templates; never parse HTML strings.',
        },
        {
          property: 'outerHTML',
          message: 'Build DOM nodes from templates; never parse HTML strings.',
        },
      ],
      'prefer-const': 'error',
      eqeqeq: 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
    },
  },
  {
    // Every exported function, class, interface, type and constant carries a doc comment.
    files: ['src/**/*.ts', 'web/**/*.ts'],
    plugins: { jsdoc },
    rules: {
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: true,
          require: { FunctionDeclaration: true, ClassDeclaration: true },
          contexts: [
            'TSInterfaceDeclaration',
            'TSTypeAliasDeclaration',
            'ExportNamedDeclaration > VariableDeclaration',
          ],
        },
      ],
      'jsdoc/check-alignment': 'error',
      'jsdoc/check-tag-names': 'error',
      'jsdoc/empty-tags': 'error',
      'jsdoc/no-blank-blocks': 'error',
      'jsdoc/no-multi-asterisks': 'error',
      'jsdoc/no-types': 'error',
    },
  },
  {
    // Type assertions are banned in shipped code: values are narrowed or validated instead.
    // The unit constructors are the single, documented place that brands plain numbers.
    files: ['src/**/*.ts', 'web/**/*.ts'],
    ignores: ['src/domain/units.ts'],
    rules: {
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
    },
  },
  {
    files: ['test/**/*.ts'],
    rules: {
      'max-lines-per-function': 'off',
      'max-lines': ['error', { max: 250, skipBlankLines: true, skipComments: true }],
      '@typescript-eslint/no-non-null-assertion': 'off',
      'sonarjs/no-hardcoded-ip': 'off',
      'sonarjs/no-clear-text-protocols': 'off',
    },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
