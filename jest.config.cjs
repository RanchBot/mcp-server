/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  ...(!process.env.CI ? { maxWorkers: 1 } : {}),
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Source imports that target compiled `.js` output (e.g. `../generated/toolContracts.js`)
  // are mapped to their TS source so the suite runs under ts-jest. `[.]` is a literal
  // dot, kept backslash-free so JS string parsing can't strip it.
  moduleNameMapper: {
    '^([.]{1,2}/.*)[.]js$': '$1',
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  verbose: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/unit/setup.jest.ts'],
  transform: {
    '^.+\\.(ts)$': [
      'ts-jest',
      {
        tsconfig: './tsconfig.json',
      },
    ],
  },
  collectCoverage: !!process.env.CI,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  collectCoverageFrom: ['src/**/*.ts'],
};
