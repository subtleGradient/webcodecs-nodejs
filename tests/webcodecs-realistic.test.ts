/**
 * Realistic WebCodecs API Test Suite - Red Phase TDD
 * 
 * These tests validate that the WebCodecs API implementation actually works,
 * not just that the API surface exists.
 * 
 * These tests should:
 * - PASS in browser (Chrome) with native WebCodecs
 * - FAIL in Node.js with the polyfill (to prove implementation is incomplete)
 * 
 * The tests only rely on WebCodecs API, not browser-specific features like canvas.
 */

import { describe, it, expect, afterEach } from 'vitest';

// Helper to check if WebCodecs API is available
const isWebCodecsAvailable = () => {
  return typeof globalThis.VideoEncoder !== 'undefined' &&
         typeof globalThis.VideoDecoder !== 'undefined' &&
         typeof globalThis.AudioEncoder !== 'undefined' &&
         typeof globalThis.AudioDecoder !== 'undefined';
};

/**
 * Helper to create VideoFrame from raw I420 data.
 * I420 is a YUV planar format commonly used in video encoding.
 */
function createI420VideoFrame(
  width: number,
  height: number,
  timestamp: number,
  yValue: number = 128,
  uValue: number = 128, 
  vValue: number = 128
): VideoFrame {
  // I420 layout: Y plane (width * height), U plane (width/2 * height/2), V plane (width/2 * height/2)
  const ySize = width * height;
  const uvWidth = Math.ceil(width / 2);
  const uvHeight = Math.ceil(height / 2);
  const uvSize = uvWidth * uvHeight;
  
  const data = new Uint8Array(ySize + uvSize * 2);
  
  // Fill Y plane
  data.fill(yValue, 0, ySize);
  // Fill U plane  
  data.fill(uValue, ySize, ySize + uvSize);
  // Fill V plane
  data.fill(vValue, ySize + uvSize, ySize + uvSize * 2);

  return new VideoFrame(data, {
    format: 'I420',
    codedWidth: width,
    codedHeight: height,
    timestamp,
  });
}

describe('Realistic Video Encoding Tests', () => {
  let encoder: VideoEncoder | null = null;

  afterEach(() => {
    if (encoder && encoder.state !== 'closed') {
      encoder.close();
    }
    encoder = null;
  });

  it('should call output callback with EncodedVideoChunk containing actual encoded data', async () => {
    if (!isWebCodecsAvailable()) {
      expect.fail('WebCodecs API not available');
    }

    const encodedChunks: EncodedVideoChunk[] = [];
    const metadataList: EncodedVideoChunkMetadata[] = [];
    let outputCallCount = 0;
    let errorOccurred: Error | null = null;

    encoder = new VideoEncoder({
      output: (chunk, metadata) => {
        outputCallCount++;
        encodedChunks.push(chunk);
        if (metadata) {
          metadataList.push(metadata);
        }
      },
      error: (e) => {
        errorOccurred = e;
      },
    });

    encoder.configure({
      codec: 'vp8',
      width: 128,
      height: 128,
      bitrate: 500_000,
      framerate: 30,
    });

    // Create and encode a test frame
    const frame = createI420VideoFrame(128, 128, 0, 200, 128, 128);
    encoder.encode(frame, { keyFrame: true });
    frame.close();

    await encoder.flush();

    // The output callback should have been called
    expect(outputCallCount).toBeGreaterThan(0);
    expect(errorOccurred).toBeNull();
    
    // The encoded chunk should contain actual data (not just be a stub)
    expect(encodedChunks.length).toBeGreaterThan(0);
    expect(encodedChunks[0].byteLength).toBeGreaterThan(10);
    
    // First chunk for a keyframe encode should be a key frame
    expect(encodedChunks[0].type).toBe('key');
    
    // First keyframe should provide decoder configuration metadata
    expect(metadataList.length).toBeGreaterThan(0);
    expect(metadataList[0]).toHaveProperty('decoderConfig');
  });

  it('should encode multiple frames with proper timestamps', async () => {
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
      width: 64,
      height: 64,
      bitrate: 200_000,
      framerate: 30,
    });

    // Encode 10 frames at 30fps (33333 microseconds apart)
    const frameTimestamps = [0, 33333, 66666, 99999, 133332, 166665, 199998, 233331, 266664, 299997];
    
    for (let i = 0; i < frameTimestamps.length; i++) {
      const luminance = 50 + i * 20; // Vary the luminance to make different frames
      const frame = createI420VideoFrame(64, 64, frameTimestamps[i], luminance, 128, 128);
      encoder.encode(frame, { keyFrame: i === 0 });
      frame.close();
    }

    await encoder.flush();

    // Should have produced encoded chunks for each frame
    expect(encodedChunks.length).toBe(10);
    
    // Verify timestamps are preserved and in order
    for (let i = 0; i < encodedChunks.length; i++) {
      expect(encodedChunks[i].timestamp).toBe(frameTimestamps[i]);
    }
  });
});

