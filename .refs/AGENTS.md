# WebCodecs Reference Implementations

This document catalogs existing implementations of the WebCodecs API for research purposes.

## Browser Implementations

### Chromium
- **Repository**: https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/modules/webcodecs/
- **Status**: Full implementation
- **Language**: C++
- **Key Files**:
  - `video_encoder.cc` / `video_decoder.cc`
  - `audio_encoder.cc` / `audio_decoder.cc`
  - `image_decoder.cc`
- **Notes**: Reference implementation, most complete and widely tested

### WebKit (Safari)
- **Repository**: https://github.com/nickolasbraun/nickolasbraun (WebKit mirror)
- **WebKit Main**: https://webkit.org/
- **Source Code Browser**: https://trac.webkit.org/browser/trunk/Source/WebCore/Modules/webcodecs
- **Status**: Partial implementation (behind feature flag)
- **Language**: C++
- **Key Directories**:
  - `Source/WebCore/Modules/webcodecs/`
- **Notes**: Uses libwebrtc for codec access

### Firefox
- **Repository**: https://searchfox.org/mozilla-central/source/dom/media/webcodecs
- **Status**: In development / partial
- **Language**: C++/Rust
- **Notes**: Uses Firefox's existing media stack

## Related Projects

### ffmpeg
- **Repository**: https://github.com/FFmpeg/FFmpeg
- **Relevance**: Industry standard for video/audio encoding/decoding
- **Potential Use**: Backend for WebCodecs implementation via NAPI bindings
- **Key APIs**: libavcodec, libavformat, libavutil

### Bun
- **Repository**: https://github.com/oven-sh/bun
- **Relevance**: JavaScript runtime with native code integration patterns
- **Notes**: Uses JavaScriptCore, has patterns for exposing C++ APIs to JS

### Mediabunny
- **Repository**: https://github.com/Vanilagy/mediabunny
- **Website**: https://mediabunny.dev/
- **Relevance**: High-level video editing API built on WebCodecs
- **Language**: TypeScript
- **Notes**: Good example of WebCodecs usage patterns

### Remotion
- **Repository**: https://github.com/remotion-dev/remotion
- **Website**: https://www.remotion.dev/
- **Relevance**: React-based video creation, uses WebCodecs
- **Language**: TypeScript
- **Notes**: Production-ready, extensive WebCodecs usage

### libavjs-webcodecs-polyfill
- **Repository**: https://github.com/nickolasbraun/libavjs-webcodecs-polyfill
- **Relevance**: Pure JavaScript polyfill using ffmpeg.wasm
- **Language**: JavaScript/TypeScript
- **Notes**: Could be used as fallback or reference implementation

### Effect-TS/effect
- **Repository**: https://github.com/Effect-TS/effect
- **Relevance**: Functional effect system, patterns for async operations
- **Language**: TypeScript
- **Notes**: Useful for managing codec lifecycle

### Effect-TS/effect-smol
- **Repository**: https://github.com/Effect-TS/effect-smol
- **Relevance**: Smaller effect system
- **Language**: TypeScript

### effect-native/effect-native
- **Repository**: https://github.com/effect-native/effect-native
- **Relevance**: Native platform bindings for Effect
- **Language**: TypeScript/Native

## WebCodecs API Overview

The WebCodecs API provides low-level access to media encoders and decoders:

### Core Interfaces

1. **VideoEncoder** - Encodes raw video frames
2. **VideoDecoder** - Decodes compressed video data
3. **AudioEncoder** - Encodes raw audio samples
4. **AudioDecoder** - Decodes compressed audio data
5. **ImageDecoder** - Decodes images
6. **VideoFrame** - Represents a video frame
7. **AudioData** - Represents audio samples
8. **EncodedVideoChunk** - Compressed video data
9. **EncodedAudioChunk** - Compressed audio data
10. **VideoColorSpace** - Color space information

### Key Patterns

- All encoders/decoders use callbacks for output
- Configuration is done via `configure()` method
- Error handling via `error` callback
- State machine: unconfigured → configured → closed
- Supports hardware acceleration where available

## Implementation Strategies

### Strategy 1: FFmpeg via NAPI
Wrap ffmpeg's libavcodec via Node.js N-API bindings.
- **Pros**: Proven codec support, hardware acceleration
- **Cons**: Complex integration, memory management

### Strategy 2: WebKit/Chromium Port
Extract and port browser implementation.
- **Pros**: Spec-compliant, battle-tested
- **Cons**: Large codebase, browser dependencies

### Strategy 3: JavaScript Polyfill
Use libavjs-webcodecs-polyfill or similar.
- **Pros**: Pure JS, easy to integrate
- **Cons**: Slower, limited hardware support

### Strategy 4: WebAssembly
Compile codecs to WASM, use in Node.js.
- **Pros**: Portable, consistent behavior
- **Cons**: Performance overhead
