# WebCodecs for Node.js

**WebCodecs API implementation for Node.js using N-API + FFmpeg native bindings.**

[![npm version](https://badge.fury.io/js/webcodecs-nodejs.svg)](https://www.npmjs.com/package/webcodecs-nodejs)

## Demo

```bash
# Clone the repository
git clone https://github.com/subtleGradient/webcodecs-nodejs.git
cd webcodecs-nodejs

# Install dependencies
npm install

# Install FFmpeg development libraries (Ubuntu/Debian)
sudo apt-get install libavcodec-dev libavformat-dev libavutil-dev libswscale-dev pkg-config

# Build native addon
npm run build:native

# Run the demo
npm run demo
```

**Output:**
```
============================================================
  WebCodecs Node.js Demo
  N-API + FFmpeg Native Bindings
============================================================

1. Generating QR code with secret: "DEMO-1764824865539"
   Pre-encode verification: "DEMO-1764824865539"

2. Creating VideoFrame (I420 format)
   Frame: 256x256, format=I420

3. Encoding with VideoEncoder (VP8)
   Encoded: 3237 bytes, type=key

4. Decoding with VideoDecoder (VP8)
   Decoded: 256x256

5. Extracting pixels and reading QR code

============================================================
  SUCCESS! Round-trip verified!
  Original: "DEMO-1764824865539"
  Decoded:  "DEMO-1764824865539"
============================================================

The WebCodecs API is working correctly in Node.js!
```

## Usage

```typescript
import { VideoEncoder, VideoDecoder, VideoFrame, EncodedVideoChunk } from 'webcodecs-nodejs';

// Create a VideoFrame from I420 data
const frame = new VideoFrame(i420Buffer, {
  format: 'I420',
  codedWidth: 640,
  codedHeight: 480,
  timestamp: 0,
});

// Encode
const encoder = new VideoEncoder({
  output: (chunk, metadata) => {
    console.log('Encoded chunk:', chunk.byteLength, 'bytes');
  },
  error: (e) => console.error(e),
});

encoder.configure({
  codec: 'vp8',
  width: 640,
  height: 480,
  bitrate: 1_000_000,
});

encoder.encode(frame);
await encoder.flush();
encoder.close();

// Decode
const decoder = new VideoDecoder({
  output: (frame) => {
    console.log('Decoded frame:', frame.codedWidth, 'x', frame.codedHeight);
  },
  error: (e) => console.error(e),
});

decoder.configure({ codec: 'vp8' });
decoder.decode(encodedChunk);
await decoder.flush();
decoder.close();
```

## Supported Codecs

| Codec | Encode | Decode |
|-------|--------|--------|
| VP8   | ✅     | ✅     |
| VP9   | 🚧     | 🚧     |
| H.264 | 🚧     | 🚧     |
| AV1   | 🚧     | 🚧     |

## Test Results

```
Node.js:  99 passed, 3 skipped (audio not yet implemented)
Browser:  92 passed, 1 skipped
```

Tests run in both environments using the same test code - browser uses native WebCodecs, Node.js uses this polyfill.

## Architecture

- **N-API + node-addon-api**: Portable native bindings
- **FFmpeg (libavcodec, libavutil, libswscale)**: Codec implementations
- **TypeScript**: Type-safe API layer matching the WebCodecs spec

## Development

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run browser tests (verifies spec compliance)
npm run test:browser

# Build TypeScript
npm run build

# Rebuild native addon
npm run rebuild
```

## Requirements

- Node.js >= 18
- FFmpeg development libraries
- C++ compiler (g++ or clang++)
- Python 3 (for node-gyp)

---

# WebCodecs Node.js $10k Challenge

<img width="1025" height="472" alt="image" src="https://github.com/user-attachments/assets/3457c0a5-2ad2-4a28-a1fe-3f518ed5eb3e" />

Video editing is exploding around the world and the potential for it enabled by AI and edge compute is unprecedented. There's finally a good underlying API in the browser for it with [WebCodecs](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API) and high level APIs like [Mediabunny](https://mediabunny.dev/) and [Remotion](https://www.remotion.dev/). But unfortunately you can't easily take the same code written against these and have it run on the server with [Node.js](https://nodejs.org/en).

This is why I'm setting up a challenge to improve the video editing ecosystem. Your objective is to get the [WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API) running on the server inside of NodeJS.

Since there's only a month for the challenge, it's unlikely that a full working version will be completed. As a result, progress towards that goal will be rewarded. Here are some potential approaches that could be viable:
- Implement the WebCodecs API by forwarding all the calls to the respective calls to ffmpeg via C bindings.
- Extract the WebCodecs implementation from one of the browsers that [currently implement it](https://caniuse.com/webcodecs) in such a way that it can be used standalone.
- Implement a slow but functional JavaScript version of the WebCodecs API.

In order to qualify:
- The code must be open sourced.
- The submission must be before **December 31st 2025 Midnight PST** (California time).

To submit your entry, create an issue on this repository with:
- An explanation of what you did.
- How to compile / run it.
- Who are the people that participated. If more than one, how to split the prize between the people if you win.

The **prize pool is $10k** by Christopher "@vjeux" Chedeau. If anyone or a company is interested in contributing more, please reach out at vjeuxx@gmail.com. The judging will happen for a week and **results will be announced Thursday January 8th**. The money will be distributed among the winners at the sole discretion of Christopher Chedeau. If there are no contributions deemed significant enough, part or all the prize pool may not be distributed.
