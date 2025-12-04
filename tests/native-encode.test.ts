/**
 * Native Encode Integration Tests
 * 
 * These tests verify that our native N-API addon can encode video.
 * We use the round-trip approach:
 * 1. Create a frame with a known "secret color"
 * 2. Encode it to VP8
 * 3. Decode it back
 * 4. Verify the secret color matches
 * 
 * If the color survives the round-trip, we know both encode and decode work.
 */

import { describe, it, expect, beforeAll } from 'vitest';

// Secret colors for verification
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

// Helper to create a solid color RGB24 buffer
function createSolidColorFrame(
  width: number,
  height: number,
  color: { r: number; g: number; b: number }
): Buffer {
  const buffer = Buffer.alloc(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    buffer[i * 3] = color.r;
    buffer[i * 3 + 1] = color.g;
    buffer[i * 3 + 2] = color.b;
  }
  return buffer;
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

describe('VP8 Encoding', () => {
  let native: ReturnType<typeof tryLoadNative>;

  beforeAll(() => {
    native = tryLoadNative();
  });

  it('should have encodeVP8Frame function', () => {
    if (!native) {
      expect.fail('Native addon not available - run npm run build:native');
    }
    
    expect(typeof native.encodeVP8Frame).toBe('function');
  });

  it('should encode a solid red frame to VP8', () => {
    if (!native) {
      expect.fail('Native addon not available');
    }

    // Create a 64x64 red frame
    const rgbData = createSolidColorFrame(64, 64, SECRET_COLORS.RED);
    
    // Encode to VP8
    const result = native.encodeVP8Frame(rgbData, {
      width: 64,
      height: 64,
      bitrate: 500000,
    });

    expect(result).toBeDefined();
    expect(result.data).toBeInstanceOf(Buffer);
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.isKeyframe).toBe(true);
    
    console.log(`Encoded VP8 frame size: ${result.data.length} bytes`);
  });

  it('should encode with secret color 0xDEADBE', () => {
    if (!native) {
      expect.fail('Native addon not available');
    }

    const rgbData = createSolidColorFrame(64, 64, SECRET_COLORS.SECRET_1);
    
    const result = native.encodeVP8Frame(rgbData, {
      width: 64,
      height: 64,
      bitrate: 500000,
    });

    expect(result.data.length).toBeGreaterThan(0);
    console.log(`Encoded 0xDEADBE frame: ${result.data.length} bytes`);
  });
});

describe('VP8 Encode → Decode Round-Trip', () => {
  let native: ReturnType<typeof tryLoadNative>;

  beforeAll(() => {
    native = tryLoadNative();
  });

  it('should round-trip a red frame and verify color', () => {
    if (!native) {
      expect.fail('Native addon not available');
    }

    // 1. Create red frame
    const originalColor = SECRET_COLORS.RED;
    const rgbData = createSolidColorFrame(64, 64, originalColor);
    
    // 2. Encode to VP8
    const encoded = native.encodeVP8Frame(rgbData, {
      width: 64,
      height: 64,
      bitrate: 500000,
    });
    
    expect(encoded.data.length).toBeGreaterThan(0);
    console.log(`Encoded frame: ${encoded.data.length} bytes`);

    // 3. Decode back
    const decoded = native.decodeVP8Frame(encoded.data);
    
    expect(decoded.width).toBe(64);
    expect(decoded.height).toBe(64);

    // 4. Verify color matches
    const actualColor = {
      r: decoded.firstPixelR,
      g: decoded.firstPixelG,
      b: decoded.firstPixelB,
    };

    console.log(`Original: R=${originalColor.r}, G=${originalColor.g}, B=${originalColor.b}`);
    console.log(`Decoded:  R=${actualColor.r}, G=${actualColor.g}, B=${actualColor.b}`);

    const match = colorsMatch(actualColor, originalColor, COLOR_TOLERANCE);
    expect(match).toBe(true);

    if (match) {
      console.log('ROUND-TRIP VERIFIED: Encode → Decode preserves color!');
    }
  });

  it('should round-trip secret color 0xDEADBE', () => {
    if (!native) {
      expect.fail('Native addon not available');
    }

    const originalColor = SECRET_COLORS.SECRET_1;
    const rgbData = createSolidColorFrame(64, 64, originalColor);
    
    const encoded = native.encodeVP8Frame(rgbData, {
      width: 64,
      height: 64,
      bitrate: 1000000, // Higher bitrate for better quality
    });
    
    const decoded = native.decodeVP8Frame(encoded.data);
    
    const actualColor = {
      r: decoded.firstPixelR,
      g: decoded.firstPixelG,
      b: decoded.firstPixelB,
    };

    console.log(`Original: R=${originalColor.r} (0xDE), G=${originalColor.g} (0xAD), B=${originalColor.b} (0xBE)`);
    console.log(`Decoded:  R=${actualColor.r}, G=${actualColor.g}, B=${actualColor.b}`);

    const match = colorsMatch(actualColor, originalColor, COLOR_TOLERANCE);
    expect(match).toBe(true);

    if (match) {
      console.log('SECRET 0xDEADBE ROUND-TRIP VERIFIED!');
    }
  });

  it('should round-trip at different resolutions (128x128)', () => {
    if (!native) {
      expect.fail('Native addon not available');
    }

    const originalColor = SECRET_COLORS.SECRET_2;
    const rgbData = createSolidColorFrame(128, 128, originalColor);
    
    const encoded = native.encodeVP8Frame(rgbData, {
      width: 128,
      height: 128,
      bitrate: 1000000,
    });
    
    const decoded = native.decodeVP8Frame(encoded.data);
    
    expect(decoded.width).toBe(128);
    expect(decoded.height).toBe(128);

    const actualColor = {
      r: decoded.firstPixelR,
      g: decoded.firstPixelG,
      b: decoded.firstPixelB,
    };

    console.log(`Original: R=${originalColor.r} (0xCA), G=${originalColor.g} (0xFE), B=${originalColor.b} (0x42)`);
    console.log(`Decoded:  R=${actualColor.r}, G=${actualColor.g}, B=${actualColor.b}`);

    const match = colorsMatch(actualColor, originalColor, COLOR_TOLERANCE);
    expect(match).toBe(true);

    if (match) {
      console.log('128x128 ROUND-TRIP WITH 0xCAFE42 VERIFIED!');
    }
  });
});
