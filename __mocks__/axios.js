const axios = {
    get: jest.fn(),
    post: jest.fn(),
    create: jest.fn(() => axios)
};

module.exports = axios;
