/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  ...(!process.env.CI ? { maxWorkers: 1 } : {}),
  preset: 'ts-jest',
  testEnvironment: 'node',
  // The server factory dispatches tools via dynamic `import('./tools/x.js')`
  // (the compiled extension). Map .js specs to their TS source so the factory
  // is exercisable under ts-jest; extension-less and non-.js imports (e.g.
  // zod's `./v3/external.cjs`) are untouched. `[.]` is a literal dot, kept
  // backslash-free so JS string parsing can't strip it.
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
