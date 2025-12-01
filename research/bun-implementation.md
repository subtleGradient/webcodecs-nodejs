# Bun WebCodecs Implementation: Follow-up Research Tasks

This document outlines the research tasks needed to implement WebCodecs in Bun.

> **Parent document**: [WebCodecs Overview](./webcodecs-overview.md)

---

## Overview

Bun's use of JavaScriptCore (from WebKit) gives it a unique advantage: WebKit already has WebCodecs implementations that Bun might be able to leverage. The main challenge is wiring up the media backend outside of a browser environment.

---

## Research Tasks

### 1. WebKit WebCodecs Status Assessment

**Goal**: Understand the current state of WebCodecs in WebKit and what Bun can leverage.

**Tasks**:
- [ ] Review WebKit's WebCodecs implementation status:
  - https://webkit.org/status/
  - WebKit Bugzilla for WebCodecs
- [ ] Identify which WebCodecs classes are implemented:
  - [ ] `VideoDecoder`
  - [ ] `VideoEncoder`
  - [ ] `AudioDecoder`
  - [ ] `AudioEncoder`
  - [ ] `VideoFrame`
  - [ ] `AudioData`
  - [ ] `ImageDecoder`
- [ ] Analyze WebKit's WebCodecs dependencies:
  - Platform abstraction layer requirements
  - Media framework expectations
- [ ] Check which WebKit features Bun currently exposes

**Deliverables**:
- WebKit WebCodecs status document
- Dependency analysis
- Gap assessment for Bun integration

---

### 2. Bun's JavaScriptCore Integration Analysis

**Goal**: Understand how Bun integrates with JavaScriptCore and exposes Web APIs.

**Tasks**:
- [ ] Study Bun's JSC integration layer
- [ ] Analyze how Bun exposes existing Web APIs:
  - `fetch`
  - `WebSocket`
  - `crypto`
- [ ] Document the pattern for adding new global classes
- [ ] Identify how Bun handles APIs that need native backends
- [ ] Review Bun's Zig/C++ bridging layer

**Deliverables**:
- Bun JSC integration guide
- Pattern documentation for new APIs
- Architecture diagram

---

### 3. Media Backend Requirements

**Goal**: Define what media backends are needed on each platform.

**Tasks**:
- [ ] Research WebKit's media backend expectations:
  - **macOS**: AVFoundation, VideoToolbox
  - **Linux**: GStreamer, or custom backend
  - **Windows**: Media Foundation
- [ ] Evaluate which backends are available/feasible for Bun:
  - macOS: Likely straightforward (AVFoundation)
  - Linux: GStreamer vs FFmpeg decision
  - Windows: Media Foundation integration complexity
- [ ] Document codec availability per backend
- [ ] Assess hardware acceleration support

**Deliverables**:
- Platform backend matrix
- Codec availability by platform
- Recommended backend per platform

---

### 4. macOS Implementation Path

**Goal**: Implement WebCodecs on macOS first (easiest path).

**Tasks**:
- [ ] Enable WebKit's WebCodecs feature flags
- [ ] Wire AVFoundation/VideoToolbox to Bun's build
- [ ] Test basic VideoDecoder functionality
- [ ] Handle differences between Safari and Bun environments:
  - No render targets
  - No window/display
  - Different security model
- [ ] Implement VideoFrame pixel buffer handling

**Deliverables**:
- Working macOS implementation
- Test suite for macOS
- Performance benchmarks vs Safari

---

### 5. Linux Implementation Path

**Goal**: Implement WebCodecs on Linux.

