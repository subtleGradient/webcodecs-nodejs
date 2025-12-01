/**
 * WebCodecs API implementation for Node.js
 * 
 * This module provides the WebCodecs API in Node.js environments.
 * 
 * @module webcodecs-nodejs
 */

// Export placeholder types for now
// The actual implementation will be added later

export const VERSION = '0.0.1';

// Placeholder exports - these will be replaced with actual implementations
export class VideoEncoder {
  static isConfigSupported(_config: unknown): Promise<{ supported: boolean; config?: unknown }> {
    throw new Error('WebCodecs not implemented for Node.js yet');
  }
}

export class VideoDecoder {
  static isConfigSupported(_config: unknown): Promise<{ supported: boolean; config?: unknown }> {
    throw new Error('WebCodecs not implemented for Node.js yet');
  }
}

export class AudioEncoder {
  static isConfigSupported(_config: unknown): Promise<{ supported: boolean; config?: unknown }> {
    throw new Error('WebCodecs not implemented for Node.js yet');
  }
}

export class AudioDecoder {
  static isConfigSupported(_config: unknown): Promise<{ supported: boolean; config?: unknown }> {
    throw new Error('WebCodecs not implemented for Node.js yet');
  }
}

export class VideoFrame {
  constructor() {
    throw new Error('WebCodecs not implemented for Node.js yet');
  }
}

export class AudioData {
  constructor() {
    throw new Error('WebCodecs not implemented for Node.js yet');
  }
}

export class EncodedVideoChunk {
  constructor() {
    throw new Error('WebCodecs not implemented for Node.js yet');
  }
}

export class EncodedAudioChunk {
  constructor() {
    throw new Error('WebCodecs not implemented for Node.js yet');
  }
}

export class ImageDecoder {
  static isTypeSupported(_type: string): Promise<boolean> {
    throw new Error('WebCodecs not implemented for Node.js yet');
  }
}
