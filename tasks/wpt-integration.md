---
title: Web Platform Tests Integration
status: todo
priority: high
effort: medium
category: testing
dependencies:
  - threading-worker-loop.md
  - videoframe-memory.md
research: ../research/nodejs-linux-napi-ffmpeg.md
timeline: Week 4
---

# Web Platform Tests Integration

Set up and run WebCodecs Web Platform Tests (WPT) against the Node.js implementation.

## Objective

Import and adapt the W3C Web Platform Tests for WebCodecs to verify spec compliance and catch regressions.

## Background

From [Testing and Compatibility](../research/nodejs-linux-napi-ffmpeg.md#7-testing-and-compatibility):

> - Import WebCodecs tests from WPT.
> - Adapt them to run under Node.
> - Run in CI to catch regressions.

## Tasks

- [ ] Clone/download relevant WPT test files
- [ ] Create WPT test harness adapter for Node.js
- [ ] Implement required browser APIs as mocks:
  - [ ] `DOMException`
  - [ ] `Event` / `EventTarget`
  - [ ] `Promise` polyfills if needed
- [ ] Map WPT test assertions to Node test framework
- [ ] Run VideoDecoder WPT tests
- [ ] Run VideoEncoder WPT tests
- [ ] Run VideoFrame WPT tests
- [ ] Run EncodedVideoChunk WPT tests
- [ ] Document test coverage gaps
- [ ] Integrate WPT run into CI

## WPT Test Categories

### VideoDecoder Tests

From `webcodecs/video-decoder*.html`:
- `video-decoder-config.any.js` — Config validation
- `video-decoder-state.any.js` — State machine
- `video-decoder-flush.any.js` — Flush behavior
- `video-decoder-close.any.js` — Close behavior

### VideoEncoder Tests

From `webcodecs/video-encoder*.html`:
- `video-encoder-config.any.js` — Config validation
- `video-encoder-state.any.js` — State machine
- `video-encoder-flush.any.js` — Flush behavior

### VideoFrame Tests

From `webcodecs/video-frame*.html`:
- `video-frame-construction.any.js` — Constructor variants
- `video-frame-copyTo.any.js` — copyTo() behavior
- `video-frame-serialization.any.js` — Clone/transfer

## WPT Harness Adapter

```typescript
// wpt-harness.ts

// Import the WPT testharness.js equivalents
import { test, assert_equals, assert_throws_dom } from './wpt-assertions';

// Provide browser globals
globalThis.DOMException = class DOMException extends Error {
  constructor(message: string, name: string) {
    super(message);
    this.name = name;
  }
};

// Load the WebCodecs implementation
import { VideoDecoder, VideoEncoder, VideoFrame } from '../src';
globalThis.VideoDecoder = VideoDecoder;
globalThis.VideoEncoder = VideoEncoder;
globalThis.VideoFrame = VideoFrame;

// Run WPT test file
export function runWPTTest(testPath: string) {
  // Load and execute the WPT test
  require(testPath);
}
```

## Assertion Mapping

| WPT Assertion | Node/Vitest Equivalent |
|---------------|------------------------|
| `assert_equals(a, b)` | `expect(a).toBe(b)` |
| `assert_true(x)` | `expect(x).toBe(true)` |
| `assert_throws_dom(name, fn)` | `expect(fn).toThrow(DOMException)` |
| `promise_test(fn, name)` | `it(name, fn)` |
| `async_test(fn, name)` | `it(name, fn)` with done callback |

## Example Adapted Test

Original WPT:

```javascript
// video-decoder-config.any.js
promise_test(async t => {
  let support = await VideoDecoder.isConfigSupported({
    codec: 'vp8',
  });
  assert_true(support.supported);
}, 'VP8 config should be supported');
```

Adapted for Node:

```typescript
// tests/wpt/video-decoder-config.test.ts
import { describe, it, expect } from 'vitest';
import { VideoDecoder } from '../../src';

describe('VideoDecoder config tests', () => {
  it('VP8 config should be supported', async () => {
    const support = await VideoDecoder.isConfigSupported({
      codec: 'vp8',
    });
    expect(support.supported).toBe(true);
  });
});
```

## Test Resources

Some WPT tests require video samples. Options:
1. Include small test videos in repo
2. Generate synthetic test data
3. Skip tests requiring specific samples

```typescript
// Generate synthetic encoded chunk for testing
function createTestChunk(): EncodedVideoChunk {
  const data = generateVP8Keyframe(320, 240);
  return new EncodedVideoChunk({
    type: 'key',
    timestamp: 0,
    data: data,
  });
}
```

## CI Integration

```yaml
# In .github/workflows/test.yml
- name: Run WPT tests
  run: npm run test:wpt
  
- name: Upload WPT report
  uses: actions/upload-artifact@v4
  with:
    name: wpt-results
    path: wpt-results.json
```

## Coverage Tracking

Track which WPT tests pass/fail:

```markdown
## WPT Coverage

| Test File | Passing | Failing | Skipped |
|-----------|---------|---------|---------|
| video-decoder-config | 12 | 0 | 2 |
| video-decoder-state | 8 | 2 | 0 |
| video-encoder-config | 10 | 1 | 3 |
| ... | ... | ... | ... |
```

## Acceptance Criteria

1. WPT harness runs in Node.js environment
2. Core VideoDecoder WPT tests pass
3. Core VideoEncoder WPT tests pass
4. VideoFrame construction/copyTo tests pass
5. Test failures are clearly reported
6. WPT tests run in CI on every PR
7. Coverage report shows ≥80% WPT compliance

## Interop Tests (Browser ↔ Node)

In addition to WPT:

```typescript
// tests/interop/browser-decode.test.ts
describe('Browser interop', () => {
  it('Node-encoded VP9 decodes in browser', async () => {
    // 1. Encode frames in Node
    const chunks = await encodeTestPattern('vp09.00.10.08');
    
    // 2. Write to file in WebM container
    const webm = muxToWebM(chunks);
    
    // 3. Verify with reference decoder or browser test
    // (May require separate browser test runner)
  });
});
```

## Deliverables

- [ ] `tests/wpt/` — Adapted WPT tests
- [ ] `tests/wpt/harness.ts` — WPT harness adapter
- [ ] `tests/wpt/assertions.ts` — WPT assertion wrappers
- [ ] `scripts/download-wpt.sh` — Script to fetch latest WPT
- [ ] WPT coverage report
- [ ] CI integration

## Related

- [Threading & Worker Loop](./threading-worker-loop.md) — Core functionality to test
- [VideoFrame Memory Management](./videoframe-memory.md) — VideoFrame tests
- [Node.js Linux N-API + FFmpeg Research](../research/nodejs-linux-napi-ffmpeg.md#7-testing-and-compatibility)