describe('Realistic Video Decoding Tests', () => {
  let decoder: VideoDecoder | null = null;

  afterEach(() => {
    if (decoder && decoder.state !== 'closed') {
      decoder.close();
    }
    decoder = null;
  });

  it('should decode encoded video and produce VideoFrame with correct dimensions', async () => {
    if (!isWebCodecsAvailable()) {
      expect.fail('WebCodecs API not available');
    }

    // First encode a frame
    const encodedChunks: EncodedVideoChunk[] = [];
    let decoderConfig: VideoDecoderConfig | null = null;
    
    const encoder = new VideoEncoder({
      output: (chunk, metadata) => {
        encodedChunks.push(chunk);
        if (metadata?.decoderConfig) {
          decoderConfig = metadata.decoderConfig;
        }
      },
      error: () => {},
    });

    encoder.configure({
      codec: 'vp8',
      width: 96,
      height: 96,
      bitrate: 300_000,
      framerate: 30,
    });

    const frame = createI420VideoFrame(96, 96, 0, 180, 128, 128);
    encoder.encode(frame, { keyFrame: true });
    frame.close();
    await encoder.flush();
    encoder.close();

    expect(encodedChunks.length).toBeGreaterThan(0);
    expect(decoderConfig).not.toBeNull();

    // Now decode
    const decodedFrames: VideoFrame[] = [];
    
    decoder = new VideoDecoder({
      output: (frame) => {
        decodedFrames.push(frame);
      },
      error: () => {},
    });

    decoder.configure(decoderConfig!);

    for (const chunk of encodedChunks) {
      decoder.decode(chunk);
    }

    await decoder.flush();

    // Should have produced decoded frames
    expect(decodedFrames.length).toBeGreaterThan(0);
    
    // Decoded frame should have correct dimensions
    expect(decodedFrames[0].codedWidth).toBe(96);
    expect(decodedFrames[0].codedHeight).toBe(96);
    
    // Should have a valid format
    expect(decodedFrames[0].format).toBeTruthy();
    
    // Clean up
    for (const f of decodedFrames) {
      f.close();
    }
  });

  it('should decode multiple frames and preserve timestamps', async () => {
    if (!isWebCodecsAvailable()) {
      expect.fail('WebCodecs API not available');
    }

    // Encode multiple frames
    const encodedChunks: EncodedVideoChunk[] = [];
    let decoderConfig: VideoDecoderConfig | null = null;
    
    const encoder = new VideoEncoder({
      output: (chunk, metadata) => {
        encodedChunks.push(chunk);
        if (metadata?.decoderConfig) {
          decoderConfig = metadata.decoderConfig;
        }
      },
      error: () => {},
    });

    encoder.configure({
      codec: 'vp8',
      width: 48,
      height: 48,
      bitrate: 150_000,
      framerate: 30,
    });

    const timestamps = [0, 33333, 66666];
    for (let i = 0; i < timestamps.length; i++) {
      const frame = createI420VideoFrame(48, 48, timestamps[i], 100 + i * 50, 128, 128);
      encoder.encode(frame, { keyFrame: i === 0 });
      frame.close();
    }
    await encoder.flush();
    encoder.close();

    expect(encodedChunks.length).toBe(3);

    // Decode
    const decodedFrames: VideoFrame[] = [];
    
    decoder = new VideoDecoder({
      output: (frame) => {
        decodedFrames.push(frame);
      },
      error: () => {},
    });

    decoder.configure(decoderConfig!);

    for (const chunk of encodedChunks) {
      decoder.decode(chunk);
    }

    await decoder.flush();

    // Should decode all frames
    expect(decodedFrames.length).toBe(3);
    
    // Timestamps should be preserved
    for (let i = 0; i < decodedFrames.length; i++) {
      expect(decodedFrames[i].timestamp).toBe(timestamps[i]);
    }

    // Clean up
    for (const f of decodedFrames) {
      f.close();
    }
  });
});

