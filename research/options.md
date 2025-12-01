# WebCodecs Implementation Options for Node.js

This document explores various approaches to implementing the WebCodecs API in Node.js, based on research of existing implementations and related projects.

> **See also**: 
> - [Node.js Linux N-API + FFmpeg Research](./nodejs-linux-napi-ffmpeg.md) for detailed architecture and implementation guidance for the FFmpeg approach on Linux.
> - **NEW**: [FFmpeg N-API Bindings Research](./ffmpeg-napi.md) for existing N-API bindings that can accelerate development.

## Overview

The WebCodecs API provides low-level access to media encoders and decoders. Implementing it in Node.js requires bridging JavaScript to native codec libraries.

## Implementation Options

### Option 1: FFmpeg via N-API (From Scratch)

**Description**: Create Node.js native bindings to FFmpeg's libavcodec, libavformat, and related libraries from scratch.

> 📖 **Detailed research available**: [Node.js Linux N-API + FFmpeg Research](./nodejs-linux-napi-ffmpeg.md) covers architecture, threading, memory management, codec mapping, licensing, and distribution for this approach.

**Approach**:
1. Use Node.js N-API to create native bindings
2. Wrap libavcodec encode/decode functions
3. Handle memory management between JS and native code
4. Map WebCodecs API surface to FFmpeg functions

**Pros**:
- FFmpeg is the industry standard, supporting virtually all codecs
- Hardware acceleration available (NVENC, VAAPI, VideoToolbox, etc.)
- Battle-tested, production-ready codec implementations
- Active maintenance and community support

**Cons**:
- Complex build process (FFmpeg compilation)
- Platform-specific build requirements
- Memory management complexity between JS and C
- Large dependency footprint

**Effort Estimate**: Medium-High

**Key Files/References**:
- FFmpeg libavcodec: https://github.com/FFmpeg/FFmpeg/tree/master/libavcodec
- Node.js N-API: https://nodejs.org/api/n-api.html
- Similar projects: node-ffmpeg-bindings, fluent-ffmpeg

---

### Option 1b: Existing FFmpeg N-API Bindings + WebCodecs Shim ⭐ NEW

**Description**: Use an existing, production-ready FFmpeg N-API binding (such as node-av) and build a thin WebCodecs-compliant adapter layer on top.

> 📖 **Detailed research available**: [FFmpeg N-API Bindings Research](./ffmpeg-napi.md) covers available libraries, comparison, and recommended approach.

**Approach**:
1. Select an existing FFmpeg N-API library (recommended: node-av)
2. Build WebCodecs-compliant TypeScript classes (`VideoDecoder`, `VideoEncoder`, etc.)
3. Map WebCodecs API calls to the underlying library's API
4. Implement WebCodecs state machine and error semantics in the adapter layer

**Pros**:
- **Avoids the largest yak**: raw FFmpeg + N-API integration already done
- Prebuilt binaries available for all major platforms
- Hardware acceleration support (node-av supports CUDA, VAAPI)
- Full TypeScript support with modern async patterns
- Significant time savings (estimated 2-3 weeks)
- Battle-tested FFmpeg integration

**Cons**:
- Dependent on third-party library maintenance
- May have semantic gaps requiring workarounds
- Less control over low-level behavior
- Need to map between two different APIs

**Effort Estimate**: **Low-Medium** (significantly lower than from-scratch)

