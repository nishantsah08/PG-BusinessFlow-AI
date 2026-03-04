module.exports = {
    rootDir: '../../',
    testMatch: [
        '<rootDir>/testing/masterAI/generated_tests/**/*.test.js',
        '<rootDir>/testing/masterAI/lifecycle_tests/**/*.test.js'
    ],
    testEnvironment: 'node',
    verbose: true,
    transform: {}
};