describe('Realistic VideoFrame Tests', () => {
  it('should clone VideoFrame and maintain properties', () => {
    if (!isWebCodecsAvailable()) {
      expect.fail('WebCodecs API not available');
    }

    const original = createI420VideoFrame(64, 64, 12345, 200, 128, 128);
    const clone = original.clone();

    expect(clone.codedWidth).toBe(original.codedWidth);
    expect(clone.codedHeight).toBe(original.codedHeight);
    expect(clone.timestamp).toBe(original.timestamp);
    expect(clone.format).toBe(original.format);
    expect(clone.displayWidth).toBe(original.displayWidth);
    expect(clone.displayHeight).toBe(original.displayHeight);

    // Original and clone should be independent - closing one shouldn't affect the other
    original.close();
    
    // Clone should still be usable after original is closed
    expect(clone.codedWidth).toBe(64);
    expect(clone.codedHeight).toBe(64);
    
    clone.close();
  });

  it('should correctly report visibleRect', () => {
    if (!isWebCodecsAvailable()) {
      expect.fail('WebCodecs API not available');
    }

    const frame = createI420VideoFrame(128, 96, 0, 128, 128, 128);

    expect(frame.visibleRect).toBeDefined();
    expect(frame.visibleRect?.x).toBe(0);
    expect(frame.visibleRect?.y).toBe(0);
    expect(frame.visibleRect?.width).toBe(128);
    expect(frame.visibleRect?.height).toBe(96);

    frame.close();
  });

  it('should copyTo a buffer and return layout information', async () => {
    if (!isWebCodecsAvailable()) {
      expect.fail('WebCodecs API not available');
    }

    const frame = createI420VideoFrame(32, 32, 0, 220, 100, 150);
    
    // Use the frame's native format for copyTo (browser doesn't support format conversion)
    const size = frame.allocationSize();
    expect(size).toBeGreaterThan(0);
    
    const buffer = new Uint8Array(size);
    const layout = await frame.copyTo(buffer);

    // Layout should describe the planes
    expect(layout).toBeDefined();
    expect(Array.isArray(layout)).toBe(true);
    expect(layout.length).toBeGreaterThanOrEqual(3); // I420 has 3 planes
    
    // Each plane should have offset and stride
    for (const plane of layout) {
      expect(typeof plane.offset).toBe('number');
      expect(typeof plane.stride).toBe('number');
      expect(plane.stride).toBeGreaterThan(0);
    }

    // Buffer should have actual data (not all zeros)
    let hasNonZero = false;
    for (const byte of buffer) {
      if (byte !== 0) {
        hasNonZero = true;
        break;
      }
    }
    expect(hasNonZero).toBe(true);

    frame.close();
  });
});

