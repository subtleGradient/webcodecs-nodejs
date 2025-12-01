# WebCodecs Node.js Specification

## Overview

This project aims to implement the WebCodecs API in Node.js, providing a standards-compliant way to perform low-level video and audio encoding/decoding operations.

## Agent Instructions

When working on this project, agents should:

1. **Reference the W3C WebCodecs Specification**
   - Primary spec: https://www.w3.org/TR/webcodecs/
   - Codec registrations: https://www.w3.org/TR/webcodecs-codec-registry/

2. **Test Against Browser Behavior**
   - The test suite runs in both Node.js and browsers
   - Browser tests serve as the reference implementation
   - Node.js implementation should match browser behavior

3. **Implementation Priority**
   - Start with VideoDecoder/VideoEncoder
   - Then AudioDecoder/AudioEncoder
   - Then ImageDecoder
   - Finally supporting types (VideoFrame, AudioData, etc.)

4. **Codec Support Priority**
   - VP8/VP9 (widely supported, patent-free)
   - H.264/AVC (most common)
   - AV1 (modern, efficient)
   - Opus/AAC for audio

## Architecture

```
┌─────────────────────────────────────────────────┐
│                 JavaScript API                   │
│  (VideoEncoder, VideoDecoder, AudioEncoder...)  │
├─────────────────────────────────────────────────┤
│              Native Binding Layer                │
│           (N-API / FFI / WASM)                  │
├─────────────────────────────────────────────────┤
│            Codec Backend                         │
│    (FFmpeg / System Codecs / WASM Codecs)       │
└─────────────────────────────────────────────────┘
```

## File Structure

```
webcodecs-nodejs/
├── src/
│   ├── index.ts          # Main exports
│   ├── video-encoder.ts  # VideoEncoder implementation
│   ├── video-decoder.ts  # VideoDecoder implementation
│   ├── audio-encoder.ts  # AudioEncoder implementation
│   ├── audio-decoder.ts  # AudioDecoder implementation
│   ├── image-decoder.ts  # ImageDecoder implementation
│   ├── video-frame.ts    # VideoFrame class
│   ├── audio-data.ts     # AudioData class
│   └── types/
│       └── index.ts      # TypeScript type definitions
├── tests/
│   ├── video-encoder.test.ts
│   ├── video-decoder.test.ts
│   ├── audio-encoder.test.ts
│   ├── audio-decoder.test.ts
│   └── fixtures/
│       ├── test-video.webm
│       └── test-audio.opus
├── .refs/                # Reference implementations
├── .specs/               # Specifications
└── research/             # Implementation research
```

## Testing Strategy

1. **Unit Tests**: Test individual components in isolation
2. **Integration Tests**: Test encode/decode round-trips
3. **Compatibility Tests**: Compare with browser behavior
4. **Performance Tests**: Benchmark against native implementations

## Coding Conventions

- Use TypeScript for all source code
- Follow W3C WebCodecs API naming conventions
- Use vitest for testing
- Support ESM and CommonJS exports
- Target Node.js 18+ LTS versions

## Error Handling

Follow the WebCodecs error model:
- `NotSupportedError` - Codec not supported
- `InvalidStateError` - Invalid state transition
- `DataError` - Malformed input data
- `EncodingError` - Encoding/decoding failed

## References

- [WebCodecs API Spec](https://www.w3.org/TR/webcodecs/)
- [MDN WebCodecs](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)
- [WebCodecs Codec Registry](https://www.w3.org/TR/webcodecs-codec-registry/)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
