/**
 * WebCodecs Functional Test Suite
 * 
 * These tests verify that WebCodecs actually performs encoding/decoding operations.
 * They are environment-agnostic and should work in both Node.js and browser.
 * 
 * In browsers with native WebCodecs, these tests should pass.
 * In Node.js with an incomplete polyfill, these tests should fail,
 * proving that the implementation is not complete.
 */

import { describe, it, expect, afterEach } from 'vitest';

// Helper to check if WebCodecs API is available
const isWebCodecsAvailable = () => {
  return typeof globalThis.VideoEncoder !== 'undefined' &&
         typeof globalThis.VideoDecoder !== 'undefined' &&
         typeof globalThis.AudioEncoder !== 'undefined' &&
         typeof globalThis.AudioDecoder !== 'undefined';
};

describe('AudioEncoder Functional Tests', () => {
  let encoder: AudioEncoder | null = null;

  afterEach(() => {
    if (encoder && encoder.state !== 'closed') {
      encoder.close();
    }
    encoder = null;
  });

  it('should actually produce encoded audio chunks when encoding AudioData', async () => {
    if (!isWebCodecsAvailable()) {
      expect.fail('WebCodecs API not available');
    }

    const encodedChunks: EncodedAudioChunk[] = [];
    let errorOccurred: Error | null = null;

    encoder = new AudioEncoder({
      output: (chunk) => {
        encodedChunks.push(chunk);
      },
      error: (e) => {
        errorOccurred = e;
      },
    });

    // Configure with Opus codec (widely supported)
    encoder.configure({
      codec: 'opus',
      sampleRate: 48000,
      numberOfChannels: 1,
      bitrate: 64000,
    });

    expect(encoder.state).toBe('configured');

    // Create audio samples - a simple 480-sample frame (10ms at 48kHz)
    // This is the standard Opus frame size
    const numberOfFrames = 480;
    const samples = new Float32Array(numberOfFrames);
    // Fill with a 440Hz sine wave
    for (let i = 0; i < numberOfFrames; i++) {
      samples[i] = Math.sin((2 * Math.PI * 440 * i) / 48000);
    }

    const audioData = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: numberOfFrames,
      numberOfChannels: 1,
      timestamp: 0,
      data: samples,
    });

    // Encode the audio data
    encoder.encode(audioData);
    audioData.close();

    // Flush to ensure all output is produced
    await encoder.flush();

    // The encoder should have produced at least one encoded chunk
    expect(errorOccurred).toBeNull();
    expect(encodedChunks.length).toBeGreaterThan(0);
    expect(encodedChunks[0].byteLength).toBeGreaterThan(0);
  });

  it('should produce multiple chunks when encoding multiple AudioData frames', async () => {
    if (!isWebCodecsAvailable()) {
      expect.fail('WebCodecs API not available');
    }

    const encodedChunks: EncodedAudioChunk[] = [];

    encoder = new AudioEncoder({
      output: (chunk) => {
        encodedChunks.push(chunk);
      },
      error: () => {},
    });

    encoder.configure({
      codec: 'opus',
      sampleRate: 48000,
      numberOfChannels: 1,
      bitrate: 64000,
    });

    // Encode 5 frames of audio
    const numberOfFrames = 480; // 10ms at 48kHz
    for (let frameIndex = 0; frameIndex < 5; frameIndex++) {
      const samples = new Float32Array(numberOfFrames);
      for (let i = 0; i < numberOfFrames; i++) {
        samples[i] = Math.sin((2 * Math.PI * 440 * i) / 48000);
      }

      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: numberOfFrames,
        numberOfChannels: 1,
        timestamp: frameIndex * 10000, // 10ms in microseconds
        data: samples,
      });

      encoder.encode(audioData);
      audioData.close();
    }

    await encoder.flush();

    // Should have produced encoded chunks
    expect(encodedChunks.length).toBeGreaterThan(0);
    
    // Each chunk should have data
    for (const chunk of encodedChunks) {
      expect(chunk.byteLength).toBeGreaterThan(0);
    }
  });
});

