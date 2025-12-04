/**
 * Test setup using node-webcodecs package
 */
import {
  VideoFrame,
  AudioData,
  EncodedVideoChunk,
  EncodedAudioChunk,
  VideoColorSpace,
  ImageDecoder,
  VideoEncoder,
  VideoDecoder,
  AudioEncoder,
  AudioDecoder,
} from 'node-webcodecs';

// Make WebCodecs globally available
Object.assign(globalThis, {
  VideoFrame,
  AudioData,
  EncodedVideoChunk,
  EncodedAudioChunk,
  VideoColorSpace,
  ImageDecoder,
  VideoEncoder,
  VideoDecoder,
  AudioEncoder,
  AudioDecoder,
});

// Polyfill DOMRect for Node.js
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
