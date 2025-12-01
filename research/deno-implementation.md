# Deno WebCodecs Implementation: Follow-up Research Tasks

This document outlines the research tasks needed to implement WebCodecs in Deno.

> **Parent document**: [WebCodecs Overview](./webcodecs-overview.md)

---

## Overview

Deno's Rust-based architecture and commitment to web-standard APIs make it a natural fit for WebCodecs. The implementation would use Rust bindings to codec libraries, exposed through Deno's ops system.

---

## Research Tasks

### 1. Deno Ops Architecture Investigation

**Goal**: Understand Deno's extension mechanism for implementing WebCodecs.

**Tasks**:
- [ ] Study Deno's ops (deno_core) system for native extensions
- [ ] Analyze existing media-related ops in Deno (if any)
- [ ] Review how Deno implements other Web APIs:
  - `fetch`
  - `WebSocket`
  - `crypto.subtle`
- [ ] Document the async op pattern for long-running operations
- [ ] Create proof-of-concept op with basic encode/decode signature

**Deliverables**:
- Deno ops architecture document for WebCodecs
- Sample op implementation
- Integration guidelines

---

### 2. Rust Codec Library Evaluation

**Goal**: Choose the right Rust codec libraries for the implementation.

**Tasks**:
- [ ] Evaluate Rust-native codec libraries:
  - `rav1e` (AV1 encoder)
  - `dav1d` bindings (AV1 decoder)
  - `vpx-rs` (VP8/VP9)
  - `openh264-rs` (H.264)
  - `opus-rs` (Opus audio)
- [ ] Evaluate FFmpeg Rust bindings:
  - `ffmpeg-next`
  - `ffmpeg-sys-next`
  - Custom bindings
- [ ] Compare approaches:
  - Pure Rust (safer, limited codecs)
  - FFmpeg bindings (more codecs, C dependency)
  - Hybrid approach
- [ ] Test codec library performance vs native FFmpeg
- [ ] Document licensing for each library

**Deliverables**:
- Codec library comparison document
- Recommended library stack
- Performance benchmarks

---

### 3. Async Model Integration

**Goal**: Design how WebCodecs async operations integrate with Deno's async runtime.

**Tasks**:
- [ ] Study Tokio integration in Deno
- [ ] Design async encode/decode flow:
  - How to handle long-running codec operations
  - Task spawning strategy
  - Cancellation handling
- [ ] Map WebCodecs callbacks to Deno's event system
- [ ] Handle backpressure when output callbacks are slow
- [ ] Prototype basic async decode flow in Rust

**Deliverables**:
- Async model design document
- Prototype implementation
- Performance analysis

---

### 4. Memory and Resource Management

**Goal**: Design memory handling between JS and Rust layers.

**Tasks**:
- [ ] Investigate V8 ArrayBuffer integration in Deno
- [ ] Design VideoFrame/AudioData Rust representation:
  - Zero-copy access where possible
  - Integration with V8 externalized buffers
- [ ] Implement resource table management for codec instances
- [ ] Handle resource cleanup:
  - Explicit `close()` method
  - GC-triggered cleanup
  - Op abort handling
- [ ] Consider using Deno's resource system for frame handles

**Deliverables**:
- Memory management design document
- Resource table integration plan
- Implementation guidelines

---

### 5. Permission Model Integration

**Goal**: Define WebCodecs permissions within Deno's security model.

**Tasks**:
- [ ] Determine if WebCodecs needs new permissions
- [ ] Consider permissions for:
  - Hardware acceleration access
  - GPU resource usage
  - Memory allocation limits
- [ ] Design permission prompts if needed
- [ ] Integrate with Deno's permission system

**Deliverables**:
- Permission model document
- Implementation of permission checks

---

### 6. API Surface Implementation

**Goal**: Implement the full WebCodecs API surface in Deno.

