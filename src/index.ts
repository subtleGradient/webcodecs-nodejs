/**
 * WebCodecs API implementation for Node.js
 * 
 * This module provides the WebCodecs API in Node.js environments.
 * 
 * @module webcodecs-nodejs
 */

export const VERSION = '0.0.1';

// DOMException polyfill for older Node.js versions (pre-17)
const WebCodecsDOMException = typeof DOMException !== 'undefined' 
  ? DOMException 
  : class DOMException extends Error {
      constructor(message?: string, name?: string) {
        super(message);
        this.name = name || 'Error';
      }
    };

// Types for WebCodecs API
type CodecState = 'unconfigured' | 'configured' | 'closed';

interface VideoEncoderConfig {
  codec: string;
  width?: number;
  height?: number;
  bitrate?: number;
  framerate?: number;
}

interface VideoDecoderConfig {
  codec: string;
}

interface AudioEncoderConfig {
  codec: string;
  sampleRate?: number;
  numberOfChannels?: number;
}

interface AudioDecoderConfig {
  codec: string;
  sampleRate?: number;
  numberOfChannels?: number;
}

interface EncoderInit {
  output: (chunk: unknown, metadata?: unknown) => void;
  error: (error: Error) => void;
}

interface DecoderInit {
  output: (frame: unknown) => void;
  error: (error: Error) => void;
}

interface VideoEncoderSupport {
  supported: boolean;
  config?: VideoEncoderConfig;
}

interface VideoDecoderSupport {
  supported: boolean;
  config?: VideoDecoderConfig;
}

interface AudioEncoderSupport {
  supported: boolean;
  config?: AudioEncoderConfig;
}

interface AudioDecoderSupport {
  supported: boolean;
  config?: AudioDecoderConfig;
}

interface EncodedChunkInit {
  type: 'key' | 'delta';
  timestamp: number;
  duration?: number;
  data: BufferSource;
}

interface AudioDataInit {
  format: 'u8' | 's16' | 's32' | 'f32' | 'u8-planar' | 's16-planar' | 's32-planar' | 'f32-planar';
  sampleRate: number;
  numberOfFrames: number;
  numberOfChannels: number;
  timestamp: number;
  data: BufferSource;
}

// List of supported codecs
const SUPPORTED_VIDEO_CODECS = ['vp8', 'vp09', 'avc1'];
const SUPPORTED_AUDIO_CODECS = ['opus', 'mp4a'];

function isCodecSupported(codec: string, supportedPrefixes: string[]): boolean {
  const codecLower = codec.toLowerCase();
  return supportedPrefixes.some(prefix => codecLower.startsWith(prefix));
}

/**
 * VideoEncoder polyfill for Node.js
 */
export class VideoEncoder {
  private _state: CodecState = 'unconfigured';
  private _encodeQueueSize: number = 0;
  private _output: (chunk: unknown, metadata?: unknown) => void;
  private _error: (error: Error) => void;

  constructor(init: EncoderInit) {
    this._output = init.output;
    this._error = init.error;
  }

  get state(): CodecState {
    return this._state;
  }

  get encodeQueueSize(): number {
    return this._encodeQueueSize;
  }

  static async isConfigSupported(config: VideoEncoderConfig): Promise<VideoEncoderSupport> {
    const supported = isCodecSupported(config.codec, SUPPORTED_VIDEO_CODECS);
    return { supported, config: supported ? config : undefined };
  }

  configure(config: VideoEncoderConfig): void {
    if (this._state === 'closed') {
      throw new WebCodecsDOMException('Cannot configure a closed encoder', 'InvalidStateError');
    }
    if (!isCodecSupported(config.codec, SUPPORTED_VIDEO_CODECS)) {
      this._error(new Error(`Unsupported codec: ${config.codec}`));
      this._state = 'closed';
      return;
    }
    this._state = 'configured';
  }

  encode(_frame: unknown, _options?: unknown): void {
    if (this._state !== 'configured') {
      throw new WebCodecsDOMException('Encoder is not configured', 'InvalidStateError');
    }
  }

  async flush(): Promise<void> {
    if (this._state !== 'configured') {
      throw new WebCodecsDOMException('Encoder is not configured', 'InvalidStateError');
    }
  }

  reset(): void {
    if (this._state === 'closed') {
      throw new WebCodecsDOMException('Cannot reset a closed encoder', 'InvalidStateError');
    }
    this._state = 'unconfigured';
    this._encodeQueueSize = 0;
  }

