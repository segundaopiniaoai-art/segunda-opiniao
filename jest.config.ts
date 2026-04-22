import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const isIntegration = process.env.INTEGRATION === 'true'

const config: Config = {
  testEnvironment: 'node',
  globalSetup: '<rootDir>/jest.global-setup.ts',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: isIntegration
    ? ['**/__tests__/auth.integration.test.ts']
    : ['**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: isIntegration
    ? ['/node_modules/']
    : ['/node_modules/', '<rootDir>/__tests__/auth.integration.test.ts'],
}

export default createJestConfig(config)
