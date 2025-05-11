const path = require('path');
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");

module.exports = {
    entry: './src/app.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'app.js'
    },
    mode: 'production',
    target: 'node',
    resolve: {
        fallback: {
            "http": false,
            "fs": false,
            "path": require.resolve("path-browserify"),
            "os": require.resolve("os-browserify/browser")
        }
    },
    plugins: [
        new NodePolyfillPlugin()
    ]
};