describe('AudioDecoder Functional Tests', () => {
  let decoder: AudioDecoder | null = null;

  afterEach(() => {
    if (decoder && decoder.state !== 'closed') {
      decoder.close();
    }
    decoder = null;
  });

  it('should actually produce decoded AudioData when decoding EncodedAudioChunk', async () => {
    if (!isWebCodecsAvailable()) {
      expect.fail('WebCodecs API not available');
    }

    // First, encode some audio to get valid encoded data
    const encodedChunks: EncodedAudioChunk[] = [];
    const encoder = new AudioEncoder({
      output: (chunk) => {
        encodedChunks.push(chunk);
      },
      error: () => {},
    });

    encoder.configure({
      codec: 'opus',
      sampleRate: 48000,
      numberOfChannels: 1,
      bitrate: 64000,
    });

    const numberOfFrames = 480;
    const samples = new Float32Array(numberOfFrames);
    for (let i = 0; i < numberOfFrames; i++) {
      samples[i] = Math.sin((2 * Math.PI * 440 * i) / 48000);
    }

    const audioData = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: numberOfFrames,
      numberOfChannels: 1,
      timestamp: 0,
      data: samples,
    });

    encoder.encode(audioData);
    audioData.close();
    await encoder.flush();
    encoder.close();

    // Skip if encoding didn't produce output (polyfill limitation)
    if (encodedChunks.length === 0) {
      expect.fail('Encoding did not produce any chunks - decoder test cannot proceed');
    }

    // Now decode
    const decodedData: AudioData[] = [];
    decoder = new AudioDecoder({
      output: (data) => {
        decodedData.push(data);
      },
      error: () => {},
    });

    decoder.configure({
      codec: 'opus',
      sampleRate: 48000,
      numberOfChannels: 1,
    });

    // Decode the encoded chunks
    for (const chunk of encodedChunks) {
      decoder.decode(chunk);
    }

    await decoder.flush();

    // Should have produced decoded audio data
    expect(decodedData.length).toBeGreaterThan(0);
    expect(decodedData[0].numberOfFrames).toBeGreaterThan(0);

    // Clean up
    for (const data of decodedData) {
      data.close();
    }
  });
});

describe('AudioData Functional Tests', () => {
  it('should correctly copy audio data to destination buffer via copyTo', () => {
    if (!isWebCodecsAvailable()) {
      expect.fail('WebCodecs API not available');
    }

    const numberOfFrames = 128;
    const samples = new Float32Array(numberOfFrames);
    
    // Fill with known values
    for (let i = 0; i < numberOfFrames; i++) {
      samples[i] = i / numberOfFrames; // Values from 0 to ~1
    }

    const audioData = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: numberOfFrames,
      numberOfChannels: 1,
      timestamp: 0,
      data: samples,
    });

    // Create destination buffer
    const destination = new Float32Array(numberOfFrames);
    
    // Copy data to destination
    audioData.copyTo(destination, { planeIndex: 0 });

    // Verify the data was actually copied
    expect(destination[0]).toBeCloseTo(samples[0], 5);
    expect(destination[64]).toBeCloseTo(samples[64], 5);
    expect(destination[127]).toBeCloseTo(samples[127], 5);
    
    // Verify entire buffer matches
    for (let i = 0; i < numberOfFrames; i++) {
      expect(destination[i]).toBeCloseTo(samples[i], 5);
    }

    audioData.close();
  });

  it('should provide correct allocationSize for audio data', () => {
    if (!isWebCodecsAvailable()) {
      expect.fail('WebCodecs API not available');
    }

    const numberOfFrames = 1024;
    const samples = new Float32Array(numberOfFrames);

    const audioData = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: numberOfFrames,
      numberOfChannels: 1,
      timestamp: 0,
      data: samples,
    });

    // f32 format = 4 bytes per sample
    const expectedSize = numberOfFrames * 4;
    const actualSize = audioData.allocationSize({ planeIndex: 0 });

    expect(actualSize).toBe(expectedSize);

    audioData.close();
  });
});

