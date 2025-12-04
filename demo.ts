#!/usr/bin/env npx tsx
/**
 * WebCodecs Node.js Demo
 * 
 * This demo shows the WebCodecs API working in Node.js:
 * 1. Creates a VideoFrame with a QR code containing a secret message
 * 2. Encodes it to VP8 using the native N-API + FFmpeg encoder
 * 3. Decodes it back using the native decoder
 * 4. Reads the QR code from the decoded frame to verify the round-trip
 * 
 * Run with: npx tsx demo.ts
 */

import QRCode from 'qrcode';
import jsQR from 'jsqr';

// Import and install the polyfill
import './src/index.js';

async function generateQRCodeRGBA(text: string, size: number): Promise<Uint8ClampedArray> {
  // Use QRCode.create to get the matrix data (works in Node.js without canvas)
  const qr = await QRCode.create(text, { errorCorrectionLevel: 'H' });
  const modules = qr.modules;
  const moduleCount = modules.size;
  
  // Add margin and calculate scale
  const margin = 4;
  const availableSize = size - (margin * 2);
  const scale = Math.floor(availableSize / moduleCount);
  const offsetX = Math.floor((size - moduleCount * scale) / 2);
  const offsetY = Math.floor((size - moduleCount * scale) / 2);
  
  const rgba = new Uint8ClampedArray(size * size * 4);
  
  // Fill with white background
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = 255;     // R
    rgba[i + 1] = 255; // G
    rgba[i + 2] = 255; // B
    rgba[i + 3] = 255; // A
  }
  
  // Draw QR modules
  for (let moduleY = 0; moduleY < moduleCount; moduleY++) {
    for (let moduleX = 0; moduleX < moduleCount; moduleX++) {
      const isDark = modules.get(moduleY, moduleX);
      if (isDark) {
        // Fill the scaled module area
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const x = offsetX + moduleX * scale + dx;
            const y = offsetY + moduleY * scale + dy;
            if (x < size && y < size) {
              const idx = (y * size + x) * 4;
              rgba[idx] = 0;     // R
              rgba[idx + 1] = 0; // G
              rgba[idx + 2] = 0; // B
              // A stays 255
            }
          }
        }
      }
    }
  }
  
  return rgba;
}

function rgbaToI420(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const ySize = width * height;
  const uvSize = (width / 2) * (height / 2);
  const i420 = new Uint8Array(ySize + uvSize * 2);
  
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const rgbaIdx = (j * width + i) * 4;
      const r = rgba[rgbaIdx];
      const g = rgba[rgbaIdx + 1];
      const b = rgba[rgbaIdx + 2];
      
      // RGB to Y
      const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      i420[j * width + i] = Math.max(0, Math.min(255, y));
      
      // Subsample U/V (2x2)
      if (j % 2 === 0 && i % 2 === 0) {
        const u = Math.round(-0.169 * r - 0.331 * g + 0.5 * b + 128);
        const v = Math.round(0.5 * r - 0.419 * g - 0.081 * b + 128);
        const uvIdx = (j / 2) * (width / 2) + (i / 2);
        i420[ySize + uvIdx] = Math.max(0, Math.min(255, u));
        i420[ySize + uvSize + uvIdx] = Math.max(0, Math.min(255, v));
      }
    }
  }
  
  return i420;
}

function i420ToRGBA(i420: Uint8Array, width: number, height: number): Uint8ClampedArray {
  const ySize = width * height;
  const uvSize = (width / 2) * (height / 2);
  const rgba = new Uint8ClampedArray(width * height * 4);
  
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const yIdx = j * width + i;
      const uvIdx = Math.floor(j / 2) * (width / 2) + Math.floor(i / 2);
      
      const y = i420[yIdx];
      const u = i420[ySize + uvIdx];
      const v = i420[ySize + uvSize + uvIdx];
      
      // YUV to RGB
      const c = y - 16;
      const d = u - 128;
      const e = v - 128;
      
      const r = Math.max(0, Math.min(255, Math.round((298 * c + 409 * e + 128) >> 8)));
      const g = Math.max(0, Math.min(255, Math.round((298 * c - 100 * d - 208 * e + 128) >> 8)));
      const b = Math.max(0, Math.min(255, Math.round((298 * c + 516 * d + 128) >> 8)));
      
      const idx = (j * width + i) * 4;
      rgba[idx] = r;
      rgba[idx + 1] = g;
      rgba[idx + 2] = b;
      rgba[idx + 3] = 255;
    }
  }
  
  return rgba;
}

