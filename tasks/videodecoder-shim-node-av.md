---
title: VideoDecoder Shim on node-av
status: todo
priority: critical
effort: medium
category: implementation
dependencies:
  - evaluate-ffmpeg-napi-bindings.md
research: ../research/ffmpeg-napi.md
timeline: Week 1
---

# VideoDecoder Shim on node-av

Sketch and implement a WebCodecs-compliant VideoDecoder that uses node-av as the backend engine.

## Objective

Create a `VideoDecoder` class that:
- Matches the WebCodecs `VideoDecoder` API exactly
- Uses node-av's `Decoder` internally for actual decoding
- Handles WebCodecs state machine semantics
- Properly maps codec strings to FFmpeg codecs

## Background

From [Existing FFmpeg N-API Bindings Research](../research/ffmpeg-napi.md#3-concrete-recommendation):

> For a Linux-first WebCodecs-in-Node prototype:
> 1. Start with node-av as the backend
> 2. Wrap it in TS classes that exactly match the WebCodecs IDL
> 3. Only reach for your own N-API code if you discover a semantic gap

## Tasks

- [ ] Study node-av Decoder API and types
- [ ] Study WebCodecs VideoDecoder spec
- [ ] Create `VideoDecoder` class skeleton matching WebCodecs IDL
- [ ] Implement state machine (`unconfigured` → `configured` → `closed`)
- [ ] Implement `configure()` method
  - [ ] Parse codec string (reuse codec-string-parser)
  - [ ] Map to node-av decoder config
  - [ ] Handle hardware acceleration hint
- [ ] Implement `decode()` method
  - [ ] Accept `EncodedVideoChunk`
  - [ ] Feed to node-av decoder
  - [ ] Wrap output as `VideoFrame`
- [ ] Implement `flush()` method
- [ ] Implement `reset()` method
- [ ] Implement `close()` method
- [ ] Implement `output` callback pattern
- [ ] Implement `error` callback pattern
- [ ] Implement `decodeQueueSize` property
- [ ] Implement static `isConfigSupported()` method
- [ ] Write unit tests
- [ ] Write integration tests with real video data

## WebCodecs VideoDecoder Interface

Reference from the WebCodecs spec:

```typescript
interface VideoDecoder {
  constructor(init: VideoDecoderInit);
  
  readonly state: CodecState;
  readonly decodeQueueSize: number;
  
  configure(config: VideoDecoderConfig): void;
  decode(chunk: EncodedVideoChunk): void;
  flush(): Promise<void>;
  reset(): void;
  close(): void;
  
  static isConfigSupported(config: VideoDecoderConfig): Promise<VideoDecoderSupport>;
}

interface VideoDecoderInit {
  output: VideoFrameOutputCallback;
  error: WebCodecsErrorCallback;
}

type CodecState = "unconfigured" | "configured" | "closed";
```

## Implementation Sketch

### VideoDecoder Class

```typescript
import { Decoder } from 'node-av';
import { parseCodecString } from './codec-parser';
import { VideoFrame } from './VideoFrame';
import { EncodedVideoChunk } from './EncodedVideoChunk';

type CodecState = 'unconfigured' | 'configured' | 'closed';

interface VideoDecoderInit {
  output: (frame: VideoFrame) => void;
  error: (error: DOMException) => void;
}

export class VideoDecoder {
  private _state: CodecState = 'unconfigured';
  private _outputCallback: (frame: VideoFrame) => void;
  private _errorCallback: (error: DOMException) => void;
  private _decoder: Decoder | null = null;
  private _decodeQueueSize = 0;

  constructor(init: VideoDecoderInit) {
    this._outputCallback = init.output;
    this._errorCallback = init.error;
  }

  get state(): CodecState {
    return this._state;
  }

  get decodeQueueSize(): number {
    return this._decodeQueueSize;
  }

  configure(config: VideoDecoderConfig): void {
    if (this._state === 'closed') {
      throw new DOMException('Decoder is closed', 'InvalidStateError');
    }

    // Parse codec string to get FFmpeg codec ID
    const parsed = parseCodecString(config.codec);
    if (!parsed) {
      throw new DOMException(`Unsupported codec: ${config.codec}`, 'NotSupportedError');
    }

    // Create node-av decoder with mapped config
    this._decoder = new Decoder({
      codec: parsed.ffmpegCodecId,
      // Map hardware acceleration hint
      hwAccel: config.hardwareAcceleration === 'prefer-hardware' ? 'auto' : undefined,
    });

    this._state = 'configured';
  }

  decode(chunk: EncodedVideoChunk): void {
    if (this._state !== 'configured') {
      throw new DOMException('Decoder not configured', 'InvalidStateError');
    }

    this._decodeQueueSize++;

    // Feed chunk to node-av decoder asynchronously
    this._decoder!.decode(chunk.data)
      .then((result) => {
        this._decodeQueueSize--;
        
        // Wrap result as VideoFrame and deliver via callback
        const frame = new VideoFrame(result.data, {
          timestamp: chunk.timestamp,
          duration: chunk.duration,
          format: mapPixelFormat(result.format),
          codedWidth: result.width,
          codedHeight: result.height,
        });
        
        this._outputCallback(frame);
      })
      .catch((err) => {
        this._decodeQueueSize--;
        this._errorCallback(new DOMException(err.message, 'OperationError'));
      });
  }

  async flush(): Promise<void> {
    if (this._state !== 'configured') {
      throw new DOMException('Decoder not configured', 'InvalidStateError');
    }

    // Flush node-av decoder
    await this._decoder!.flush();
    
    // Wait for queue to drain
    while (this._decodeQueueSize > 0) {
      await new Promise(resolve => setTimeout(resolve, 1));
    }
  }

  reset(): void {
    if (this._state === 'closed') {
      throw new DOMException('Decoder is closed', 'InvalidStateError');
    }

    // Reset internal decoder state
    this._decoder?.reset?.();
    this._decodeQueueSize = 0;
    this._state = 'unconfigured';
    this._decoder = null;
  }

  close(): void {
    if (this._state === 'closed') {
      return;
    }

    this._decoder?.close?.();
    this._decoder = null;
    this._decodeQueueSize = 0;
    this._state = 'closed';
  }

  static async isConfigSupported(config: VideoDecoderConfig): Promise<VideoDecoderSupport> {
    const parsed = parseCodecString(config.codec);
    
    if (!parsed) {
      return { supported: false, config };
    }

    // Check if node-av supports this codec
    // This might involve trying to create a decoder
    const supported = await checkCodecSupport(parsed.ffmpegCodecId);

    return {
      supported,
      config: supported ? normalizeConfig(config) : config,
    };
  }
}
```

### Key Mapping Functions

```typescript
// Map node-av pixel format to WebCodecs VideoPixelFormat
function mapPixelFormat(format: string): VideoPixelFormat {
  const formatMap: Record<string, VideoPixelFormat> = {
    'yuv420p': 'I420',
    'nv12': 'NV12',
    'rgba': 'RGBA',
    'bgra': 'BGRA',
    // ... more formats
  };
  return formatMap[format] ?? 'I420';
}

// Normalize config (e.g., align dimensions)
function normalizeConfig(config: VideoDecoderConfig): VideoDecoderConfig {
  return {
    ...config,
    codedWidth: config.codedWidth ? alignTo(config.codedWidth, 2) : undefined,
    codedHeight: config.codedHeight ? alignTo(config.codedHeight, 2) : undefined,
  };
}
```

## Gaps to Address

Based on preliminary analysis, these gaps may need bridging:

| Gap | Severity | Mitigation |
|-----|----------|------------|
| State machine semantics | Medium | Implement in shim layer |
| `decodeQueueSize` tracking | Low | Track in JS wrapper |
| `reset()` behavior | Medium | May need node-av enhancement or workaround |
| Error type mapping | Low | Create DOMException wrapper |
| Timestamp/duration handling | Medium | Pass through carefully |
| Pixel format mapping | Low | Create format mapping table |

## Test Cases

### Basic Decode Test

```typescript
import { VideoDecoder } from './VideoDecoder';
import { EncodedVideoChunk } from './EncodedVideoChunk';

describe('VideoDecoder', () => {
  it('decodes H.264 frames', async () => {
    const frames: VideoFrame[] = [];
    
    const decoder = new VideoDecoder({
      output: (frame) => frames.push(frame),
      error: (e) => { throw e; },
    });

    decoder.configure({ codec: 'avc1.42E01E' });
    
    const chunk = new EncodedVideoChunk({
      type: 'key',
      timestamp: 0,
      data: h264KeyFrameData,
    });
    
    decoder.decode(chunk);
    await decoder.flush();
    
    expect(frames).toHaveLength(1);
    expect(frames[0].codedWidth).toBe(1920);
    expect(frames[0].codedHeight).toBe(1080);
    
    decoder.close();
  });
});
```

## Acceptance Criteria

1. `VideoDecoder` class matches WebCodecs interface
2. State machine works correctly (`unconfigured` → `configured` → `closed`)
3. `configure()` accepts standard codec strings
4. `decode()` produces `VideoFrame` objects via callback
5. `flush()` waits for all frames to be delivered
6. `reset()` returns to unconfigured state
7. `close()` releases resources
8. `isConfigSupported()` returns accurate results
9. Error callbacks fire with appropriate `DOMException` types
10. Unit tests pass
11. Integration test with real H.264 data passes

## Deliverables

- [ ] `src/VideoDecoder.ts` — VideoDecoder implementation
- [ ] `src/VideoFrame.ts` — VideoFrame class (if not already exists)
- [ ] `src/EncodedVideoChunk.ts` — EncodedVideoChunk class (if not already exists)
- [ ] `tests/VideoDecoder.test.ts` — Unit tests
- [ ] `tests/integration/decode-h264.test.ts` — Integration test
- [ ] Documentation of node-av → WebCodecs mapping

## Related

- [Evaluate FFmpeg N-API Bindings](./evaluate-ffmpeg-napi-bindings.md) — Prerequisite evaluation
- [FFmpeg N-API Bindings Research](../research/ffmpeg-napi.md)
- [Codec String Parser](./codec-string-parser.md) — Needed for `configure()`
- [N-API PoC Addon](./napi-poc-addon.md) — Original from-scratch approach (alternative path)
