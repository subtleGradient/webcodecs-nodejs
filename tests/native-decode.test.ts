/**
 * Native Decode Integration Tests (Node.js only)
 * 
 * These tests verify that our native N-API addon can actually decode video.
 * We use "secret colors" - specific RGB values encoded into test frames.
 * If we can read back the correct color, we know real decoding happened.
 * 
 * Scientific Verification:
 * - A solid red frame encoded as VP8 should decode to red pixels
 * - If it decodes to green or garbage, the decoder is broken
 * - No false positives possible with this approach
 * 
 * NOTE: These tests only run in Node.js since they test our N-API addon.
 * In browser, the native WebCodecs API is used instead.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Secret colors and tolerance from fixture generator
const SECRET_COLORS = {
  RED: { r: 255, g: 0, b: 0 },
  SECRET_1: { r: 0xDE, g: 0xAD, b: 0xBE },
  SECRET_2: { r: 0xCA, g: 0xFE, b: 0x42 },
};
const COLOR_TOLERANCE = 8;

// Helper to check if native addon is available
function tryLoadNative() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../build/Release/webcodecs_native.node');
  } catch {
    return null;
  }
}

// Helper to extract raw VP8 frame from IVF container
function extractVP8Frame(ivfPath: string): Buffer {
  const data = readFileSync(ivfPath);
  // IVF: 32-byte file header, then 12-byte frame header per frame
  const frameSize = data.readUInt32LE(32);
  return data.subarray(44, 44 + frameSize);
}

// Helper to check color match within tolerance
function colorsMatch(
  actual: { r: number; g: number; b: number },
  expected: { r: number; g: number; b: number },
  tolerance: number
): boolean {
  return (
    Math.abs(actual.r - expected.r) <= tolerance &&
    Math.abs(actual.g - expected.g) <= tolerance &&
    Math.abs(actual.b - expected.b) <= tolerance
  );
}

describe('Native Addon Loading', () => {
  it('should load the native addon', () => {
    const native = tryLoadNative();
    
    if (!native) {
      console.log('Native addon not built yet. Run: npm run build:native');
      expect.fail('Native addon not available - run npm run build:native');
    }
    
    expect(native).toBeDefined();
    expect(typeof native.hello).toBe('function');
  });

  it('should return hello message', () => {
    const native = tryLoadNative();
    if (!native) {
      expect.fail('Native addon not available');
    }
    
    const msg = native.hello();
    expect(msg).toContain('Hello');
    expect(msg).toContain('WebCodecs');
  });

  it('should return FFmpeg version info', () => {
    const native = tryLoadNative();
    if (!native) {
      expect.fail('Native addon not available');
    }
    
    const version = native.getFFmpegVersion();
    expect(version).toContain('libavcodec');
    expect(version).toContain('libavformat');
    console.log('FFmpeg version:', version);
  });

  it('should detect VP8 codec availability', () => {
    const native = tryLoadNative();
    if (!native) {
      expect.fail('Native addon not available');
    }
    
    const vp8 = native.hasCodec('vp8');
    expect(vp8.decoder).toBe(true);
    console.log('VP8 support:', vp8);
  });
});

describe('VP8 Decode with Secret Color Verification', () => {
  const fixturesDir = join(__dirname, '..', 'fixtures', 'vp8');
  let native: ReturnType<typeof tryLoadNative>;

  beforeAll(() => {
    native = tryLoadNative();
  });

  it('should decode VP8 red frame and verify color', () => {
    if (!native) {
      expect.fail('Native addon not available - run npm run build:native');
    }

    const ivfPath = join(fixturesDir, 'vp8-red-64x64.ivf');
    if (!existsSync(ivfPath)) {
      console.log('Fixtures not generated. Run: npm run generate:fixtures');
      expect.fail('Test fixtures not found - run npm run generate:fixtures');
    }

    // Extract raw VP8 frame data
    const frameData = extractVP8Frame(ivfPath);
    expect(frameData.length).toBeGreaterThan(0);
    console.log(`VP8 frame size: ${frameData.length} bytes`);

    // Decode using native addon
    const result = native.decodeVP8Frame(frameData);
    
    expect(result).toBeDefined();
    expect(result.width).toBe(64);
    expect(result.height).toBe(64);
    expect(result.format).toBe('rgb24');
    expect(result.data).toBeInstanceOf(Buffer);
    expect(result.data.length).toBe(64 * 64 * 3); // RGB24

    // Verify the SECRET: first pixel should be RED
    const actualColor = {
      r: result.firstPixelR,
      g: result.firstPixelG,
      b: result.firstPixelB,
    };

    console.log(`Expected: R=${SECRET_COLORS.RED.r}, G=${SECRET_COLORS.RED.g}, B=${SECRET_COLORS.RED.b}`);
    console.log(`Actual:   R=${actualColor.r}, G=${actualColor.g}, B=${actualColor.b}`);

    const match = colorsMatch(actualColor, SECRET_COLORS.RED, COLOR_TOLERANCE);
    expect(match).toBe(true);
    
    if (match) {
      console.log('SECRET COLOR VERIFIED: Decoding is working correctly!');
    }
  });

  it('should decode VP8 secret1 frame and verify color 0xDEADBE', () => {
    if (!native) {
      expect.fail('Native addon not available');
    }

    const ivfPath = join(fixturesDir, 'vp8-secret1-64x64.ivf');
    if (!existsSync(ivfPath)) {
      expect.fail('Test fixtures not found - run npm run generate:fixtures');
    }

    const frameData = extractVP8Frame(ivfPath);
    const result = native.decodeVP8Frame(frameData);

    const actualColor = {
      r: result.firstPixelR,
      g: result.firstPixelG,
      b: result.firstPixelB,
    };

    console.log(`Expected: R=${SECRET_COLORS.SECRET_1.r} (0xDE), G=${SECRET_COLORS.SECRET_1.g} (0xAD), B=${SECRET_COLORS.SECRET_1.b} (0xBE)`);
    console.log(`Actual:   R=${actualColor.r}, G=${actualColor.g}, B=${actualColor.b}`);

    const match = colorsMatch(actualColor, SECRET_COLORS.SECRET_1, COLOR_TOLERANCE);
    expect(match).toBe(true);

    if (match) {
      console.log('SECRET 0xDEADBE VERIFIED: Decoder passed the scientific test!');
    }
  });

  it('should decode VP8 secret2 frame (128x128) and verify color 0xCAFE42', () => {
    if (!native) {
      expect.fail('Native addon not available');
    }

    const ivfPath = join(fixturesDir, 'vp8-secret2-128x128.ivf');
    if (!existsSync(ivfPath)) {
      expect.fail('Test fixtures not found - run npm run generate:fixtures');
    }

    const frameData = extractVP8Frame(ivfPath);
    const result = native.decodeVP8Frame(frameData);

    expect(result.width).toBe(128);
    expect(result.height).toBe(128);

    const actualColor = {
      r: result.firstPixelR,
      g: result.firstPixelG,
      b: result.firstPixelB,
    };

    console.log(`Expected: R=${SECRET_COLORS.SECRET_2.r} (0xCA), G=${SECRET_COLORS.SECRET_2.g} (0xFE), B=${SECRET_COLORS.SECRET_2.b} (0x42)`);
    console.log(`Actual:   R=${actualColor.r}, G=${actualColor.g}, B=${actualColor.b}`);

    const match = colorsMatch(actualColor, SECRET_COLORS.SECRET_2, COLOR_TOLERANCE);
    expect(match).toBe(true);

    if (match) {
      console.log('SECRET 0xCAFE42 VERIFIED: Decoder works at different resolutions!');
    }
  });
});

describe('Negative Tests - Verify We Detect Failures', () => {
  it('should fail if we check for wrong color (sanity check)', () => {
    const native = tryLoadNative();
    if (!native) {
      expect.fail('Native addon not available');
    }

    const fixturesDir = join(__dirname, '..', 'fixtures', 'vp8');
    const ivfPath = join(fixturesDir, 'vp8-red-64x64.ivf');
    
    if (!existsSync(ivfPath)) {
      expect.fail('Test fixtures not found');
    }

    const frameData = extractVP8Frame(ivfPath);
    const result = native.decodeVP8Frame(frameData);

    // Red frame should NOT match green
    const actualColor = {
      r: result.firstPixelR,
      g: result.firstPixelG,
      b: result.firstPixelB,
    };

    const wrongColor = { r: 0, g: 255, b: 0 }; // Green
    const shouldNotMatch = colorsMatch(actualColor, wrongColor, COLOR_TOLERANCE);
    
    expect(shouldNotMatch).toBe(false);
    console.log('Sanity check passed: Red frame does not match green expectation');
  });
});
