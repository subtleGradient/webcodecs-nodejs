/**
 * Vitest setup file for Node.js environment
 * 
 * This file is loaded before tests run to set up the WebCodecs polyfill
 * in the Node.js environment.
 */

// Import the polyfill - it auto-installs on globalThis in Node.js
import '../src/index.js';
