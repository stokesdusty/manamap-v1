import type { Config } from 'jest';

const config: Config = {
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@manamap/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^expo-server-sdk$': '<rootDir>/src/__mocks__/expo-server-sdk.ts',
  },
  clearMocks: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/**/*.controller.ts',
    '!src/prisma/prisma.service.ts',
  ],
};

export default config;
