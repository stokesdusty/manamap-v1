import type { Config } from 'jest';

const config: Config = {
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@manamap/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
  clearMocks: true,
};

export default config;