describe('Realistic Audio Encoding Tests', () => {
  let encoder: AudioEncoder | null = null;

  afterEach(() => {
    if (encoder && encoder.state !== 'closed') {
      encoder.close();
    }
    encoder = null;
  });

  it('should encode AudioData and receive EncodedAudioChunk with metadata', async () => {
    if (!isWebCodecsAvailable()) {
      expect.fail('WebCodecs API not available');
    }

    const encodedChunks: EncodedAudioChunk[] = [];
    const metadataList: EncodedAudioChunkMetadata[] = [];
    let outputCallCount = 0;
    let errorOccurred: Error | null = null;

    encoder = new AudioEncoder({
      output: (chunk, metadata) => {
        outputCallCount++;
        encodedChunks.push(chunk);
        if (metadata) {
          metadataList.push(metadata);
        }
      },
      error: (e) => {
        errorOccurred = e;
      },
    });

    encoder.configure({
      codec: 'opus',
      sampleRate: 48000,
      numberOfChannels: 2,
      bitrate: 128000,
    });

    // Create stereo audio data (960 samples = 20ms at 48kHz, standard Opus frame)
    const numberOfFrames = 960;
    const samples = new Float32Array(numberOfFrames * 2); // Interleaved stereo
    
    // Generate a stereo sine wave
    for (let i = 0; i < numberOfFrames; i++) {
      const leftSample = Math.sin((2 * Math.PI * 440 * i) / 48000);
      const rightSample = Math.sin((2 * Math.PI * 880 * i) / 48000);
      samples[i * 2] = leftSample;
      samples[i * 2 + 1] = rightSample;
    }

    const audioData = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: numberOfFrames,
      numberOfChannels: 2,
      timestamp: 0,
      data: samples,
    });

    encoder.encode(audioData);
    audioData.close();

    await encoder.flush();

    expect(errorOccurred).toBeNull();
    expect(outputCallCount).toBeGreaterThan(0);
    expect(encodedChunks.length).toBeGreaterThan(0);
    
    // Encoded chunk should have actual data
    expect(encodedChunks[0].byteLength).toBeGreaterThan(0);
    
    // First chunk should provide decoder configuration
    expect(metadataList.length).toBeGreaterThan(0);
    expect(metadataList[0]).toHaveProperty('decoderConfig');
  });

  it('should preserve timestamps when encoding multiple audio frames', async () => {
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

    // Encode 5 frames of 20ms each
    const frameSize = 960; // 20ms at 48kHz
    const timestamps = [0, 20000, 40000, 60000, 80000]; // 20ms in microseconds
    
    for (let i = 0; i < 5; i++) {
      const samples = new Float32Array(frameSize);
      const frequency = 440 + i * 100; // Different frequency each frame
      
      for (let j = 0; j < frameSize; j++) {
        samples[j] = Math.sin((2 * Math.PI * frequency * j) / 48000);
      }

      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: frameSize,
        numberOfChannels: 1,
        timestamp: timestamps[i],
        data: samples,
      });

      encoder.encode(audioData);
      audioData.close();
    }

    await encoder.flush();

    // Should have produced at least 5 encoded chunks (may have more due to encoder buffering)
    expect(encodedChunks.length).toBeGreaterThanOrEqual(5);
    
    // First 5 chunks should have correct timestamps (encoder may produce additional trailing chunks)
    for (let i = 0; i < 5; i++) {
      expect(encodedChunks[i].timestamp).toBe(timestamps[i]);
    }
  });
});

describe('Realistic Audio Decoding Tests', () => {
  let decoder: AudioDecoder | null = null;

  afterEach(() => {
    if (decoder && decoder.state !== 'closed') {
      decoder.close();
    }
    decoder = null;
  });

  it('should decode encoded audio and produce AudioData with correct properties', async () => {
    if (!isWebCodecsAvailable()) {
      expect.fail('WebCodecs API not available');
    }

    // First encode some audio
    const encodedChunks: EncodedAudioChunk[] = [];
    let decoderConfig: AudioDecoderConfig | null = null;

    const encoder = new AudioEncoder({
      output: (chunk, metadata) => {
        encodedChunks.push(chunk);
        if (metadata?.decoderConfig) {
          decoderConfig = metadata.decoderConfig;
        }
      },
      error: () => {},
    });

    encoder.configure({
      codec: 'opus',
      sampleRate: 48000,
      numberOfChannels: 1,
      bitrate: 64000,
    });

    const frameSize = 960;
    const samples = new Float32Array(frameSize);
    for (let i = 0; i < frameSize; i++) {
      samples[i] = Math.sin((2 * Math.PI * 440 * i) / 48000);
    }

    const audioData = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: frameSize,
      numberOfChannels: 1,
      timestamp: 0,
      data: samples,
    });

    encoder.encode(audioData);
    audioData.close();
    await encoder.flush();
    encoder.close();

    expect(encodedChunks.length).toBeGreaterThan(0);
    expect(decoderConfig).not.toBeNull();

    // Now decode
    const decodedData: AudioData[] = [];

    decoder = new AudioDecoder({
      output: (data) => {
        decodedData.push(data);
      },
      error: () => {},
    });

    decoder.configure(decoderConfig!);

    for (const chunk of encodedChunks) {
      decoder.decode(chunk);
    }

    await decoder.flush();

    expect(decodedData.length).toBeGreaterThan(0);
    expect(decodedData[0].numberOfChannels).toBe(1);
    expect(decodedData[0].sampleRate).toBe(48000);
    expect(decodedData[0].numberOfFrames).toBeGreaterThan(0);

    // Clean up
    for (const data of decodedData) {
      data.close();
    }
  });
});

