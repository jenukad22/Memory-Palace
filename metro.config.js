const { getDefaultConfig } = require('expo/metro-config');

// Resolve the sql.js wasm as an asset so `import wasm from 'sql.js/dist/sql-wasm.wasm'`
// works on web (and never bundles it into the native build).
const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('wasm');
module.exports = config;
