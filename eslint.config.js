import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: [
      'apps/**/*.ts',
      'apps/**/*.tsx',
      'eval/**/*.ts',
      'scripts/**/*.ts',
      'prisma/**/*.ts',
      '*.config.ts',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
  {
    ignores: [
      'apps/server/src/generated/**',
      '**/dist/**',
      '**/node_modules/**',
    ],
  },
)
