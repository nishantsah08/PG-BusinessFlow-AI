import '@testing-library/jest-dom';

// jsdom doesn't support ResizeObserver
class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
}
window.ResizeObserver = ResizeObserver;
window.HTMLElement.prototype.scrollIntoView = function () { };