**Key Libraries**:
- **node-av (recommended)**: [seydx/node-av](https://github.com/seydx/node-av) — Best combination of features, prebuilds, and HW accel
- **@mmomtchev/ffmpeg**: [mmomtchev/ffmpeg](https://github.com/mmomtchev/ffmpeg) — Streams-based API, good if you prefer that model

**Recommended Next Steps**:
- [Evaluate FFmpeg N-API Bindings](../tasks/evaluate-ffmpeg-napi-bindings.md)
- [VideoDecoder Shim on node-av](../tasks/videodecoder-shim-node-av.md)

---

### Option 2: WebKit/Chromium Port

**Description**: Extract the WebCodecs implementation from WebKit or Chromium and adapt it for standalone use.

**Approach**:
1. Identify WebCodecs-related source files in browser codebase
2. Extract and decouple from browser-specific dependencies
3. Create JavaScript bindings using V8 or Node-API
4. Port platform abstraction layer for Node.js

**Pros**:
- Spec-compliant implementation
- Already handles edge cases and error handling
- Consistent behavior with browser

**Cons**:
- Massive browser codebase to navigate
- Many internal dependencies to untangle
- Significant porting effort required
- Ongoing maintenance burden

**Effort Estimate**: Very High

**Key Files/References**:
- Chromium WebCodecs: https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/modules/webcodecs/
- WebKit WebCodecs: https://trac.webkit.org/browser/trunk/Source/WebCore/Modules/webcodecs

---

### Option 3: Bun-Style Integration

**Description**: Port WebCodecs similar to how Bun handles Web APIs - using JavaScriptCore bindings or adapting existing patterns.

**Approach**:
1. Study Bun's approach to web API implementation
2. Leverage Bun's native binding patterns
3. Potentially use Bun's existing media handling code
4. Focus on runtime-level integration

**Pros**:
- Modern, clean architecture
- Designed for server-side use
- Active development community

**Cons**:
- May require running on Bun instead of Node.js
- Bun-specific implementation patterns
- Potential compatibility issues with Node.js ecosystem

**Effort Estimate**: Medium (if targeting Bun) / High (if adapting for Node.js)

**Key Files/References**:
- Bun repository: https://github.com/oven-sh/bun
- Bun's web API implementations in src/bun.js/

---

### Option 4: WebAssembly Codecs

**Description**: Use WebAssembly-compiled codecs (like libav.js) to run codecs in Node.js.

**Approach**:
1. Use existing WASM codec compilations (ffmpeg.wasm, libav.js)
2. Wrap with WebCodecs-compliant JavaScript API
3. Handle data transfer between JS and WASM efficiently

**Pros**:
- Portable across platforms
- No native compilation required
- Consistent behavior across environments
- Existing implementations available (libavjs-webcodecs-polyfill)

**Cons**:
- Performance overhead compared to native
- Limited hardware acceleration
- Memory constraints of WASM
- Larger binary size

**Effort Estimate**: Low-Medium

**Key Files/References**:
- libavjs-webcodecs-polyfill: https://github.com/nickolasbraun/libavjs-webcodecs-polyfill
- ffmpeg.wasm: https://github.com/nickolasbraun/ffmpeg.wasm
- libav.js: https://github.com/nickolasbraun/libav.js

---

### Option 5: Hybrid Approach

**Description**: Combine multiple approaches - use WASM as fallback, with optional native acceleration.

**Approach**:
1. Implement base functionality using WASM codecs
2. Detect and use native codecs when available
3. Provide N-API bindings as optional native add-on
4. Fall back gracefully based on environment

**Pros**:
- Works everywhere (WASM fallback)
- Optimal performance when native available
- Flexible deployment options

**Cons**:
- More complex implementation
- Multiple code paths to maintain
- Testing complexity

**Effort Estimate**: High

---

### Option 6: Rust-Based Implementation

**Description**: Implement WebCodecs in Rust with Node.js bindings via napi-rs.

**Approach**:
1. Use Rust codec libraries (e.g., rav1e, vpx-rs)
2. Create napi-rs bindings for Node.js
3. Leverage Rust's memory safety
4. Cross-compile for multiple platforms

**Pros**:
- Memory safety guarantees
- Growing Rust media ecosystem
- Good cross-platform support via napi-rs
- Modern tooling (cargo)

**Cons**:
- Rust learning curve
- Fewer codec libraries than C/C++
- Compilation times

**Effort Estimate**: Medium-High

**Key Files/References**:
- napi-rs: https://napi.rs/
- rav1e (AV1 encoder): https://github.com/xiph/rav1e
- Firefox WebCodecs uses Rust

---

## Implementation Priority Matrix

| Option | Effort | Performance | Portability | Maintenance |
|--------|--------|-------------|-------------|-------------|
| **FFmpeg N-API Bindings + Shim** ⭐ | **Low-Medium** | **Excellent** | **Good** | **Low** |
| FFmpeg N-API (from scratch) | High | Excellent | Medium | Medium |
| Browser Port | Very High | Excellent | Low | High |
| Bun-Style | Medium | Good | Low | Medium |
| WASM | Low | Medium | Excellent | Low |
| Hybrid | High | Excellent | Excellent | High |
| Rust | Medium-High | Very Good | Good | Medium |

## Recommended Approach

For the $10k challenge timeline (1 month), we recommend:

### ⭐ NEW: Fastest Path — Existing N-API Bindings + WebCodecs Shim

Based on the discovery of existing production-ready FFmpeg N-API bindings (see [FFmpeg N-API Bindings Research](./ffmpeg-napi.md)), the fastest path is now:

**Week 1: Foundation**
1. Evaluate node-av and @mmomtchev/ffmpeg ([Evaluate FFmpeg N-API Bindings](../tasks/evaluate-ffmpeg-napi-bindings.md))
2. Select the best candidate (likely node-av)
3. Build VideoDecoder shim ([VideoDecoder Shim on node-av](../tasks/videodecoder-shim-node-av.md))

**Week 2: Core Classes**
1. Complete VideoDecoder with state machine, error handling
2. Build VideoEncoder shim
3. Implement VideoFrame and EncodedVideoChunk wrappers

**Week 3-4: Polish + Testing**
1. Add AudioDecoder, AudioEncoder shims
2. Run WPT test subset
3. Implement isConfigSupported() accurately
4. Documentation and examples

This approach can save **2-3 weeks** compared to building raw N-API bindings from scratch.

### Alternative: WASM + Native Hybrid (Original Recommendation)

If the N-API binding approach hits blockers, fall back to:

#### Phase 1: Quick Start with WASM (Week 1-2)
1. Use libavjs-webcodecs-polyfill as a starting point
2. Adapt for Node.js environment
3. Get tests passing with basic functionality

#### Phase 2: Optimize with Native Bindings (Week 3-4)
1. Add FFmpeg N-API bindings for performance-critical codecs (VP8, H.264)
2. Use WASM as fallback
3. Implement hardware acceleration detection

### Future Work
- Full codec coverage
- Hardware acceleration
- Streaming support
- React Native compatibility

## Related Projects to Study

1. **Remotion** - Uses WebCodecs for server-side video rendering
2. **Mediabunny** - High-level video editing on WebCodecs
3. **Effect-TS** - Functional patterns for async operations
4. **libavjs-webcodecs-polyfill** - Pure JS WebCodecs polyfill
5. **node-av** ⭐ NEW - Production-ready FFmpeg N-API bindings with HW accel
6. **@mmomtchev/ffmpeg** ⭐ NEW - FFmpeg bindings with Node.js Streams API

## Conclusion

**Updated recommendation**: The most practical approach for rapid development is now to leverage existing FFmpeg N-API bindings (Option 1b) and build a WebCodecs shim layer on top:

1. **Fastest time to working code** — Skip raw N-API development
2. **Production-ready FFmpeg integration** — Already battle-tested
3. **Hardware acceleration included** — node-av supports CUDA, VAAPI
4. **Excellent performance** — Native FFmpeg, not WASM
5. **Lower risk** — Smaller codebase to maintain

If the N-API binding approach encounters blockers, the WASM approach (Option 4) remains a viable fallback that can get basic functionality working within days.