describe('VideoFrame Functional Tests', () => {
  it('should create VideoFrame from raw RGBA data', () => {
    if (!isWebCodecsAvailable()) {
      expect.fail('WebCodecs API not available');
    }

    const width = 16;
    const height = 16;
    // RGBA format: 4 bytes per pixel
    const data = new Uint8Array(width * height * 4);
    
    // Fill with a known pattern (red pixels)
    for (let i = 0; i < width * height; i++) {
      data[i * 4 + 0] = 255; // R
      data[i * 4 + 1] = 0;   // G
      data[i * 4 + 2] = 0;   // B
      data[i * 4 + 3] = 255; // A
    }

    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
    });

    expect(frame.codedWidth).toBe(width);
    expect(frame.codedHeight).toBe(height);
    expect(frame.format).toBe('RGBA');
    expect(frame.timestamp).toBe(0);

    frame.close();
  });

  it('should correctly copy VideoFrame data via copyTo', async () => {
    if (!isWebCodecsAvailable()) {
      expect.fail('WebCodecs API not available');
    }

    const width = 8;
    const height = 8;
    const data = new Uint8Array(width * height * 4);
    
    // Fill with a known pattern
    for (let i = 0; i < width * height; i++) {
      data[i * 4 + 0] = i % 256;     // R varies
      data[i * 4 + 1] = (i * 2) % 256; // G varies differently
      data[i * 4 + 2] = 128;          // B constant
      data[i * 4 + 3] = 255;          // A constant
    }

    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
    });

    // Get allocation size and create destination buffer
    const size = frame.allocationSize({ format: 'RGBA' });
    expect(size).toBe(width * height * 4);

    const destination = new Uint8Array(size);
    await frame.copyTo(destination, { format: 'RGBA' });

    // Verify the data was copied correctly
    for (let i = 0; i < data.length; i++) {
      expect(destination[i]).toBe(data[i]);
    }

    frame.close();
  });

  it('should have correct displayWidth and displayHeight', () => {
    if (!isWebCodecsAvailable()) {
      expect.fail('WebCodecs API not available');
    }

    const width = 320;
    const height = 240;
    const data = new Uint8Array(width * height * 4);

    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
    });

    // displayWidth/displayHeight should default to codedWidth/codedHeight
    expect(frame.displayWidth).toBe(width);
    expect(frame.displayHeight).toBe(height);

    frame.close();
  });
});

describe('VideoEncoder Functional Tests', () => {
  let encoder: VideoEncoder | null = null;

  afterEach(() => {
    if (encoder && encoder.state !== 'closed') {
      encoder.close();
    }
    encoder = null;
  });

  it('should actually produce encoded video chunks when encoding VideoFrame', async () => {
    if (!isWebCodecsAvailable()) {
      expect.fail('WebCodecs API not available');
    }

    const encodedChunks: EncodedVideoChunk[] = [];
    let errorOccurred: Error | null = null;

    encoder = new VideoEncoder({
      output: (chunk) => {
        encodedChunks.push(chunk);
      },
      error: (e) => {
        errorOccurred = e;
      },
    });

    encoder.configure({
      codec: 'vp8',
      width: 64,
      height: 64,
      bitrate: 100000,
      framerate: 30,
    });

    expect(encoder.state).toBe('configured');

    // Create a simple VideoFrame from raw RGBA data
    const width = 64;
    const height = 64;
    const data = new Uint8Array(width * height * 4);
    
    // Fill with solid color
    for (let i = 0; i < width * height; i++) {
      data[i * 4 + 0] = 255; // R
      data[i * 4 + 1] = 0;   // G
      data[i * 4 + 2] = 0;   // B
      data[i * 4 + 3] = 255; // A
    }

    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
    });

    encoder.encode(frame, { keyFrame: true });
    frame.close();

    await encoder.flush();

    expect(errorOccurred).toBeNull();
    expect(encodedChunks.length).toBeGreaterThan(0);
    expect(encodedChunks[0].byteLength).toBeGreaterThan(0);
    expect(encodedChunks[0].type).toBe('key');
  });

  it('should produce multiple chunks when encoding multiple frames', async () => {
    if (!isWebCodecsAvailable()) {
      expect.fail('WebCodecs API not available');
    }

    const encodedChunks: EncodedVideoChunk[] = [];

    encoder = new VideoEncoder({
      output: (chunk) => {
        encodedChunks.push(chunk);
      },
      error: () => {},
    });

    encoder.configure({
      codec: 'vp8',
      width: 32,
      height: 32,
      bitrate: 50000,
      framerate: 30,
    });

    const width = 32;
    const height = 32;

    // Encode 5 frames
    for (let frameIndex = 0; frameIndex < 5; frameIndex++) {
      const data = new Uint8Array(width * height * 4);
      // Vary color per frame
      for (let i = 0; i < width * height; i++) {
        data[i * 4 + 0] = (frameIndex * 50) % 256;
        data[i * 4 + 1] = 100;
        data[i * 4 + 2] = 100;
        data[i * 4 + 3] = 255;
      }

      const frame = new VideoFrame(data, {
        format: 'RGBA',
        codedWidth: width,
        codedHeight: height,
        timestamp: frameIndex * 33333, // ~30fps in microseconds
      });

      encoder.encode(frame, { keyFrame: frameIndex === 0 });
      frame.close();
    }

    await encoder.flush();

    expect(encodedChunks.length).toBeGreaterThan(0);
    
    // First chunk should be a keyframe
    expect(encodedChunks[0].type).toBe('key');
    
    // All chunks should have data
    for (const chunk of encodedChunks) {
      expect(chunk.byteLength).toBeGreaterThan(0);
    }
  });
});

