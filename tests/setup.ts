/**
 * Vitest setup file for Node.js environment
 * 
 * This file is loaded before tests run to set up the WebCodecs polyfill
 * in the Node.js environment using libavjs-webcodecs-polyfill.
 */

import * as LibAVWebCodecs from '../libs/libavjs-webcodecs-polyfill/dist/libavjs-webcodecs-polyfill.mjs';
import LibAV from '@libav.js/variant-webm-vp9';

/**
 * Delay in milliseconds to wait for polyfill internal async cleanup.
 * The libavjs-webcodecs-polyfill has internal async handlers that may 
 * throw errors if we close encoders/decoders too quickly.
 */
export const POLYFILL_CLEANUP_DELAY_MS = 50;

// Handle known polyfill bugs that cause unhandled rejections during cleanup
// The libavjs-webcodecs-polyfill can throw "Decoder closed" or "Encoder closed"
// errors during internal async cleanup which are not actionable.
process.on('unhandledRejection', (reason: unknown) => {
  const message = (reason as { message?: string })?.message;
  if (message && (message.includes('Decoder closed') || message.includes('Encoder closed'))) {
    // Suppress known polyfill cleanup errors
    return;
  }
  // Re-throw unknown errors
  throw reason;
});

// Polyfill DOMRect for Node.js (required by VideoFrame in libavjs-webcodecs-polyfill)
if (typeof globalThis.DOMRect === 'undefined') {
  class DOMRect {
    x: number;
    y: number;
    width: number;
    height: number;
    top: number;
    right: number;
    bottom: number;
    left: number;

    constructor(x = 0, y = 0, width = 0, height = 0) {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      this.top = y;
      this.right = x + width;
      this.bottom = y + height;
      this.left = x;
    }

    toJSON() {
      return {
        x: this.x,
        y: this.y,
        width: this.width,
        height: this.height,
        top: this.top,
        right: this.right,
        bottom: this.bottom,
        left: this.left
      };
    }

    static fromRect(other?: { x?: number; y?: number; width?: number; height?: number }) {
      return new DOMRect(other?.x, other?.y, other?.width, other?.height);
    }
  }
  (globalThis as unknown as Record<string, unknown>).DOMRect = DOMRect;
}

// Load the polyfill before tests run
await LibAVWebCodecs.load({
  polyfill: true,
  LibAV: LibAV as unknown as import('@libav.js/types').LibAVWrapper,
  libavOptions: {
    noworker: true  // Run synchronously in Node.js
  }
});

// Polyfill ImageDecoder for Node.js (not included in libavjs-webcodecs-polyfill)
if (typeof globalThis.ImageDecoder === 'undefined') {
  class ImageDecoder {
    static async isTypeSupported(type: string): Promise<boolean> {
      // Support common image types
      const supportedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
      return supportedTypes.includes(type.toLowerCase());
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).ImageDecoder = ImageDecoder;
}
