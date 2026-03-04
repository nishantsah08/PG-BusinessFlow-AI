import '@testing-library/jest-dom';

// jsdom doesn't support ResizeObserver
class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
}
window.ResizeObserver = ResizeObserver;
window.HTMLElement.prototype.scrollIntoView = function () { };

// jsdom doesn't support TextEncoder/TextDecoder out of the box
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