describe('VideoDecoder Functional Tests', () => {
  let decoder: VideoDecoder | null = null;

  afterEach(() => {
    if (decoder && decoder.state !== 'closed') {
      decoder.close();
    }
    decoder = null;
  });

  it('should actually produce decoded VideoFrames when decoding EncodedVideoChunk', async () => {
    if (!isWebCodecsAvailable()) {
      expect.fail('WebCodecs API not available');
    }

    // First, encode a frame to get valid encoded data
    const encodedChunks: EncodedVideoChunk[] = [];
    let encoderConfig: VideoEncoderConfig | null = null;
    
    const encoder = new VideoEncoder({
      output: (chunk, metadata) => {
        encodedChunks.push(chunk);
        if (metadata?.decoderConfig) {
          encoderConfig = metadata.decoderConfig;
        }
      },
      error: () => {},
    });

    encoder.configure({
      codec: 'vp8',
      width: 64,
      height: 64,
      bitrate: 100000,
      framerate: 30,
    });

    const width = 64;
    const height = 64;
    const data = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      data[i * 4 + 0] = 255;
      data[i * 4 + 1] = 0;
      data[i * 4 + 2] = 0;
      data[i * 4 + 3] = 255;
    }

    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
    });

    encoder.encode(frame, { keyFrame: true });
    frame.close();
    await encoder.flush();
    encoder.close();

    // Skip if encoding didn't produce output
    if (encodedChunks.length === 0) {
      expect.fail('Encoding did not produce any chunks - decoder test cannot proceed');
    }

    // Now decode
    const decodedFrames: VideoFrame[] = [];
    decoder = new VideoDecoder({
      output: (frame) => {
        decodedFrames.push(frame);
      },
      error: () => {},
    });

    decoder.configure({
      codec: 'vp8',
      codedWidth: width,
      codedHeight: height,
    });

    for (const chunk of encodedChunks) {
      decoder.decode(chunk);
    }

    await decoder.flush();

    expect(decodedFrames.length).toBeGreaterThan(0);
    expect(decodedFrames[0].codedWidth).toBe(width);
    expect(decodedFrames[0].codedHeight).toBe(height);

    // Clean up
    for (const f of decodedFrames) {
      f.close();
    }
  });
});

describe('EncodedVideoChunk Functional Tests', () => {
  it('should correctly copy chunk data to destination buffer', () => {
    if (!isWebCodecsAvailable()) {
      expect.fail('WebCodecs API not available');
    }

    // Create a chunk with known data
    const originalData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const chunk = new EncodedVideoChunk({
      type: 'key',
      timestamp: 0,
      data: originalData,
    });

    expect(chunk.byteLength).toBe(10);

    // Copy to destination
    const destination = new Uint8Array(chunk.byteLength);
    chunk.copyTo(destination);

    // Verify the copy
    for (let i = 0; i < originalData.length; i++) {
      expect(destination[i]).toBe(originalData[i]);
    }
  });
});

describe('EncodedAudioChunk Functional Tests', () => {
  it('should correctly copy chunk data to destination buffer', () => {
    if (!isWebCodecsAvailable()) {
      expect.fail('WebCodecs API not available');
    }

    const originalData = new Uint8Array([11, 22, 33, 44, 55, 66, 77, 88]);
    const chunk = new EncodedAudioChunk({
      type: 'key',
      timestamp: 0,
      data: originalData,
    });

    expect(chunk.byteLength).toBe(8);

    const destination = new Uint8Array(chunk.byteLength);
    chunk.copyTo(destination);

    for (let i = 0; i < originalData.length; i++) {
      expect(destination[i]).toBe(originalData[i]);
    }
  });
});