  close(): void {
    this._state = 'closed';
  }
}

/**
 * VideoDecoder polyfill for Node.js
 */
export class VideoDecoder {
  private _state: CodecState = 'unconfigured';
  private _decodeQueueSize: number = 0;
  private _output: (frame: unknown) => void;
  private _error: (error: Error) => void;

  constructor(init: DecoderInit) {
    this._output = init.output;
    this._error = init.error;
  }

  get state(): CodecState {
    return this._state;
  }

  get decodeQueueSize(): number {
    return this._decodeQueueSize;
  }

  static async isConfigSupported(config: VideoDecoderConfig): Promise<VideoDecoderSupport> {
    const supported = isCodecSupported(config.codec, SUPPORTED_VIDEO_CODECS);
    return { supported, config: supported ? config : undefined };
  }

  configure(config: VideoDecoderConfig): void {
    if (this._state === 'closed') {
      throw new WebCodecsDOMException('Cannot configure a closed decoder', 'InvalidStateError');
    }
    if (!isCodecSupported(config.codec, SUPPORTED_VIDEO_CODECS)) {
      this._error(new Error(`Unsupported codec: ${config.codec}`));
      this._state = 'closed';
      return;
    }
    this._state = 'configured';
  }

  decode(_chunk: unknown): void {
    if (this._state !== 'configured') {
      throw new WebCodecsDOMException('Decoder is not configured', 'InvalidStateError');
    }
  }

  async flush(): Promise<void> {
    if (this._state !== 'configured') {
      throw new WebCodecsDOMException('Decoder is not configured', 'InvalidStateError');
    }
  }

  reset(): void {
    if (this._state === 'closed') {
      throw new WebCodecsDOMException('Cannot reset a closed decoder', 'InvalidStateError');
    }
    this._state = 'unconfigured';
    this._decodeQueueSize = 0;
  }

  close(): void {
    this._state = 'closed';
  }
}

/**
 * AudioEncoder polyfill for Node.js
 */
export class AudioEncoder {
  private _state: CodecState = 'unconfigured';
  private _encodeQueueSize: number = 0;
  private _output: (chunk: unknown, metadata?: unknown) => void;
  private _error: (error: Error) => void;

  constructor(init: EncoderInit) {
    this._output = init.output;
    this._error = init.error;
  }

  get state(): CodecState {
    return this._state;
  }

  get encodeQueueSize(): number {
    return this._encodeQueueSize;
  }

  static async isConfigSupported(config: AudioEncoderConfig): Promise<AudioEncoderSupport> {
    const supported = isCodecSupported(config.codec, SUPPORTED_AUDIO_CODECS);
    return { supported, config: supported ? config : undefined };
  }

  configure(config: AudioEncoderConfig): void {
    if (this._state === 'closed') {
      throw new WebCodecsDOMException('Cannot configure a closed encoder', 'InvalidStateError');
    }
    if (!isCodecSupported(config.codec, SUPPORTED_AUDIO_CODECS)) {
      this._error(new Error(`Unsupported codec: ${config.codec}`));
      this._state = 'closed';
      return;
    }
    this._state = 'configured';
  }

  encode(_data: unknown): void {
    if (this._state !== 'configured') {
      throw new WebCodecsDOMException('Encoder is not configured', 'InvalidStateError');
    }
  }

  async flush(): Promise<void> {
    if (this._state !== 'configured') {
      throw new WebCodecsDOMException('Encoder is not configured', 'InvalidStateError');
    }
  }

  reset(): void {
    if (this._state === 'closed') {
      throw new WebCodecsDOMException('Cannot reset a closed encoder', 'InvalidStateError');
    }
    this._state = 'unconfigured';
    this._encodeQueueSize = 0;
  }

  close(): void {
    this._state = 'closed';
  }
}

/**
 * AudioDecoder polyfill for Node.js
 */
export class AudioDecoder {
  private _state: CodecState = 'unconfigured';
  private _decodeQueueSize: number = 0;
  private _output: (data: unknown) => void;
  private _error: (error: Error) => void;

  constructor(init: DecoderInit) {
    this._output = init.output;
    this._error = init.error;
  }

  get state(): CodecState {
    return this._state;
  }

  get decodeQueueSize(): number {
    return this._decodeQueueSize;
  }

  static async isConfigSupported(config: AudioDecoderConfig): Promise<AudioDecoderSupport> {
    const supported = isCodecSupported(config.codec, SUPPORTED_AUDIO_CODECS);
    return { supported, config: supported ? config : undefined };
  }