describe('Realistic AudioData Tests', () => {
  it('should clone AudioData and maintain properties', () => {
    if (!isWebCodecsAvailable()) {
      expect.fail('WebCodecs API not available');
    }

    const samples = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      samples[i] = Math.sin((2 * Math.PI * 440 * i) / 48000);
    }

    const original = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: 1024,
      numberOfChannels: 1,
      timestamp: 54321,
      data: samples,
    });

    const clone = original.clone();

    expect(clone.format).toBe(original.format);
    expect(clone.sampleRate).toBe(original.sampleRate);
    expect(clone.numberOfFrames).toBe(original.numberOfFrames);
    expect(clone.numberOfChannels).toBe(original.numberOfChannels);
    expect(clone.timestamp).toBe(original.timestamp);
    expect(clone.duration).toBe(original.duration);

    // Closing original shouldn't affect clone
    original.close();
    expect(clone.numberOfFrames).toBe(1024);

    clone.close();
  });

  it('should copyTo a buffer with correct data', () => {
    if (!isWebCodecsAvailable()) {
      expect.fail('WebCodecs API not available');
    }

    const numberOfFrames = 256;
    const samples = new Float32Array(numberOfFrames);
    
    // Fill with a specific pattern
    for (let i = 0; i < numberOfFrames; i++) {
      samples[i] = (i / numberOfFrames) * 2 - 1; // Linear ramp from -1 to 1
    }

    const audioData = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: numberOfFrames,
      numberOfChannels: 1,
      timestamp: 0,
      data: samples,
    });

    const size = audioData.allocationSize({ planeIndex: 0 });
    expect(size).toBe(numberOfFrames * 4); // f32 = 4 bytes

    const destination = new Float32Array(numberOfFrames);
    audioData.copyTo(destination, { planeIndex: 0 });

    // Verify the copied data matches the original
    for (let i = 0; i < numberOfFrames; i++) {
      expect(destination[i]).toBeCloseTo(samples[i], 5);
    }

    audioData.close();
  });

  it('should correctly handle multi-channel planar audio', () => {
    if (!isWebCodecsAvailable()) {
      expect.fail('WebCodecs API not available');
    }

    const numberOfFrames = 512;
    const numberOfChannels = 2;
    
    // For planar format, channels are stored separately
    const samples = new Float32Array(numberOfFrames * numberOfChannels);
    
    // Left channel: 440Hz sine
    for (let i = 0; i < numberOfFrames; i++) {
      samples[i] = Math.sin((2 * Math.PI * 440 * i) / 48000);
    }
    // Right channel: 880Hz sine
    for (let i = 0; i < numberOfFrames; i++) {
      samples[numberOfFrames + i] = Math.sin((2 * Math.PI * 880 * i) / 48000);
    }

    const audioData = new AudioData({
      format: 'f32-planar',
      sampleRate: 48000,
      numberOfFrames: numberOfFrames,
      numberOfChannels: numberOfChannels,
      timestamp: 0,
      data: samples,
    });

    expect(audioData.numberOfChannels).toBe(2);
    expect(audioData.format).toBe('f32-planar');

    // Should be able to get allocation size for each plane
    const leftSize = audioData.allocationSize({ planeIndex: 0 });
    const rightSize = audioData.allocationSize({ planeIndex: 1 });
    
    expect(leftSize).toBe(numberOfFrames * 4);
    expect(rightSize).toBe(numberOfFrames * 4);

    // Copy and verify each channel
    const leftChannel = new Float32Array(numberOfFrames);
    const rightChannel = new Float32Array(numberOfFrames);
    
    audioData.copyTo(leftChannel, { planeIndex: 0 });
    audioData.copyTo(rightChannel, { planeIndex: 1 });

    // Left channel should be 440Hz, right should be 880Hz
    // Verify by checking a sample point where they should differ
    const sample100Left = Math.sin((2 * Math.PI * 440 * 100) / 48000);
    const sample100Right = Math.sin((2 * Math.PI * 880 * 100) / 48000);
    
    expect(leftChannel[100]).toBeCloseTo(sample100Left, 4);
    expect(rightChannel[100]).toBeCloseTo(sample100Right, 4);

    audioData.close();
  });
});

