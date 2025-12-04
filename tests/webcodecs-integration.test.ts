/**
 * WebCodecs Integration Tests
 * 
 * These tests verify the WebCodecs API works end-to-end with our native bindings.
 * Tests are implementation-agnostic and should pass in any spec-compliant environment.
 * 
 * We use QR codes for verification because they survive lossy compression
 * thanks to error correction (up to 30% with level H).
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { 
  VideoEncoder, 
  VideoDecoder, 
  VideoFrame, 
  EncodedVideoChunk,
  installPolyfill 
} from '../src/index';
import QRCode from 'qrcode';
// @ts-expect-error - jsQR doesn't have type definitions
import jsQR from 'jsqr';

// Ensure polyfill is installed
beforeAll(() => {
  installPolyfill();
});

// Helper to generate a QR code as I420 frame data
async function createQRCodeFrame(
  width: number, 
  height: number, 
  secret: string
): Promise<{ data: Uint8Array; secret: string }> {
  // Get QR code matrix
  const qr = QRCode.create(secret, { errorCorrectionLevel: 'H' });
  const modules = qr.modules;
  const moduleCount = modules.size;
  const scale = Math.floor(width / (moduleCount + 4)); // +4 for margin
  const margin = Math.floor((width - moduleCount * scale) / 2);
  
  // Create I420 frame (Y=white/black, U=V=128 for grayscale)
  const ySize = width * height;
  const uvSize = (width / 2) * (height / 2);
  const data = new Uint8Array(ySize + uvSize * 2);
  
  // Fill with white (Y=235 for video white)
  data.fill(235, 0, ySize);
  data.fill(128, ySize, ySize + uvSize * 2); // U and V = 128 for no color
  
  // Draw QR modules (black = Y=16 for video black)
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (modules.get(row, col)) {
        // This module is dark
        const startX = margin + col * scale;
        const startY = margin + row * scale;
        
        for (let dy = 0; dy < scale && startY + dy < height; dy++) {
          for (let dx = 0; dx < scale && startX + dx < width; dx++) {
            const yIndex = (startY + dy) * width + (startX + dx);
            data[yIndex] = 16; // Video black
          }
        }
      }
    }
  }
  
  return { data, secret };
}

// Helper to decode QR code from I420 frame
function decodeQRFromI420(data: Uint8Array, width: number, height: number): string | null {
  // Convert I420 Y plane to grayscale RGBA for jsQR
  const rgba = new Uint8ClampedArray(width * height * 4);
  
  for (let i = 0; i < width * height; i++) {
    const y = data[i];
    // Convert Y to RGB (grayscale) - BT.601 limited range to full range
    const gray = Math.max(0, Math.min(255, Math.round((y - 16) * 255 / 219)));
    rgba[i * 4] = gray;     // R
    rgba[i * 4 + 1] = gray; // G
    rgba[i * 4 + 2] = gray; // B
    rgba[i * 4 + 3] = 255;  // A
  }
  
  const result = jsQR(rgba, width, height);
  return result?.data ?? null;
}

// Helper to create solid color I420 frame (for basic dimension tests)
function createSolidI420Frame(width: number, height: number, y: number = 128): Uint8Array {
  const ySize = width * height;
  const uvSize = (width / 2) * (height / 2);
  const data = new Uint8Array(ySize + uvSize * 2);
  
  data.fill(y, 0, ySize);
  data.fill(128, ySize, ySize + uvSize * 2);
  
  return data;
}

describe('VideoFrame', () => {
  it('should create VideoFrame from I420 data with correct dimensions', () => {
    const width = 128;
    const height = 128;
    const data = createSolidI420Frame(width, height);
    
    const frame = new VideoFrame(data.buffer as ArrayBuffer, {
      format: 'I420',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
    });
    
    expect(frame.codedWidth).toBe(width);
    expect(frame.codedHeight).toBe(height);
    expect(frame.format).toBe('I420');
    expect(frame.timestamp).toBe(0);
    
    frame.close();
  });

  it('should support allocationSize for I420 format', () => {
    const width = 128;
    const height = 128;
    const data = createSolidI420Frame(width, height);
    
    const frame = new VideoFrame(data.buffer as ArrayBuffer, {
      format: 'I420',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
    });
    
    // I420 size = width * height * 1.5
    const expectedSize = width * height + (width / 2) * (height / 2) * 2;
    expect(frame.allocationSize({ format: 'I420' })).toBe(expectedSize);
    
    frame.close();
  });

  it('should copyTo buffer with I420 data', () => {
    const width = 128;
    const height = 128;
    const yValue = 200;
    const originalData = createSolidI420Frame(width, height, yValue);
    
    const frame = new VideoFrame(originalData.buffer as ArrayBuffer, {
      format: 'I420',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
    });
    
    const buffer = new Uint8Array(frame.allocationSize({ format: 'I420' }));
    frame.copyTo(buffer, { format: 'I420' });
    
    // Verify Y value matches
    expect(buffer[0]).toBe(yValue);
    
    frame.close();
  });
});

describe('VideoEncoder with Native Bindings', () => {
  let encoder: VideoEncoder | null = null;

  afterEach(() => {
    if (encoder && encoder.state !== 'closed') {
      encoder.close();
    }
    encoder = null;
  });

  it('should encode a VideoFrame and produce EncodedVideoChunk', async () => {
    const chunks: EncodedVideoChunk[] = [];
    let decoderConfig: unknown = null;

    encoder = new VideoEncoder({
      output: (chunk, metadata) => {
        chunks.push(chunk as EncodedVideoChunk);
        if (metadata && (metadata as { decoderConfig?: unknown }).decoderConfig) {
          decoderConfig = (metadata as { decoderConfig: unknown }).decoderConfig;
        }
      },
      error: (e) => { throw e; },
    });

    encoder.configure({
      codec: 'vp8',
      width: 128,
      height: 128,
      bitrate: 1000000,
    });

    const frameData = createSolidI420Frame(128, 128);
    const frame = new VideoFrame(frameData.buffer as ArrayBuffer, {
      format: 'I420',
      codedWidth: 128,
      codedHeight: 128,
      timestamp: 0,
    });

    encoder.encode(frame, { keyFrame: true });
    frame.close();

    await encoder.flush();
    encoder.close();

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].type).toBe('key');
    expect(chunks[0].byteLength).toBeGreaterThan(0);
    expect(decoderConfig).not.toBeNull();
  });
});

describe('VideoDecoder with Native Bindings', () => {
  let decoder: VideoDecoder | null = null;

  afterEach(() => {
    if (decoder && decoder.state !== 'closed') {
      decoder.close();
    }
    decoder = null;
  });

  it('should decode EncodedVideoChunk and produce VideoFrame', async () => {
    // First encode a frame
    const chunks: EncodedVideoChunk[] = [];
    let decoderConfig: unknown = null;

    const encoder = new VideoEncoder({
      output: (chunk, metadata) => {
        chunks.push(chunk as EncodedVideoChunk);
        if (metadata && (metadata as { decoderConfig?: unknown }).decoderConfig) {
          decoderConfig = (metadata as { decoderConfig: unknown }).decoderConfig;
        }
      },
      error: (e) => { throw e; },
    });

    encoder.configure({
      codec: 'vp8',
      width: 128,
      height: 128,
      bitrate: 1000000,
    });

    const frameData = createSolidI420Frame(128, 128);
    const frame = new VideoFrame(frameData.buffer as ArrayBuffer, {
      format: 'I420',
      codedWidth: 128,
      codedHeight: 128,
      timestamp: 0,
    });

    encoder.encode(frame, { keyFrame: true });
    frame.close();
    await encoder.flush();
    encoder.close();

    expect(chunks.length).toBeGreaterThan(0);

    // Now decode
    const decodedFrames: VideoFrame[] = [];

    decoder = new VideoDecoder({
      output: (f) => {
        decodedFrames.push(f as VideoFrame);
      },
      error: (e) => { throw e; },
    });

    decoder.configure(decoderConfig as { codec: string });
    decoder.decode(chunks[0]);
    await decoder.flush();
    decoder.close();

    expect(decodedFrames.length).toBeGreaterThan(0);
    expect(decodedFrames[0].codedWidth).toBe(128);
    expect(decodedFrames[0].codedHeight).toBe(128);
  });
});

describe('End-to-End Round-Trip with QR Code Verification', () => {
  it('should encode and decode with QR code verification', async () => {
    const secret = `WEBCODECS-TEST-${Date.now()}`;
    const width = 128;
    const height = 128;
    
    // Create QR code frame
    const { data: qrFrameData } = await createQRCodeFrame(width, height, secret);
    
    // Verify we can decode the QR before encoding
    const preEncodeQR = decodeQRFromI420(qrFrameData, width, height);
    expect(preEncodeQR).toBe(secret);
    console.log(`Pre-encode QR verified: "${preEncodeQR}"`);
    
    // Encode
    const chunks: EncodedVideoChunk[] = [];
    let decoderConfig: unknown = null;
    
    const encoder = new VideoEncoder({
      output: (chunk, metadata) => {
        chunks.push(chunk as EncodedVideoChunk);
        if (metadata && (metadata as { decoderConfig?: unknown }).decoderConfig) {
          decoderConfig = (metadata as { decoderConfig: unknown }).decoderConfig;
        }
      },
      error: (e) => { throw e; },
    });

    encoder.configure({
      codec: 'vp8',
      width,
      height,
      bitrate: 2000000, // Higher bitrate for QR clarity
    });

    const frame = new VideoFrame(qrFrameData.buffer as ArrayBuffer, {
      format: 'I420',
      codedWidth: width,
      codedHeight: height,
      timestamp: 0,
    });

    encoder.encode(frame, { keyFrame: true });
    frame.close();
    await encoder.flush();
    encoder.close();

    expect(chunks.length).toBeGreaterThan(0);
    console.log(`Encoded to ${chunks[0].byteLength} bytes`);

    // Decode
    const decodedFrames: VideoFrame[] = [];
    const decoder = new VideoDecoder({
      output: (f) => {
        decodedFrames.push(f as VideoFrame);
      },
      error: (e) => { throw e; },
    });

    decoder.configure(decoderConfig as { codec: string });
    decoder.decode(chunks[0]);
    await decoder.flush();
    decoder.close();

    expect(decodedFrames.length).toBe(1);
    const decodedFrame = decodedFrames[0];
    
    expect(decodedFrame.codedWidth).toBe(width);
    expect(decodedFrame.codedHeight).toBe(height);

    // Extract I420 data from decoded frame
    const decodedI420 = new Uint8Array(decodedFrame.allocationSize({ format: 'I420' }));
    decodedFrame.copyTo(decodedI420, { format: 'I420' });
    
    // Decode QR from the round-tripped frame
    const decodedQR = decodeQRFromI420(decodedI420, width, height);
    
    console.log(`Original secret: "${secret}"`);
    console.log(`Decoded QR: "${decodedQR}"`);
    
    // THE KEY VERIFICATION: QR code survives the encode→decode round-trip
    expect(decodedQR).toBe(secret);
    
    if (decodedQR === secret) {
      console.log('QR CODE ROUND-TRIP VERIFIED! Encode→Decode works correctly.');
    }

    decodedFrame.close();
  });
});