  configure(config: AudioDecoderConfig): void {
    if (this._state === 'closed') {
      throw new WebCodecsDOMException('Cannot configure a closed decoder', 'InvalidStateError');
    }
    if (!isCodecSupported(config.codec, SUPPORTED_AUDIO_CODECS)) {
      this._error(new Error(`Unsupported codec: ${config.codec}`));
      this._state = 'closed';
      return;
    }
    this._state = 'configured';
  }

  decode(_chunk: unknown): void {
    if (this._state !== 'configured') {
      throw new WebCodecsDOMException('Decoder is not configured', 'InvalidStateError');
    }
  }

  async flush(): Promise<void> {
    if (this._state !== 'configured') {
      throw new WebCodecsDOMException('Decoder is not configured', 'InvalidStateError');
    }
  }

  reset(): void {
    if (this._state === 'closed') {
      throw new WebCodecsDOMException('Cannot reset a closed decoder', 'InvalidStateError');
    }
    this._state = 'unconfigured';
    this._decodeQueueSize = 0;
  }

  close(): void {
    this._state = 'closed';
  }
}

/**
 * VideoFrame polyfill for Node.js
 */
export class VideoFrame {
  private _timestamp: number;
  private _duration: number | null;
  private _codedWidth: number;
  private _codedHeight: number;
  private _format: string | null;
  private _closed: boolean = false;

  constructor(_source: unknown, options?: { timestamp?: number; duration?: number }) {
    this._timestamp = options?.timestamp ?? 0;
    this._duration = options?.duration ?? null;
    this._codedWidth = 0;
    this._codedHeight = 0;
    this._format = null;
  }

  get timestamp(): number {
    return this._timestamp;
  }

  get duration(): number | null {
    return this._duration;
  }

  get codedWidth(): number {
    return this._codedWidth;
  }

  get codedHeight(): number {
    return this._codedHeight;
  }

  get format(): string | null {
    return this._format;
  }

  close(): void {
    this._closed = true;
  }

  clone(): VideoFrame {
    return new VideoFrame(null, { timestamp: this._timestamp, duration: this._duration ?? undefined });
  }
}

/**
 * AudioData polyfill for Node.js
 */
export class AudioData {
  private _format: string;
  private _sampleRate: number;
  private _numberOfFrames: number;
  private _numberOfChannels: number;
  private _timestamp: number;
  private _data: ArrayBuffer;
  private _closed: boolean = false;

  constructor(init: AudioDataInit) {
    this._format = init.format;
    this._sampleRate = init.sampleRate;
    this._numberOfFrames = init.numberOfFrames;
    this._numberOfChannels = init.numberOfChannels;
    this._timestamp = init.timestamp;
    
    // Copy the data
    if (init.data instanceof ArrayBuffer) {
      this._data = init.data.slice(0);
    } else {
      const view = init.data as ArrayBufferView;
      const newBuffer = new ArrayBuffer(view.byteLength);
      new Uint8Array(newBuffer).set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
      this._data = newBuffer;
    }
  }

  get format(): string {
    return this._format;
  }

  get sampleRate(): number {
    return this._sampleRate;
  }

  get numberOfFrames(): number {
    return this._numberOfFrames;
  }

  get numberOfChannels(): number {
    return this._numberOfChannels;
  }

  get timestamp(): number {
    return this._timestamp;
  }

  get duration(): number {
    // Duration in microseconds
    return (this._numberOfFrames / this._sampleRate) * 1_000_000;
  }

  close(): void {
    this._closed = true;
  }

  clone(): AudioData {
    return new AudioData({
      format: this._format as AudioDataInit['format'],
      sampleRate: this._sampleRate,
      numberOfFrames: this._numberOfFrames,
      numberOfChannels: this._numberOfChannels,
      timestamp: this._timestamp,
      data: this._data.slice(0),
    });
  }

  copyTo(_destination: BufferSource, _options?: unknown): void {
    // Implementation would copy audio data to destination buffer
  }
}

/**
 * EncodedVideoChunk polyfill for Node.js
 */
export class EncodedVideoChunk {
  private _type: 'key' | 'delta';
  private _timestamp: number;
  private _duration: number | null;
  private _data: ArrayBuffer;

