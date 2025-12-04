#!/usr/bin/env npx tsx
/**
 * Test Fixture Generator
 * 
 * Generates encoded video data with "secret colors" for verification.
 * The secret color can only be recovered by actually decoding the video,
 * proving that real codec work happened.
 * 
 * Scientific Verification Principle:
 * - Encode a frame with a known RGB color
 * - Decode it and verify the color matches (within tolerance)
 * - If wrong color → codec is broken, no false positives
 */

import { spawnSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Secret colors for verification - these are chosen to be distinctive
// and survive lossy compression reasonably well
export const SECRET_COLORS = {
  // Primary test colors (saturated, survive compression well)
  RED: { r: 255, g: 0, b: 0, hex: 'FF0000' },
  GREEN: { r: 0, g: 255, b: 0, hex: '00FF00' },
  BLUE: { r: 0, g: 0, b: 255, hex: '0000FF' },
  
  // Secret verification colors (unique values for testing)
  SECRET_1: { r: 0xDE, g: 0xAD, b: 0xBE, hex: 'DEADBE' },
  SECRET_2: { r: 0xCA, g: 0xFE, b: 0x42, hex: 'CAFE42' },
  SECRET_3: { r: 0x13, g: 0x37, b: 0xC0, hex: '1337C0' },
} as const;

// Tolerance for lossy compression (YUV conversion loses some precision)
export const COLOR_TOLERANCE = 8; // Allow ±8 per channel for lossy codecs

interface FixtureConfig {
  name: string;
  codec: 'vp8' | 'vp9' | 'h264';
  width: number;
  height: number;
  color: keyof typeof SECRET_COLORS;
  lossless?: boolean;
}

const FIXTURES: FixtureConfig[] = [
  // VP8 fixtures (primary - these are required)
  { name: 'vp8-red-64x64', codec: 'vp8', width: 64, height: 64, color: 'RED' },
  { name: 'vp8-secret1-64x64', codec: 'vp8', width: 64, height: 64, color: 'SECRET_1' },
  { name: 'vp8-secret2-128x128', codec: 'vp8', width: 128, height: 128, color: 'SECRET_2' },
  
  // VP9 fixtures
  { name: 'vp9-red-64x64', codec: 'vp9', width: 64, height: 64, color: 'RED' },
  { name: 'vp9-secret1-64x64', codec: 'vp9', width: 64, height: 64, color: 'SECRET_1' },
  
  // Note: VP9 "lossless" still has YUV→RGB conversion loss, so we skip it
  // { name: 'vp9-secret1-64x64-lossless', codec: 'vp9', width: 64, height: 64, color: 'SECRET_1', lossless: true },
];

function getFFmpegEncoder(codec: string): string {
  switch (codec) {
    case 'vp8': return 'libvpx';
    case 'vp9': return 'libvpx-vp9';
    case 'h264': return 'libx264';
    default: throw new Error(`Unknown codec: ${codec}`);
  }
}

function getOutputFormat(codec: string): string {
  switch (codec) {
    case 'vp8':
    case 'vp9': return 'ivf';
    case 'h264': return 'h264';
    default: throw new Error(`Unknown codec: ${codec}`);
  }
}

function generateFixture(config: FixtureConfig): { path: string; rawFramePath: string } {
  const color = SECRET_COLORS[config.color];
  const encoder = getFFmpegEncoder(config.codec);
  const format = getOutputFormat(config.codec);
  
  const outputDir = join(__dirname, config.codec);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  
  const outputPath = join(outputDir, `${config.name}.${format}`);
  const rawFramePath = join(outputDir, `${config.name}.rgb24`);
  
  // Build FFmpeg command
  const args = [
    '-y', // Overwrite
    '-f', 'lavfi',
    '-i', `color=c=0x${color.hex}:s=${config.width}x${config.height}:d=0.04:r=25`,
    '-frames:v', '1',
    '-c:v', encoder,
  ];
  
  // Codec-specific options
  if (config.codec === 'vp8' || config.codec === 'vp9') {
    if (config.lossless && config.codec === 'vp9') {
      args.push('-lossless', '1');
    } else {
      args.push('-b:v', '1M', '-quality', 'realtime', '-cpu-used', '0');
    }
  } else if (config.codec === 'h264') {
    args.push(
      '-profile:v', 'baseline',
      '-level', '3.0',
      '-preset', 'ultrafast',
      '-qp', '0', // Lossless-ish for h264
    );
  }
  
  args.push('-f', format, outputPath);
  
  console.log(`Generating ${config.name}...`);
  console.log(`  Color: #${color.hex} (R=${color.r}, G=${color.g}, B=${color.b})`);
  
  const result = spawnSync('ffmpeg', args, { encoding: 'utf-8' });
  if (result.status !== 0) {
    console.error(`FFmpeg error: ${result.stderr}`);
    throw new Error(`Failed to generate ${config.name}`);
  }
  
  // Also generate the expected raw RGB24 frame for verification
  const verifyArgs = [
    '-y',
    '-i', outputPath,
    '-f', 'rawvideo',
    '-pix_fmt', 'rgb24',
    rawFramePath,
  ];
  
  const verifyResult = spawnSync('ffmpeg', verifyArgs, { encoding: 'utf-8' });
  if (verifyResult.status !== 0) {
    console.error(`FFmpeg verify error: ${verifyResult.stderr}`);
    throw new Error(`Failed to verify ${config.name}`);
  }
  
  // Verify the color
  const rawData = readFileSync(rawFramePath);
  const actualR = rawData[0];
  const actualG = rawData[1];
  const actualB = rawData[2];
  
  const tolerance = config.lossless ? 0 : COLOR_TOLERANCE;
  const rDiff = Math.abs(actualR - color.r);
  const gDiff = Math.abs(actualG - color.g);
  const bDiff = Math.abs(actualB - color.b);
  
  const pass = rDiff <= tolerance && gDiff <= tolerance && bDiff <= tolerance;
  
  console.log(`  Decoded: R=${actualR}, G=${actualG}, B=${actualB}`);
  console.log(`  Diff: R±${rDiff}, G±${gDiff}, B±${bDiff} (tolerance: ±${tolerance})`);
  console.log(`  Status: ${pass ? 'PASS' : 'FAIL'}`);
  
  if (!pass) {
    throw new Error(`Color verification failed for ${config.name}`);
  }
  
  return { path: outputPath, rawFramePath };
}

/**
 * Extract raw frame data from IVF container.
 * IVF header is 32 bytes, then each frame has 12-byte header.
 */
export function extractRawFrame(ivfPath: string): Uint8Array {
  const data = readFileSync(ivfPath);
  
  // Frame header: 4 bytes size (little-endian) + 8 bytes timestamp
  const frameSize = data.readUInt32LE(32);
  const frameData = data.subarray(44, 44 + frameSize);
  
  return new Uint8Array(frameData);
}

function generateManifest() {
  const manifest: Record<string, {
    codec: string;
    width: number;
    height: number;
    color: { r: number; g: number; b: number; hex: string };
    tolerance: number;
    file: string;
    rawFrameFile: string;
  }> = {};
  
  for (const config of FIXTURES) {
    const color = SECRET_COLORS[config.color];
    const format = getOutputFormat(config.codec);
    
    manifest[config.name] = {
      codec: config.codec,
      width: config.width,
      height: config.height,
      color: { ...color },
      tolerance: config.lossless ? 0 : COLOR_TOLERANCE,
      file: `${config.codec}/${config.name}.${format}`,
      rawFrameFile: `${config.codec}/${config.name}.rgb24`,
    };
  }
  
  const manifestPath = join(__dirname, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest written to ${manifestPath}`);
}

async function main() {
  console.log('=== WebCodecs Test Fixture Generator ===\n');
  console.log('Generating fixtures with secret colors for verification...\n');
  
  for (const config of FIXTURES) {
    try {
      generateFixture(config);
      console.log('');
    } catch (error) {
      console.error(`Error generating ${config.name}:`, error);
      process.exit(1);
    }
  }
  
  generateManifest();
  
  console.log('\n=== All fixtures generated successfully ===');
}

main().catch(console.error);
