const React = require("react"); module.exports = new Proxy({}, { get: function getter(target, key) { return () => React.createElement("svg", { "data-testid": key }); } });
