import { baseConfig } from '@packages/eslint-config'

export default [
  ...baseConfig,
  {
    ignores: ['**/*.d.ts'],
  },
]
