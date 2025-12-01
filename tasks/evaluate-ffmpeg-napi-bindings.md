---
title: Evaluate FFmpeg N-API Bindings
status: todo
priority: critical
effort: medium
category: architecture
dependencies: []
research: ../research/ffmpeg-napi.md
timeline: Week 1
---

# Evaluate FFmpeg N-API Bindings

Evaluate existing FFmpeg N-API libraries to determine the best foundation for WebCodecs implementation.

## Objective

Compare node-av, @mmomtchev/ffmpeg, and other existing FFmpeg Node-API bindings to select the optimal backend for a WebCodecs shim layer.

## Background

From [Existing FFmpeg N-API Bindings Research](../research/ffmpeg-napi.md):

> There are already serious FFmpeg bindings built on Node-API, so you don't have to start from raw C FFmpeg + N-API. This avoids the largest yak: raw FFmpeg + Node-API integration.

## Candidates to Evaluate

### 1. node-av (SeydX)

- **Repository**: [seydx/node-av](https://github.com/seydx/node-av)
- High-level and low-level APIs
- Prebuilt binaries for all platforms
- Hardware acceleration support (CUDA, VAAPI)
- Full TypeScript support

### 2. @mmomtchev/ffmpeg

- **Repository**: [mmomtchev/ffmpeg](https://github.com/mmomtchev/ffmpeg)
- Node.js Streams-based API
- Uses avcpp + nobind17
- Full codec coverage

### 3. libav (Astronaut Labs)

- **Repository**: [astronautlabs/libav](https://github.com/AstronautLabs/libav)
- Low-level bindings
- Pre-alpha quality
- Requires system FFmpeg

## Evaluation Criteria

| Criterion | Weight | Description |
|-----------|--------|-------------|
| API Compatibility | High | How well does the API map to WebCodecs concepts? |
| Prebuilt Binaries | High | Available for Linux x64/arm64? |
| HW Acceleration | Medium | CUDA/VAAPI support? |
| Maintenance | High | Active development? Recent commits? |
| Documentation | Medium | TypeScript types? Examples? |
| Performance | High | Overhead compared to raw FFmpeg? |
| Error Handling | Medium | Graceful errors that can map to WebCodecs errors? |

## Tasks

- [ ] Install node-av and test basic decode/encode
- [ ] Install @mmomtchev/ffmpeg and test basic decode/encode
- [ ] Compare API surface to WebCodecs spec requirements
- [ ] Test hardware acceleration detection
- [ ] Measure decode performance (1080p H.264)
- [ ] Measure encode performance (1080p VP8)
- [ ] Document API mapping gaps
- [ ] Check TypeScript types quality
- [ ] Review error handling patterns
- [ ] Document licensing implications
- [ ] Write recommendation report

## Test Cases

### Basic Decode Test

```typescript
import { Decoder } from 'node-av';  // or equivalent

async function testDecode() {
  // 1. Configure decoder (map to WebCodecs config)
  const decoder = new Decoder({
    codec: 'h264',
    // ... other options
  });

  // 2. Feed encoded chunk
  const result = await decoder.decode(encodedData);

  // 3. Get decoded frame
  console.log('Frame:', result.width, result.height);
}
```

### Basic Encode Test

```typescript
import { Encoder } from 'node-av';  // or equivalent

async function testEncode() {
  // 1. Configure encoder
  const encoder = new Encoder({
    codec: 'vp8',
    width: 1920,
    height: 1080,
    bitrate: 2_000_000,
  });

  // 2. Feed raw frame
  const chunk = await encoder.encode(frameData);

  // 3. Get encoded output
  console.log('Chunk size:', chunk.byteLength);
}
```

## API Mapping Analysis

Document how each library's API maps to WebCodecs:

| WebCodecs | node-av | @mmomtchev/ffmpeg |
|-----------|---------|-------------------|
| `VideoDecoder.configure()` | `new Decoder(config)` | TBD |
| `VideoDecoder.decode(chunk)` | `decoder.decode(data)` | TBD |
| `VideoDecoder.flush()` | `decoder.flush()` | TBD |
| `VideoDecoder.reset()` | TBD | TBD |
| `VideoDecoder.close()` | `decoder.close()` | TBD |
| `VideoEncoder.configure()` | `new Encoder(config)` | TBD |
| `VideoEncoder.encode(frame)` | `encoder.encode(data)` | TBD |
| `VideoFrame` | `Frame` | TBD |
| `EncodedVideoChunk` | `Packet` | TBD |

## Acceptance Criteria

1. Both libraries tested with H.264 decode
2. Both libraries tested with VP8/VP9 encode
3. Performance comparison documented
4. API mapping table completed
5. Recommendation made with justification
6. Licensing implications documented
7. Any blockers or gaps identified

## Deliverables

- [ ] Test scripts for each library
- [ ] API mapping documentation
- [ ] Performance benchmark results
- [ ] Recommendation report
- [ ] List of gaps/blockers for WebCodecs shim

## Recommendation Template

```markdown
## Recommendation: [Library Name]

### Justification
- ...

### Trade-offs
- Pros: ...
- Cons: ...

### Gaps to Address
1. ...
2. ...

### Estimated Effort
- WebCodecs shim: X weeks
- vs. from-scratch N-API: Y weeks (savings of Z weeks)
```

## Related

- [FFmpeg N-API Bindings Research](../research/ffmpeg-napi.md)
- [VideoDecoder Shim on node-av](./videodecoder-shim-node-av.md)
- [N-API PoC Addon](./napi-poc-addon.md) — Original from-scratch approach