**Tasks**:
- [ ] Choose media backend approach:
  - **Option A**: GStreamer (WebKit's typical Linux backend)
  - **Option B**: FFmpeg (more common in server environments)
  - **Option C**: Custom minimal backend
- [ ] Implement chosen backend integration
- [ ] Handle Linux codec fragmentation:
  - Different distros have different codecs
  - Some codecs require extra packages
- [ ] Test on common Linux environments:
  - Ubuntu/Debian
  - Alpine (musl)
  - Container environments

**Deliverables**:
- Working Linux implementation
- Distribution guide for Linux
- Container deployment guide

---

### 6. Windows Implementation Path

**Goal**: Implement WebCodecs on Windows.

**Tasks**:
- [ ] Evaluate Media Foundation integration
- [ ] Handle COM initialization in Bun's environment
- [ ] Test with common Windows codecs
- [ ] Consider Windows Subsystem for Linux as alternative

**Deliverables**:
- Working Windows implementation
- Windows-specific test suite
- Installation requirements

---

### 7. API Surface Verification

**Goal**: Ensure Bun's WebCodecs API matches the spec and browsers.

**Tasks**:
- [ ] Compare exposed API with Chrome/Safari implementations
- [ ] Verify all methods are available:
  - `configure()`, `decode()`, `encode()`
  - `flush()`, `reset()`, `close()`
  - `isConfigSupported()` (static)
- [ ] Test error semantics match browser behavior
- [ ] Verify callback/event patterns
- [ ] Check TypeScript types match

**Deliverables**:
- API compatibility report
- Type definition verification
- Browser comparison test results

---

### 8. Feature Flag and Runtime Detection

**Goal**: Implement proper feature detection and graceful fallbacks.

**Tasks**:
- [ ] Add Bun feature flags for WebCodecs
- [ ] Implement runtime codec detection:
  - Available codecs on current system
  - Hardware acceleration availability
- [ ] Design graceful degradation:
  - Missing codecs → clear error
  - No hardware accel → software fallback
- [ ] Expose feature detection to users

**Deliverables**:
- Feature flag implementation
- `Bun.supports.webcodecs` or similar API
- Documentation for feature detection

---

### 9. VideoFrame and GPU Integration

**Goal**: Handle VideoFrame objects properly outside a browser context.

**Tasks**:
- [ ] Implement VideoFrame without display targets
- [ ] Handle different pixel formats:
  - I420, NV12, RGBA, etc.
- [ ] Consider GPU memory integration:
  - Metal on macOS
  - Vulkan on Linux
  - DirectX on Windows
- [ ] Implement efficient copyTo() methods
- [ ] Handle texture-backed frames if needed

**Deliverables**:
- VideoFrame implementation
- Pixel format support matrix
- GPU memory handling (if feasible)

---

### 10. Testing and Compatibility

**Goal**: Ensure broad compatibility and spec compliance.

**Tasks**:
- [ ] Run Web Platform Tests (WPT) for WebCodecs
- [ ] Create Bun-specific test suite
- [ ] Test interoperability:
  - Bun encodes → Browser decodes
  - Browser encodes → Bun decodes
- [ ] Stress testing:
  - High throughput
  - Large resolutions
  - Memory pressure
- [ ] Integration with Bun's existing test infrastructure

**Deliverables**:
- WPT integration
- Test suite
- Interoperability verification

---

### 11. Bundling and Distribution

**Goal**: Define how WebCodecs adds to Bun's binary.

**Tasks**:
- [ ] Measure binary size impact of WebCodecs
- [ ] Consider optional/plugin approach if too large
- [ ] Handle codec library distribution:
  - Static linking
  - System dependencies
  - Bundled libraries
- [ ] Document installation requirements per platform
- [ ] Test in various deployment scenarios

**Deliverables**:
- Binary size analysis
- Distribution strategy
- Installation documentation

---

## Priority Order

Bun's unique advantage suggests this priority:

1. **Phase 1** (1-2 weeks):
   - Tasks 1-2 (WebKit status + Bun integration analysis)
   - Determine feasibility of WebKit leverage

2. **Phase 2** (2-4 weeks):
   - Tasks 3-4 (Backend requirements + macOS implementation)
   - Get proof-of-concept working on macOS

3. **Phase 3** (4-6 weeks):
   - Task 5 (Linux implementation)
   - Most server workloads are Linux

4. **Phase 4** (6-8 weeks):
   - Tasks 6-9 (Windows + API verification + Features)
   - Polish and complete coverage

5. **Phase 5**:
   - Tasks 10-11 (Testing + Distribution)
   - Production readiness

---

## Key Advantage

Bun's WebKit base means:
- **Less API work**: WebCodecs classes may already exist in JSC
- **Spec compliance**: WebKit's implementation follows the spec
- **Main effort**: Wiring media backends, not implementing APIs

If WebKit's WebCodecs is mature, Bun could be the **first server runtime** with WebCodecs support, requiring primarily platform integration work rather than full implementation.

---

## Related Documents

- [WebCodecs Overview](./webcodecs-overview.md)
- [Implementation Options](./options.md)
- [Node.js Implementation Tasks](./nodejs-implementation.md)
- [Deno Implementation Tasks](./deno-implementation.md)
