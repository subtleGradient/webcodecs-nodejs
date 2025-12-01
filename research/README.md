# WebCodecs Research

This directory contains research documentation for implementing WebCodecs across different JavaScript runtimes.

## Documents

### Overview

- **[webcodecs-overview.md](./webcodecs-overview.md)** - Comprehensive analysis of what it takes to implement WebCodecs in Node.js, Deno, and Bun. Covers browser vs. server implementations, core challenges, and feasibility assessment.

- **[options.md](./options.md)** - Technical comparison of implementation approaches (FFmpeg, WebAssembly, browser ports, Rust-based, etc.) with effort estimates and recommendations.

### Runtime-Specific Implementation Tasks

Each runtime has unique characteristics and optimal implementation paths:

- **[nodejs-implementation.md](./nodejs-implementation.md)** - Follow-up research tasks for Node.js implementation via N-API bindings to FFmpeg/native codecs.

- **[deno-implementation.md](./deno-implementation.md)** - Follow-up research tasks for Deno implementation via Rust codec bindings and Deno ops.

- **[bun-implementation.md](./bun-implementation.md)** - Follow-up research tasks for Bun implementation leveraging WebKit's existing WebCodecs work.

## Quick Summary

| Runtime | Approach | Key Advantage | Primary Challenge |
|---------|----------|---------------|-------------------|
| **Node.js** | N-API + FFmpeg | Mature addon ecosystem | Threading/memory complexity |
| **Deno** | Rust + codec libs | Type-safe, clean architecture | Codec library availability |
| **Bun** | WebKit leverage | WebCodecs may already exist | Media backend wiring |

## Recommended Reading Order

1. Start with **[webcodecs-overview.md](./webcodecs-overview.md)** for context on the problem space
2. Review **[options.md](./options.md)** for technical implementation strategies
3. Dive into the runtime-specific document for your target platform

## External Resources

- [WebCodecs Specification (W3C)](https://w3c.github.io/webcodecs/)
- [MDN WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)
- [WebCodecs Node.js $10k Challenge](https://github.com/vjeux/webcodecs-nodejs-10k-challenge)
