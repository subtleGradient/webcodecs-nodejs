/**
 * WebCodecs API Test Suite
 * 
 * This test suite validates the WebCodecs API implementation.
 * It is designed to run in both Node.js and browser environments.
 * 
 * In browsers, these tests validate the native implementation.
 * In Node.js, they validate our polyfill implementation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Helper to check if WebCodecs API is available
const isWebCodecsAvailable = () => {
  return typeof globalThis.VideoEncoder !== 'undefined' &&
         typeof globalThis.VideoDecoder !== 'undefined' &&
         typeof globalThis.AudioEncoder !== 'undefined' &&
         typeof globalThis.AudioDecoder !== 'undefined';
};

// Helper to check if we're in a browser environment
const isBrowser = () => typeof window !== 'undefined';

describe('WebCodecs API Availability', () => {
  it('should expose VideoEncoder globally', () => {
    if (!isWebCodecsAvailable()) {
      expect.fail('WebCodecs API not available - this is expected in Node.js until implementation is complete');
    }
    expect(typeof globalThis.VideoEncoder).toBe('function');
  });

  it('should expose VideoDecoder globally', () => {
    if (!isWebCodecsAvailable()) {
      expect.fail('WebCodecs API not available - this is expected in Node.js until implementation is complete');
    }
    expect(typeof globalThis.VideoDecoder).toBe('function');
  });

  it('should expose AudioEncoder globally', () => {
    if (!isWebCodecsAvailable()) {
      expect.fail('WebCodecs API not available - this is expected in Node.js until implementation is complete');
    }
    expect(typeof globalThis.AudioEncoder).toBe('function');
  });

  it('should expose AudioDecoder globally', () => {
    if (!isWebCodecsAvailable()) {
      expect.fail('WebCodecs API not available - this is expected in Node.js until implementation is complete');
    }
    expect(typeof globalThis.AudioDecoder).toBe('function');
  });

  it('should expose VideoFrame globally', () => {
    if (!isWebCodecsAvailable()) {
      expect.fail('WebCodecs API not available - this is expected in Node.js until implementation is complete');
    }
    expect(typeof globalThis.VideoFrame).toBe('function');
  });

  it('should expose AudioData globally', () => {
    if (!isWebCodecsAvailable()) {
      expect.fail('WebCodecs API not available - this is expected in Node.js until implementation is complete');
    }
    expect(typeof globalThis.AudioData).toBe('function');
  });

  it('should expose EncodedVideoChunk globally', () => {
    if (!isWebCodecsAvailable()) {
      expect.fail('WebCodecs API not available - this is expected in Node.js until implementation is complete');
    }
    expect(typeof globalThis.EncodedVideoChunk).toBe('function');
  });

  it('should expose EncodedAudioChunk globally', () => {
    if (!isWebCodecsAvailable()) {
      expect.fail('WebCodecs API not available - this is expected in Node.js until implementation is complete');
    }
    expect(typeof globalThis.EncodedAudioChunk).toBe('function');
  });

  it('should expose ImageDecoder globally', () => {
    if (!isWebCodecsAvailable()) {
      expect.fail('WebCodecs API not available - this is expected in Node.js until implementation is complete');
    }
    expect(typeof globalThis.ImageDecoder).toBe('function');
  });
});

describe('VideoEncoder', () => {
  let encoder: InstanceType<typeof VideoEncoder> | null = null;

  afterEach(() => {
    if (encoder && encoder.state !== 'closed') {
      encoder.close();
    }
    encoder = null;
  });

  describe('isConfigSupported', () => {
    it('should have static isConfigSupported method', async () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      expect(typeof VideoEncoder.isConfigSupported).toBe('function');
    });

    it('should support VP8 codec', async () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      const config = {
        codec: 'vp8',
        width: 640,
        height: 480,
        bitrate: 1_000_000,
        framerate: 30,
      };
      const support = await VideoEncoder.isConfigSupported(config);
      expect(support).toHaveProperty('supported');
      expect(support).toHaveProperty('config');
    });

    it('should support VP9 codec', async () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      const config = {
        codec: 'vp09.00.10.08',
        width: 640,
        height: 480,
        bitrate: 1_000_000,
        framerate: 30,
      };
      const support = await VideoEncoder.isConfigSupported(config);
      expect(support).toHaveProperty('supported');
    });

    it('should support H.264 codec', async () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      const config = {
        codec: 'avc1.42001E', // H.264 Baseline Profile Level 3.0
        width: 640,
        height: 480,
        bitrate: 1_000_000,
        framerate: 30,
      };
      const support = await VideoEncoder.isConfigSupported(config);
      expect(support).toHaveProperty('supported');
    });

    it('should reject invalid codec', async () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      const config = {
        codec: 'invalid-codec',
        width: 640,
        height: 480,
        bitrate: 1_000_000,
        framerate: 30,
      };
      // Some polyfills throw for invalid codec, others return {supported: false}
      try {
        const support = await VideoEncoder.isConfigSupported(config);
        expect(support.supported).toBe(false);
      } catch (e) {
        // Throwing is also acceptable behavior for invalid codec
        expect(e).toBeDefined();
      }
    });
  });

  describe('constructor', () => {
    it('should create a VideoEncoder instance', () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });
      expect(encoder).toBeInstanceOf(VideoEncoder);
    });

    it('should start in unconfigured state', () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });
      expect(encoder.state).toBe('unconfigured');
    });

    it('should have encodeQueueSize property', () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });
      expect(typeof encoder.encodeQueueSize).toBe('number');
      expect(encoder.encodeQueueSize).toBe(0);
    });
  });

  describe('configure', () => {
    it('should configure with valid VP8 config', () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });
      encoder.configure({
        codec: 'vp8',
        width: 640,
        height: 480,
        bitrate: 1_000_000,
        framerate: 30,
      });
      expect(encoder.state).toBe('configured');
    });

    it('should handle invalid configuration', async () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      
      let errorOccurred = false;
      encoder = new VideoEncoder({
        output: () => {},
        error: () => {
          errorOccurred = true;
        },
      });
      
      // Invalid codec should either throw or trigger error callback
      try {
        encoder.configure({
          codec: 'invalid',
          width: 640,
          height: 480,
        });
        // If configure doesn't throw, wait for potential error callback
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch {
        errorOccurred = true;
      }
      
      // The encoder should be in an error state or not configured properly
      expect(encoder.state === 'closed' || errorOccurred || encoder.state === 'unconfigured').toBe(true);
    });
  });

  describe('close', () => {
    it('should close the encoder', () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });
      encoder.close();
      expect(encoder.state).toBe('closed');
    });

    it('should throw when encoding after close', () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });
      encoder.close();
      expect(() => {
        encoder!.configure({
          codec: 'vp8',
          width: 640,
          height: 480,
        });
      }).toThrow();
    });
  });

  describe('reset', () => {
    it('should reset to unconfigured state', () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });
      encoder.configure({
        codec: 'vp8',
        width: 640,
        height: 480,
        bitrate: 1_000_000,
        framerate: 30,
      });
      encoder.reset();
      expect(encoder.state).toBe('unconfigured');
    });
  });
});

describe('VideoDecoder', () => {
  let decoder: InstanceType<typeof VideoDecoder> | null = null;

  afterEach(() => {
    if (decoder && decoder.state !== 'closed') {
      decoder.close();
    }
    decoder = null;
  });

  describe('isConfigSupported', () => {
    it('should have static isConfigSupported method', async () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      expect(typeof VideoDecoder.isConfigSupported).toBe('function');
    });

    it('should support VP8 codec', async () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      const config = { codec: 'vp8' };
      const support = await VideoDecoder.isConfigSupported(config);
      expect(support).toHaveProperty('supported');
    });

    it('should support VP9 codec', async () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      const config = { codec: 'vp09.00.10.08' };
      const support = await VideoDecoder.isConfigSupported(config);
      expect(support).toHaveProperty('supported');
    });

    it('should support H.264 codec', async () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      const config = { codec: 'avc1.42001E' };
      const support = await VideoDecoder.isConfigSupported(config);
      expect(support).toHaveProperty('supported');
    });
  });

  describe('constructor', () => {
    it('should create a VideoDecoder instance', () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });
      expect(decoder).toBeInstanceOf(VideoDecoder);
    });

    it('should start in unconfigured state', () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });
      expect(decoder.state).toBe('unconfigured');
    });

    it('should have decodeQueueSize property', () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });
      expect(typeof decoder.decodeQueueSize).toBe('number');
      expect(decoder.decodeQueueSize).toBe(0);
    });
  });

  describe('configure', () => {
    it('should configure with valid VP8 config', () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });
      decoder.configure({ codec: 'vp8' });
      expect(decoder.state).toBe('configured');
    });
  });

  describe('close', () => {
    it('should close the decoder', () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });
      decoder.close();
      expect(decoder.state).toBe('closed');
    });
  });

  describe('reset', () => {
    it('should reset to unconfigured state', () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });
      decoder.configure({ codec: 'vp8' });
      decoder.reset();
      expect(decoder.state).toBe('unconfigured');
    });
  });
});

describe('AudioEncoder', () => {
  let encoder: InstanceType<typeof AudioEncoder> | null = null;

  afterEach(() => {
    if (encoder && encoder.state !== 'closed') {
      encoder.close();
    }
    encoder = null;
  });

  describe('isConfigSupported', () => {
    it('should have static isConfigSupported method', async () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      expect(typeof AudioEncoder.isConfigSupported).toBe('function');
    });

    it('should support Opus codec', async () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      const config = {
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      };
      const support = await AudioEncoder.isConfigSupported(config);
      expect(support).toHaveProperty('supported');
    });

    it('should support AAC codec', async () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      const config = {
        codec: 'mp4a.40.2', // AAC-LC
        sampleRate: 44100,
        numberOfChannels: 2,
      };
      const support = await AudioEncoder.isConfigSupported(config);
      expect(support).toHaveProperty('supported');
    });
  });

  describe('constructor', () => {
    it('should create an AudioEncoder instance', () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });
      expect(encoder).toBeInstanceOf(AudioEncoder);
    });

    it('should start in unconfigured state', () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });
      expect(encoder.state).toBe('unconfigured');
    });
  });

  describe('configure', () => {
    it('should configure with valid Opus config', () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });
      encoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      });
      expect(encoder.state).toBe('configured');
    });
  });

  describe('close', () => {
    it('should close the encoder', () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      encoder = new AudioEncoder({
        output: () => {},
        error: () => {},
      });
      encoder.close();
      expect(encoder.state).toBe('closed');
    });
  });
});

describe('AudioDecoder', () => {
  let decoder: InstanceType<typeof AudioDecoder> | null = null;

  afterEach(() => {
    if (decoder && decoder.state !== 'closed') {
      decoder.close();
    }
    decoder = null;
  });

  describe('isConfigSupported', () => {
    it('should have static isConfigSupported method', async () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      expect(typeof AudioDecoder.isConfigSupported).toBe('function');
    });

    it('should support Opus codec', async () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      const config = {
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
      };
      const support = await AudioDecoder.isConfigSupported(config);
      expect(support).toHaveProperty('supported');
    });
  });

  describe('constructor', () => {
    it('should create an AudioDecoder instance', () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      decoder = new AudioDecoder({
        output: () => {},
        error: () => {},
      });
      expect(decoder).toBeInstanceOf(AudioDecoder);
    });

    it('should start in unconfigured state', () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      decoder = new AudioDecoder({
        output: () => {},
        error: () => {},
      });
      expect(decoder.state).toBe('unconfigured');
    });
  });

  describe('close', () => {
    it('should close the decoder', () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      decoder = new AudioDecoder({
        output: () => {},
        error: () => {},
      });
      decoder.close();
      expect(decoder.state).toBe('closed');
    });
  });
});

describe('VideoFrame', () => {
  describe('constructor', () => {
    it('should be a constructor function', () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      expect(typeof VideoFrame).toBe('function');
    });

    // VideoFrame requires canvas or image data, which may not be available in all environments
    it.skip('should create a VideoFrame from ImageData', () => {
      if (!isWebCodecsAvailable() || !isBrowser()) {
        expect.fail('VideoFrame test requires browser environment');
      }
      // This test would require canvas/image data
    });
  });
});

describe('AudioData', () => {
  describe('constructor', () => {
    it('should be a constructor function', () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      expect(typeof AudioData).toBe('function');
    });

    it('should create AudioData from raw samples', () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      const samples = new Float32Array(1024);
      // Fill with a sine wave
      for (let i = 0; i < 1024; i++) {
        samples[i] = Math.sin((2 * Math.PI * 440 * i) / 48000);
      }

      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 1024,
        numberOfChannels: 1,
        timestamp: 0,
        data: samples,
      });

      expect(audioData.format).toBe('f32');
      expect(audioData.sampleRate).toBe(48000);
      expect(audioData.numberOfFrames).toBe(1024);
      expect(audioData.numberOfChannels).toBe(1);
      expect(audioData.timestamp).toBe(0);

      audioData.close();
    });
  });

  describe('properties', () => {
    it('should have duration property', () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      const samples = new Float32Array(48000); // 1 second at 48kHz
      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 48000,
        numberOfChannels: 1,
        timestamp: 0,
        data: samples,
      });

      expect(audioData.duration).toBe(1_000_000); // 1 second in microseconds

      audioData.close();
    });
  });
});

describe('EncodedVideoChunk', () => {
  describe('constructor', () => {
    it('should be a constructor function', () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      expect(typeof EncodedVideoChunk).toBe('function');
    });

    it('should create an EncodedVideoChunk', () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      const data = new Uint8Array([0, 0, 0, 1, 0x67]); // Fake NAL unit
      const chunk = new EncodedVideoChunk({
        type: 'key',
        timestamp: 0,
        data: data,
      });

      expect(chunk.type).toBe('key');
      expect(chunk.timestamp).toBe(0);
      expect(chunk.byteLength).toBe(5);
    });

    it('should support delta frames', () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      const data = new Uint8Array([0, 0, 0, 1, 0x61]); // Fake NAL unit
      const chunk = new EncodedVideoChunk({
        type: 'delta',
        timestamp: 33333, // 30 fps
        data: data,
      });

      expect(chunk.type).toBe('delta');
      expect(chunk.timestamp).toBe(33333);
    });

    it('should support duration', () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      const data = new Uint8Array([0, 0, 0, 1, 0x67]);
      const chunk = new EncodedVideoChunk({
        type: 'key',
        timestamp: 0,
        duration: 33333,
        data: data,
      });

      expect(chunk.duration).toBe(33333);
    });
  });

  describe('copyTo', () => {
    it('should copy data to a buffer', () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      const data = new Uint8Array([0, 0, 0, 1, 0x67]);
      const chunk = new EncodedVideoChunk({
        type: 'key',
        timestamp: 0,
        data: data,
      });

      const buffer = new Uint8Array(chunk.byteLength);
      chunk.copyTo(buffer);

      expect(buffer).toEqual(data);
    });
  });
});

describe('EncodedAudioChunk', () => {
  describe('constructor', () => {
    it('should be a constructor function', () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      expect(typeof EncodedAudioChunk).toBe('function');
    });

    it('should create an EncodedAudioChunk', () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      const data = new Uint8Array([0xff, 0xf1, 0x50, 0x80]); // Fake ADTS header
      const chunk = new EncodedAudioChunk({
        type: 'key',
        timestamp: 0,
        data: data,
      });

      expect(chunk.type).toBe('key');
      expect(chunk.timestamp).toBe(0);
      expect(chunk.byteLength).toBe(4);
    });
  });
});

describe('ImageDecoder', () => {
  describe('isTypeSupported', () => {
    it('should have static isTypeSupported method', () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      expect(typeof ImageDecoder.isTypeSupported).toBe('function');
    });

    it('should support common image types', async () => {
      if (!isWebCodecsAvailable()) {
        expect.fail('WebCodecs API not available');
      }
      // Most browsers support these
      const pngSupport = await ImageDecoder.isTypeSupported('image/png');
      const jpegSupport = await ImageDecoder.isTypeSupported('image/jpeg');
      const webpSupport = await ImageDecoder.isTypeSupported('image/webp');
      const gifSupport = await ImageDecoder.isTypeSupported('image/gif');

      // At least PNG and JPEG should be supported
      expect(pngSupport || jpegSupport).toBe(true);
    });
  });
});

describe('Encode/Decode Round Trip', () => {
  // This test requires canvas which is not available in Node.js
  it.skipIf(!isBrowser())('should encode and decode video frames', async () => {
    if (!isWebCodecsAvailable()) {
      expect.fail('WebCodecs API not available');
    }

    const encodedChunks: EncodedVideoChunk[] = [];
    const decodedFrames: VideoFrame[] = [];

    const encoder = new VideoEncoder({
      output: (chunk, metadata) => {
        encodedChunks.push(chunk);
      },
      error: (e) => {
        throw e;
      },
    });

    encoder.configure({
      codec: 'vp8',
      width: 320,
      height: 240,
      bitrate: 500_000,
      framerate: 30,
    });

    // Create a test frame using canvas
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'red';
    ctx.fillRect(0, 0, 320, 240);

    const frame = new VideoFrame(canvas, { timestamp: 0 });
    encoder.encode(frame);
    frame.close();

    await encoder.flush();
    encoder.close();

    expect(encodedChunks.length).toBeGreaterThan(0);

    // Now decode
    const decoder = new VideoDecoder({
      output: (frame) => {
        decodedFrames.push(frame);
      },
      error: (e) => {
        throw e;
      },
    });

    decoder.configure({ codec: 'vp8' });

    for (const chunk of encodedChunks) {
      decoder.decode(chunk);
    }

    await decoder.flush();
    decoder.close();

    expect(decodedFrames.length).toBeGreaterThan(0);

    // Clean up
    for (const frame of decodedFrames) {
      frame.close();
    }
  });
});