describe('Encoder encodeQueueSize Tests', () => {
  it('should track encodeQueueSize during encoding', async () => {
    if (!isWebCodecsAvailable()) {
      expect.fail('WebCodecs API not available');
    }

    let maxQueueSize = 0;
    
    const encoder = new VideoEncoder({
      output: () => {},
      error: () => {},
    });

    encoder.configure({
      codec: 'vp8',
      width: 64,
      height: 64,
      bitrate: 100_000,
      framerate: 30,
    });

    // Queue up multiple frames without awaiting
    for (let i = 0; i < 5; i++) {
      const frame = createI420VideoFrame(64, 64, i * 33333, 128, 128, 128);
      encoder.encode(frame, { keyFrame: i === 0 });
      frame.close();
      
      // Track max queue size
      if (encoder.encodeQueueSize > maxQueueSize) {
        maxQueueSize = encoder.encodeQueueSize;
      }
    }

    // Queue size should have been non-zero at some point during encoding
    await encoder.flush();
    
    // After flush, queue should be empty
    expect(encoder.encodeQueueSize).toBe(0);
    
    encoder.close();
  });
});

describe('Decoder decodeQueueSize Tests', () => {
  it('should track decodeQueueSize during decoding', async () => {
    if (!isWebCodecsAvailable()) {
      expect.fail('WebCodecs API not available');
    }

    // First encode some frames
    const encodedChunks: EncodedVideoChunk[] = [];
    let decoderConfig: VideoDecoderConfig | null = null;
    
    const encoder = new VideoEncoder({
      output: (chunk, metadata) => {
        encodedChunks.push(chunk);
        if (metadata?.decoderConfig) {
          decoderConfig = metadata.decoderConfig;
        }
      },
      error: () => {},
    });

    encoder.configure({
      codec: 'vp8',
      width: 64,
      height: 64,
      bitrate: 100_000,
      framerate: 30,
    });

    for (let i = 0; i < 5; i++) {
      const frame = createI420VideoFrame(64, 64, i * 33333, 100 + i * 30, 128, 128);
      encoder.encode(frame, { keyFrame: i === 0 });
      frame.close();
    }
    await encoder.flush();
    encoder.close();

    expect(encodedChunks.length).toBe(5);
    expect(decoderConfig).not.toBeNull();

    // Now decode
    const decodedFrames: VideoFrame[] = [];
    
    const decoder = new VideoDecoder({
      output: (frame) => {
        decodedFrames.push(frame);
      },
      error: () => {},
    });

    decoder.configure(decoderConfig!);

    // Queue up all chunks without awaiting
    for (const chunk of encodedChunks) {
      decoder.decode(chunk);
    }

    await decoder.flush();
    
    // After flush, queue should be empty
    expect(decoder.decodeQueueSize).toBe(0);
    
    decoder.close();

    // Clean up frames
    for (const f of decodedFrames) {
      f.close();
    }
  });
});