async function main() {
  console.log('='.repeat(60));
  console.log('  WebCodecs Node.js Demo');
  console.log('  N-API + FFmpeg Native Bindings');
  console.log('='.repeat(60));
  console.log();

  // Generate a secret message with timestamp
  const secret = `DEMO-${Date.now()}`;
  const size = 256;
  
  console.log(`1. Generating QR code with secret: "${secret}"`);
  const rgbaData = await generateQRCodeRGBA(secret, size);
  
  // Verify QR is readable before encoding
  const preCheck = jsQR(rgbaData, size, size);
  if (!preCheck) {
    console.error('   ERROR: QR code not readable before encoding!');
    process.exit(1);
  }
  console.log(`   Pre-encode verification: "${preCheck.data}"`);
  
  // Convert to I420 for VideoFrame
  const i420Data = rgbaToI420(rgbaData, size, size);
  
  console.log();
  console.log('2. Creating VideoFrame (I420 format)');
  const frame = new VideoFrame(i420Data.buffer, {
    format: 'I420',
    codedWidth: size,
    codedHeight: size,
    timestamp: 0,
  });
  console.log(`   Frame: ${frame.codedWidth}x${frame.codedHeight}, format=${frame.format}`);
  
  console.log();
  console.log('3. Encoding with VideoEncoder (VP8)');
  
  const encodedChunks: EncodedVideoChunk[] = [];
  let decoderConfig: { codec: string; codedWidth: number; codedHeight: number } | null = null;
  
  const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      encodedChunks.push(chunk as EncodedVideoChunk);
      if (metadata && (metadata as { decoderConfig?: typeof decoderConfig }).decoderConfig) {
        decoderConfig = (metadata as { decoderConfig: typeof decoderConfig }).decoderConfig;
      }
    },
    error: (e) => console.error('Encoder error:', e),
  });
  
  encoder.configure({
    codec: 'vp8',
    width: size,
    height: size,
    bitrate: 1_000_000, // 1 Mbps for quality
  });
  
  encoder.encode(frame, { keyFrame: true });
  await encoder.flush();
  encoder.close();
  frame.close();
  
  if (encodedChunks.length === 0) {
    console.error('   ERROR: No encoded chunks produced!');
    process.exit(1);
  }
  
  const chunk = encodedChunks[0];
  console.log(`   Encoded: ${chunk.byteLength} bytes, type=${chunk.type}`);
  
  console.log();
  console.log('4. Decoding with VideoDecoder (VP8)');
  
  const decodedFrames: VideoFrame[] = [];
  
  const decoder = new VideoDecoder({
    output: (frame) => decodedFrames.push(frame as VideoFrame),
    error: (e) => console.error('Decoder error:', e),
  });
  
  decoder.configure({ codec: (decoderConfig as { codec: string } | null)?.codec ?? 'vp8' });
  decoder.decode(chunk);
  await decoder.flush();
  decoder.close();
  
  if (decodedFrames.length === 0) {
    console.error('   ERROR: No decoded frames produced!');
    process.exit(1);
  }
  
  const decodedFrame = decodedFrames[0];
  console.log(`   Decoded: ${decodedFrame.codedWidth}x${decodedFrame.codedHeight}`);
  
  console.log();
  console.log('5. Extracting pixels and reading QR code');
  
  // Get decoded pixels
  const decodedI420 = new Uint8Array(decodedFrame.allocationSize({ format: 'I420' }));
  await decodedFrame.copyTo(decodedI420, { format: 'I420' });
  decodedFrame.close();
  
  // Convert back to RGBA for QR reading
  const decodedRGBA = i420ToRGBA(decodedI420, size, size);
  
  // Read QR code
  const qrResult = jsQR(decodedRGBA, size, size);
  
  console.log();
  console.log('='.repeat(60));
  if (qrResult && qrResult.data === secret) {
    console.log('  SUCCESS! Round-trip verified!');
    console.log(`  Original: "${secret}"`);
    console.log(`  Decoded:  "${qrResult.data}"`);
    console.log('='.repeat(60));
    console.log();
    console.log('The WebCodecs API is working correctly in Node.js!');
    console.log();
  } else {
    console.log('  FAILURE! QR code mismatch');
    console.log(`  Expected: "${secret}"`);
    console.log(`  Got:      "${qrResult?.data ?? 'null'}"`);
    console.log('='.repeat(60));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Demo failed:', e);
  process.exit(1);
});
