import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const isIntegration = process.env.INTEGRATION === 'true'

const config: Config = {
  testEnvironment: 'node',
  globalSetup: '<rootDir>/jest.global-setup.ts',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/mastra/(.*)$': '<rootDir>/mastra/src/mastra/$1',
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: isIntegration
    ? ['**/__tests__/auth.integration.test.ts']
    : ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  testPathIgnorePatterns: isIntegration
    ? ['/node_modules/']
    : ['/node_modules/', '<rootDir>/__tests__/auth.integration.test.ts'],
}

const baseConfig = createJestConfig(config)

export default async () => {
  const resolved = await baseConfig()
  // next/jest's transformIgnorePatterns doesn't know about mastra's ESM deps.
  // Inject tokenx into the existing exception list so it gets transformed.
  resolved.transformIgnorePatterns = resolved.transformIgnorePatterns?.map((p: string) =>
    p.includes('(?!(geist|') ? p.replace('(?!(geist|', '(?!(tokenx|geist|') : p,
  )
  return resolved
}
