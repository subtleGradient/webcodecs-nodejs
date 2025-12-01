# Node.js WebCodecs Implementation: Follow-up Research Tasks

This document outlines the research tasks needed to implement WebCodecs in Node.js.

> **Parent document**: [WebCodecs Overview](./webcodecs-overview.md)

---

## Overview

Node.js has the most mature ecosystem for native addons and the strongest community demand (evidenced by the $10k challenge). The implementation will likely involve C++ bindings via N-API with FFmpeg or OS-level codec APIs.

---

## Research Tasks

### 1. N-API Architecture Investigation

**Goal**: Determine the optimal N-API architecture for WebCodecs bindings.

**Tasks**:
- [ ] Study existing N-API media projects (node-webrtc, node-canvas, sharp)
- [ ] Analyze how node-webrtc handles complex native objects with JS wrappers
- [ ] Document N-API patterns for:
  - Threaded async operations
  - Large buffer management
  - Object lifecycle management
- [ ] Create proof-of-concept N-API addon with basic encode/decode signature
- [ ] Benchmark N-API overhead vs direct C++ bindings

**Deliverables**:
- Architecture document for N-API WebCodecs bindings
- Sample code demonstrating chosen patterns
- Performance baseline measurements

---

### 2. FFmpeg Integration Strategy

**Goal**: Define how to integrate FFmpeg with the Node.js addon.

**Tasks**:
- [ ] Evaluate linking strategies:
  - Static linking (larger binary, simpler distribution)
  - Dynamic linking (smaller binary, system dependency)
  - Bundled prebuilt binaries per platform
- [ ] Map WebCodecs API calls to libavcodec functions:
  - `configure()` → `avcodec_open2()`
  - `decode()` → `avcodec_send_packet()` / `avcodec_receive_frame()`
  - `encode()` → `avcodec_send_frame()` / `avcodec_receive_packet()`
- [ ] Document FFmpeg licensing implications (LGPL vs GPL builds)
- [ ] Test hardware acceleration paths:
  - NVENC/NVDEC on Linux/Windows
  - VideoToolbox on macOS
  - VA-API on Linux
- [ ] Create codec string parser (`avc1.42E01E` → FFmpeg codec params)

**Deliverables**:
- FFmpeg integration design document
- Codec string mapping table
- Hardware acceleration compatibility matrix

---

### 3. Threading Model Design

**Goal**: Design the threading model for non-blocking codec operations.

**Tasks**:
- [ ] Study libuv thread pool and async handles
- [ ] Design worker thread architecture:
  - One thread per codec instance vs shared thread pool
  - Queue management for encode/decode requests
  - Callback delivery mechanism
- [ ] Handle edge cases:
  - `reset()` while operations are in-flight
  - `close()` during active decoding
  - Error propagation from worker threads
- [ ] Analyze memory implications of thread model choices
- [ ] Prototype basic async decode flow

**Deliverables**:
- Threading architecture document
- State machine diagram for codec lifecycle
- Prototype implementation

---

### 4. Memory Management Strategy

**Goal**: Design efficient memory handling between JS and native layers.

**Tasks**:
- [ ] Investigate ArrayBuffer sharing between JS and C++
- [ ] Design VideoFrame/AudioData native backing:
  - Zero-copy access where possible
  - GPU memory handles for hardware acceleration
- [ ] Implement reference counting for native resources
- [ ] Handle GC interaction:
  - Release native resources when JS objects are collected
  - Explicit `close()` method support
- [ ] Benchmark memory copy overhead for different strategies

**Deliverables**:
- Memory management design document
- Benchmark results for different approaches
- Implementation guidelines

---

### 5. API Surface Implementation

**Goal**: Implement the full WebCodecs API surface.

**Tasks**:
- [ ] Implement core classes:
  - [ ] `VideoDecoder`
  - [ ] `VideoEncoder`
  - [ ] `AudioDecoder`
  - [ ] `AudioEncoder`
  - [ ] `VideoFrame`
  - [ ] `AudioData`
  - [ ] `EncodedVideoChunk`
  - [ ] `EncodedAudioChunk`
  - [ ] `ImageDecoder`
- [ ] Implement static methods:
  - [ ] `isConfigSupported()` for all codec classes
- [ ] Match browser error semantics exactly
- [ ] Implement all event/callback patterns

**Deliverables**:
- Complete API implementation
- API compatibility test suite

---

### 6. Codec Support Matrix

**Goal**: Define which codecs to support and how.

**Tasks**:
- [ ] Prioritize codecs for initial implementation:
  - **Must have**: H.264 (AVC), VP8, VP9
  - **Should have**: H.265 (HEVC), AV1, Opus, AAC
  - **Nice to have**: VP8, Vorbis, additional audio codecs
- [ ] Map each codec to FFmpeg implementation
- [ ] Document hardware acceleration availability per codec/platform
- [ ] Implement `isConfigSupported()` accurately per platform
- [ ] Handle codec-specific configuration options

**Deliverables**:
- Codec support matrix document
- isConfigSupported() implementation per codec

---

### 7. Testing and Compatibility

**Goal**: Ensure spec compliance and browser interoperability.

**Tasks**:
- [ ] Set up Web Platform Tests (WPT) for WebCodecs
- [ ] Create round-trip interoperability tests:
  - Node encodes → Browser decodes
  - Browser encodes → Node decodes
- [ ] Add stress tests:
  - High frame rate encoding/decoding
  - Large resolution handling (4K, 8K)
  - Memory pressure scenarios
  - Rapid reset/close cycles
- [ ] Test against real-world video samples
- [ ] Integrate with CI/CD pipeline

**Deliverables**:
- Test suite with WPT integration
- Interoperability test results
- Performance benchmarks

---

### 8. Distribution Strategy

**Goal**: Define how to package and distribute the addon.

**Tasks**:
- [ ] Evaluate prebuild strategies:
  - prebuildify
  - node-pre-gyp
  - Platform-specific npm packages
- [ ] Define supported platforms:
  - Linux (x64, arm64)
  - macOS (x64, arm64)
  - Windows (x64)
- [ ] Handle FFmpeg distribution:
  - Bundle with addon
  - Require system installation
  - Hybrid approach with fallbacks
- [ ] Set up CI builds for all platforms
- [ ] Document installation requirements

**Deliverables**:
- Distribution strategy document
- CI/CD pipeline configuration
- Installation documentation

---

## Priority Order

For the $10k challenge timeline, prioritize:

1. **Week 1**: Tasks 1-2 (Architecture + FFmpeg integration)
2. **Week 2**: Tasks 3-4 (Threading + Memory)
3. **Week 3**: Task 5 (API implementation - VideoDecoder/VideoEncoder only)
4. **Week 4**: Tasks 6-7 (Codec support + Testing)

Task 8 (Distribution) can be deferred until core functionality is proven.

---

## Related Documents

- [WebCodecs Overview](./webcodecs-overview.md)
- [Implementation Options](./options.md)
- [Deno Implementation Tasks](./deno-implementation.md)
- [Bun Implementation Tasks](./bun-implementation.md)