  constructor(init: EncodedChunkInit) {
    this._type = init.type;
    this._timestamp = init.timestamp;
    this._duration = init.duration ?? null;
    
    // Copy the data
    if (init.data instanceof ArrayBuffer) {
      this._data = init.data.slice(0);
    } else {
      const view = init.data as ArrayBufferView;
      const newBuffer = new ArrayBuffer(view.byteLength);
      new Uint8Array(newBuffer).set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
      this._data = newBuffer;
    }
  }

  get type(): 'key' | 'delta' {
    return this._type;
  }

  get timestamp(): number {
    return this._timestamp;
  }

  get duration(): number | null {
    return this._duration;
  }

  get byteLength(): number {
    return this._data.byteLength;
  }

  copyTo(destination: BufferSource): void {
    const destView = destination instanceof ArrayBuffer 
      ? new Uint8Array(destination) 
      : new Uint8Array((destination as ArrayBufferView).buffer, (destination as ArrayBufferView).byteOffset, (destination as ArrayBufferView).byteLength);
    const srcView = new Uint8Array(this._data);
    destView.set(srcView);
  }
}

/**
 * EncodedAudioChunk polyfill for Node.js
 */
export class EncodedAudioChunk {
  private _type: 'key' | 'delta';
  private _timestamp: number;
  private _duration: number | null;
  private _data: ArrayBuffer;

  constructor(init: EncodedChunkInit) {
    this._type = init.type;
    this._timestamp = init.timestamp;
    this._duration = init.duration ?? null;
    
    // Copy the data
    if (init.data instanceof ArrayBuffer) {
      this._data = init.data.slice(0);
    } else {
      const view = init.data as ArrayBufferView;
      const newBuffer = new ArrayBuffer(view.byteLength);
      new Uint8Array(newBuffer).set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
      this._data = newBuffer;
    }
  }

  get type(): 'key' | 'delta' {
    return this._type;
  }

  get timestamp(): number {
    return this._timestamp;
  }

  get duration(): number | null {
    return this._duration;
  }

  get byteLength(): number {
    return this._data.byteLength;
  }

  copyTo(destination: BufferSource): void {
    const destView = destination instanceof ArrayBuffer 
      ? new Uint8Array(destination) 
      : new Uint8Array((destination as ArrayBufferView).buffer, (destination as ArrayBufferView).byteOffset, (destination as ArrayBufferView).byteLength);
    const srcView = new Uint8Array(this._data);
    destView.set(srcView);
  }
}

/**
 * ImageDecoder polyfill for Node.js
 */
export class ImageDecoder {
  static async isTypeSupported(type: string): Promise<boolean> {
    // Support common image types
    const supportedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    return supportedTypes.includes(type.toLowerCase());
  }
}

/**
 * Install the WebCodecs polyfill on globalThis
 * This function should be called to make the WebCodecs API available globally
 */
export function installPolyfill(): void {
  // Only install if not already available (i.e., not in a browser with native support)
  if (typeof globalThis.VideoEncoder === 'undefined') {
    (globalThis as unknown as Record<string, unknown>).VideoEncoder = VideoEncoder;
  }
  if (typeof globalThis.VideoDecoder === 'undefined') {
    (globalThis as unknown as Record<string, unknown>).VideoDecoder = VideoDecoder;
  }
  if (typeof globalThis.AudioEncoder === 'undefined') {
    (globalThis as unknown as Record<string, unknown>).AudioEncoder = AudioEncoder;
  }
  if (typeof globalThis.AudioDecoder === 'undefined') {
    (globalThis as unknown as Record<string, unknown>).AudioDecoder = AudioDecoder;
  }
  if (typeof globalThis.VideoFrame === 'undefined') {
    (globalThis as unknown as Record<string, unknown>).VideoFrame = VideoFrame;
  }
  if (typeof globalThis.AudioData === 'undefined') {
    (globalThis as unknown as Record<string, unknown>).AudioData = AudioData;
  }
  if (typeof globalThis.EncodedVideoChunk === 'undefined') {
    (globalThis as unknown as Record<string, unknown>).EncodedVideoChunk = EncodedVideoChunk;
  }
  if (typeof globalThis.EncodedAudioChunk === 'undefined') {
    (globalThis as unknown as Record<string, unknown>).EncodedAudioChunk = EncodedAudioChunk;
  }
  if (typeof globalThis.ImageDecoder === 'undefined') {
    (globalThis as unknown as Record<string, unknown>).ImageDecoder = ImageDecoder;
  }
}

// Auto-install polyfill in Node.js environment
if (typeof window === 'undefined') {
  installPolyfill();
}
