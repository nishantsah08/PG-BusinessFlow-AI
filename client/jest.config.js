export default {
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    transform: {
        '^.+\\.(js|jsx)$': 'babel-jest',
    },
    moduleNameMapper: {
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
        '^lucide-react$': '<rootDir>/__mocks__/lucide-react.js'
    },
    testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
};