**Tasks**:
- [ ] Implement TypeScript/JavaScript layer:
  - [ ] `VideoDecoder`
  - [ ] `VideoEncoder`
  - [ ] `AudioDecoder`
  - [ ] `AudioEncoder`
  - [ ] `VideoFrame`
  - [ ] `AudioData`
  - [ ] `EncodedVideoChunk`
  - [ ] `EncodedAudioChunk`
  - [ ] `ImageDecoder`
- [ ] Implement Rust ops layer for each operation
- [ ] Match browser error semantics exactly
- [ ] Add TypeScript type definitions

**Deliverables**:
- Complete API implementation
- TypeScript definitions
- API compatibility test suite

---

### 7. Codec Support Strategy

**Goal**: Define codec support and fallback strategies.

**Tasks**:
- [ ] Define initial codec support:
  - **Phase 1**: VP9, AV1, Opus (royalty-free, Rust-native)
  - **Phase 2**: H.264, AAC (via FFmpeg or system APIs)
- [ ] Implement codec detection:
  - Available Rust codecs
  - System codec availability
  - Hardware acceleration detection
- [ ] Design fallback chain:
  - Rust-native → FFmpeg → Error
- [ ] Document platform-specific codec availability

**Deliverables**:
- Codec support strategy document
- Codec detection implementation
- Platform compatibility matrix

---

### 8. System Media API Integration

**Goal**: Integrate with OS-level media APIs for hardware acceleration.

**Tasks**:
- [ ] Research OS media APIs:
  - macOS: VideoToolbox
  - Linux: VA-API, VDPAU
  - Windows: Media Foundation
- [ ] Evaluate Rust bindings for each:
  - `core-video-rs` (macOS)
  - `libva-rs` (Linux VA-API)
- [ ] Design abstraction layer for platform APIs
- [ ] Implement hardware codec detection

**Deliverables**:
- OS API integration design
- Platform abstraction implementation
- Hardware acceleration support matrix

---

### 9. Testing and Compatibility

**Goal**: Ensure spec compliance and browser interoperability.

**Tasks**:
- [ ] Set up Web Platform Tests (WPT) for WebCodecs
- [ ] Create Deno-specific test infrastructure
- [ ] Test interoperability with browsers:
  - Deno encodes → Browser decodes
  - Browser encodes → Deno decodes
- [ ] Add stress tests and edge case handling
- [ ] Integrate with Deno's existing test suite
- [ ] Test against real-world video samples

**Deliverables**:
- Test suite with WPT integration
- Interoperability test results
- CI/CD integration

---

### 10. Extension vs Core Decision

**Goal**: Determine whether WebCodecs should be a Deno extension or core feature.

**Tasks**:
- [ ] Analyze Deno team's preferences for new APIs
- [ ] Evaluate bundle size impact of different approaches:
  - Built into Deno binary
  - Separate extension/plugin
  - npm package with native deps
- [ ] Research Deno FFI for plugin approach
- [ ] Propose to Deno team and gather feedback

**Deliverables**:
- Recommendation document
- Deno team discussion/issue

---

## Priority Order

For Deno implementation, prioritize:

1. **Phase 1** (1-2 months):
   - Tasks 1-3 (Architecture + Rust codecs + Async model)
   - Focus on `ImageDecoder` and `VideoDecoder` only

2. **Phase 2** (2-3 months):
   - Tasks 4-6 (Memory + Permissions + Full API)
   - Add `VideoEncoder`, audio codecs

3. **Phase 3** (3-4 months):
   - Tasks 7-9 (Codec support + OS APIs + Testing)
   - Hardware acceleration, full codec coverage

4. **Phase 4**:
   - Task 10 (Core integration decision)
   - Long-term maintenance planning

---

## Related Documents

- [WebCodecs Overview](./webcodecs-overview.md)
- [Implementation Options](./options.md)
- [Node.js Implementation Tasks](./nodejs-implementation.md)
- [Bun Implementation Tasks](./bun-implementation.md)
