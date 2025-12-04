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

// Try to load native addon
let nativeAddon: {
  encodeVP8Frame: (data: Buffer, options: { width: number; height: number; bitrate: number; format?: string }) => { data: Buffer; isKeyframe: boolean };
  decodeVP8Frame: (data: Buffer) => { width: number; height: number; data: Buffer; firstPixelR: number; firstPixelG: number; firstPixelB: number };
} | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  nativeAddon = require('../build/Release/webcodecs_native.node');
} catch {
  // Native addon not available
}

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
  private _config: VideoEncoderConfig | null = null;
  private _pendingEncodes: Array<{ frameData: Uint8Array; width: number; height: number; timestamp: number; duration: number | null; options?: { keyFrame?: boolean }; copyPromise?: Promise<unknown> }> = [];

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
    this._config = config;
    this._state = 'configured';
  }

  encode(frame: VideoFrame, options?: { keyFrame?: boolean }): void {
    if (this._state !== 'configured') {
      throw new WebCodecsDOMException('Encoder is not configured', 'InvalidStateError');
    }
    
    // Copy frame data immediately (per WebCodecs spec)
    const width = frame.codedWidth;
    const height = frame.codedHeight;
    const i420Size = frame.allocationSize({ format: 'I420' });
    const frameData = new Uint8Array(i420Size);
    
    // Queue the encode with copied data
    this._encodeQueueSize++;
    
    // Handle async copyTo - queue the promise
    const copyPromise = frame.copyTo(frameData, { format: 'I420' });
    
    // Store the pending encode with the copy promise
    this._pendingEncodes.push({ 
      frameData, 
      width, 
      height, 
      timestamp: frame.timestamp, 
      duration: frame.duration, 
      options,
      copyPromise
    });
  }

  async flush(): Promise<void> {
    if (this._state !== 'configured') {
      throw new WebCodecsDOMException('Encoder is not configured', 'InvalidStateError');
    }
    
    if (!nativeAddon) {
      this._error(new Error('Native addon not available'));
      return;
    }
    
    // Process all pending encodes
    for (const { frameData, width, height, timestamp, duration, copyPromise } of this._pendingEncodes) {
      // Wait for copy to complete if needed
      if (copyPromise) {
        await copyPromise;
      }
      try {
        // Encode using native addon - pass I420 directly
        const result = nativeAddon.encodeVP8Frame(Buffer.from(frameData), {
          width,
          height,
          bitrate: this._config?.bitrate ?? 500000,
          format: 'I420',
        });
        
        // Create EncodedVideoChunk from result
        const chunk = new EncodedVideoChunk({
          type: result.isKeyframe ? 'key' : 'delta',
          timestamp: timestamp,
          duration: duration ?? undefined,
          data: new Uint8Array(result.data).buffer,
        });
        
        // Call output callback with chunk and metadata
        const metadata = {
          decoderConfig: {
            codec: this._config?.codec ?? 'vp8',
            codedWidth: width,
            codedHeight: height,
          },
        };
        
        this._output(chunk, metadata);
      } catch (e) {
        this._error(e as Error);
      } finally {
        this._encodeQueueSize--;
      }
    }
    
    this._pendingEncodes = [];
  }

  reset(): void {
    if (this._state === 'closed') {
      throw new WebCodecsDOMException('Cannot reset a closed encoder', 'InvalidStateError');
    }
    this._state = 'unconfigured';
    this._encodeQueueSize = 0;
    this._pendingEncodes = [];
    this._config = null;
  }

  close(): void {
    this._state = 'closed';
    this._pendingEncodes = [];
  }
}

// Helper: Convert I420 (YUV420P) to RGB24
function i420ToRgb24(i420: Uint8Array, width: number, height: number): Uint8Array {
  const ySize = width * height;
  const uvSize = (width / 2) * (height / 2);
  const rgb = new Uint8Array(width * height * 3);
  
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const yIndex = j * width + i;
      const uvIndex = Math.floor(j / 2) * (width / 2) + Math.floor(i / 2);
      
      const y = i420[yIndex];
      const u = i420[ySize + uvIndex];
      const v = i420[ySize + uvSize + uvIndex];
      
      // YUV to RGB conversion
      const c = y - 16;
      const d = u - 128;
      const e = v - 128;
      
      const r = Math.max(0, Math.min(255, Math.round((298 * c + 409 * e + 128) >> 8)));
      const g = Math.max(0, Math.min(255, Math.round((298 * c - 100 * d - 208 * e + 128) >> 8)));
      const b = Math.max(0, Math.min(255, Math.round((298 * c + 516 * d + 128) >> 8)));
      
      const rgbIndex = (j * width + i) * 3;
      rgb[rgbIndex] = r;
      rgb[rgbIndex + 1] = g;
      rgb[rgbIndex + 2] = b;
    }
  }
  
  return rgb;
}

/**
 * VideoDecoder polyfill for Node.js
 */
export class VideoDecoder {
  private _state: CodecState = 'unconfigured';
  private _decodeQueueSize: number = 0;
  private _output: (frame: unknown) => void;
  private _error: (error: Error) => void;
  private _config: VideoDecoderConfig | null = null;
  private _pendingDecodes: EncodedVideoChunk[] = [];

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
    this._config = config;
    this._state = 'configured';
  }

  decode(chunk: EncodedVideoChunk): void {
    if (this._state !== 'configured') {
      throw new WebCodecsDOMException('Decoder is not configured', 'InvalidStateError');
    }
    
    // Queue the decode
    this._decodeQueueSize++;
    this._pendingDecodes.push(chunk);
  }

  async flush(): Promise<void> {
    if (this._state !== 'configured') {
      throw new WebCodecsDOMException('Decoder is not configured', 'InvalidStateError');
    }
    
    if (!nativeAddon) {
      this._error(new Error('Native addon not available'));
      return;
    }
    
    // Process all pending decodes
    for (const chunk of this._pendingDecodes) {
      try {
        // Get encoded data from chunk
        const encodedBuffer = new Uint8Array(chunk.byteLength);
        chunk.copyTo(encodedBuffer);
        
        // Decode using native addon
        const result = nativeAddon.decodeVP8Frame(Buffer.from(encodedBuffer));
        
        // Convert RGB24 result to I420 for VideoFrame
        const rgb24 = new Uint8Array(result.data);
        const i420 = rgb24ToI420(rgb24, result.width, result.height);
        
        // Create VideoFrame from decoded data
        const frame = new VideoFrame(i420.buffer as ArrayBuffer, {
          format: 'I420',
          codedWidth: result.width,
          codedHeight: result.height,
          timestamp: chunk.timestamp,
          duration: chunk.duration ?? undefined,
        });
        
        this._output(frame);
      } catch (e) {
        this._error(e as Error);
      } finally {
        this._decodeQueueSize--;
      }
    }
    
    this._pendingDecodes = [];
  }

  reset(): void {
    if (this._state === 'closed') {
      throw new WebCodecsDOMException('Cannot reset a closed decoder', 'InvalidStateError');
    }
    this._state = 'unconfigured';
    this._decodeQueueSize = 0;
    this._pendingDecodes = [];
    this._config = null;
  }

  close(): void {
    this._state = 'closed';
    this._pendingDecodes = [];
  }
}

// Helper: Convert RGB24 to I420 (YUV420P)
function rgb24ToI420(rgb: Uint8Array, width: number, height: number): Uint8Array {
  const ySize = width * height;
  const uvSize = (width / 2) * (height / 2);
  const i420 = new Uint8Array(ySize + uvSize * 2);
  
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const rgbIndex = (j * width + i) * 3;
      const r = rgb[rgbIndex];
      const g = rgb[rgbIndex + 1];
      const b = rgb[rgbIndex + 2];
      
      // RGB to YUV conversion
      const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      
      const yIndex = j * width + i;
      i420[yIndex] = Math.max(0, Math.min(255, y));
      
      // U and V are subsampled 2x2
      if (j % 2 === 0 && i % 2 === 0) {
        const u = Math.round(-0.169 * r - 0.331 * g + 0.5 * b + 128);
        const v = Math.round(0.5 * r - 0.419 * g - 0.081 * b + 128);
        
        const uvIndex = (j / 2) * (width / 2) + (i / 2);
        i420[ySize + uvIndex] = Math.max(0, Math.min(255, u));
        i420[ySize + uvSize + uvIndex] = Math.max(0, Math.min(255, v));
      }
    }
  }
  
  return i420;
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

interface VideoFrameInit {
  format?: string;
  codedWidth?: number;
  codedHeight?: number;
  timestamp?: number;
  duration?: number;
  displayWidth?: number;
  displayHeight?: number;
}

interface VideoFrameBufferInit {
  format: string;
  codedWidth: number;
  codedHeight: number;
  timestamp: number;
  duration?: number;
}

/**
 * VideoFrame polyfill for Node.js
 */
export class VideoFrame {
  private _timestamp: number;
  private _duration: number | null;
  private _codedWidth: number;
  private _codedHeight: number;
  private _displayWidth: number;
  private _displayHeight: number;
  private _format: string | null;
  private _data: ArrayBuffer | null;
  private _closed: boolean = false;

  constructor(source: BufferSource | null, options?: VideoFrameInit | VideoFrameBufferInit) {
    this._timestamp = options?.timestamp ?? 0;
    this._duration = options?.duration ?? null;
    
    // Handle buffer source with VideoFrameBufferInit
    if (source && 'format' in (options || {})) {
      const init = options as VideoFrameBufferInit;
      this._format = init.format;
      this._codedWidth = init.codedWidth;
      this._codedHeight = init.codedHeight;
      this._displayWidth = init.codedWidth;
      this._displayHeight = init.codedHeight;
      
      // Copy the data
      if (source instanceof ArrayBuffer) {
        this._data = source.slice(0);
      } else if (ArrayBuffer.isView(source)) {
        const view = source as ArrayBufferView;
        const newBuffer = new ArrayBuffer(view.byteLength);
        new Uint8Array(newBuffer).set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
        this._data = newBuffer;
      } else {
        this._data = null;
      }
    } else {
      // Legacy path or null source
      const init = options as VideoFrameInit | undefined;
      this._codedWidth = init?.codedWidth ?? 0;
      this._codedHeight = init?.codedHeight ?? 0;
      this._displayWidth = init?.displayWidth ?? this._codedWidth;
      this._displayHeight = init?.displayHeight ?? this._codedHeight;
      this._format = init?.format ?? null;
      this._data = null;
    }
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

  get displayWidth(): number {
    return this._displayWidth;
  }

  get displayHeight(): number {
    return this._displayHeight;
  }

  get format(): string | null {
    return this._format;
  }

  get visibleRect(): { x: number; y: number; width: number; height: number } {
    return { x: 0, y: 0, width: this._codedWidth, height: this._codedHeight };
  }

  allocationSize(options?: { format?: string }): number {
    const format = options?.format ?? this._format;
    const width = this._codedWidth;
    const height = this._codedHeight;
    
    switch (format) {
      case 'I420':
      case 'YUV420P':
        // Y plane + U plane (1/4) + V plane (1/4) = 1.5 * width * height
        return width * height + (width / 2) * (height / 2) * 2;
      case 'RGB':
      case 'RGB24':
        return width * height * 3;
      case 'RGBA':
        return width * height * 4;
      default:
        // Default to I420 if format is unknown
        return width * height + (width / 2) * (height / 2) * 2;
    }
  }

  async copyTo(destination: BufferSource, options?: { format?: string }): Promise<Array<{ offset: number; stride: number }>> {
    if (this._closed) {
      throw new WebCodecsDOMException('VideoFrame is closed', 'InvalidStateError');
    }
    
    const destView = destination instanceof ArrayBuffer 
      ? new Uint8Array(destination) 
      : new Uint8Array((destination as ArrayBufferView).buffer, (destination as ArrayBufferView).byteOffset, (destination as ArrayBufferView).byteLength);
    
    const requestedFormat = options?.format ?? this._format;
    const width = this._codedWidth;
    const height = this._codedHeight;
    
    if (!this._data) {
      return [];
    }
    
    const srcView = new Uint8Array(this._data);
    
    // If same format, just copy
    if (requestedFormat === this._format) {
      destView.set(srcView.subarray(0, Math.min(srcView.length, destView.length)));
    } else if (this._format === 'I420' && (requestedFormat === 'RGB' || requestedFormat === 'RGB24')) {
      // Convert I420 to RGB24
      const rgb = i420ToRgb24(srcView, width, height);
      destView.set(rgb.subarray(0, Math.min(rgb.length, destView.length)));
    } else if (this._format === 'I420' && requestedFormat === 'RGBA') {
      // Convert I420 to RGBA
      const rgb = i420ToRgb24(srcView, width, height);
      const rgba = new Uint8Array(width * height * 4);
      for (let i = 0; i < width * height; i++) {
        rgba[i * 4] = rgb[i * 3];
        rgba[i * 4 + 1] = rgb[i * 3 + 1];
        rgba[i * 4 + 2] = rgb[i * 3 + 2];
        rgba[i * 4 + 3] = 255;
      }
      destView.set(rgba.subarray(0, Math.min(rgba.length, destView.length)));
    } else {
      // Fallback: just copy raw data
      destView.set(srcView.subarray(0, Math.min(srcView.length, destView.length)));
    }
    
    // Return PlaneLayout array based on format
    if (requestedFormat === 'I420' || requestedFormat === 'YUV420P' || this._format === 'I420') {
      const ySize = width * height;
      const uvWidth = width / 2;
      const uvHeight = height / 2;
      return [
        { offset: 0, stride: width },                    // Y plane
        { offset: ySize, stride: uvWidth },              // U plane
        { offset: ySize + uvWidth * uvHeight, stride: uvWidth }  // V plane
      ];
    } else if (requestedFormat === 'RGBA') {
      return [{ offset: 0, stride: width * 4 }];
    } else if (requestedFormat === 'RGB' || requestedFormat === 'RGB24') {
      return [{ offset: 0, stride: width * 3 }];
    }
    
    return [{ offset: 0, stride: width }];
  }

  close(): void {
    this._closed = true;
    this._data = null;
  }

  clone(): VideoFrame {
    if (this._closed) {
      throw new WebCodecsDOMException('VideoFrame is closed', 'InvalidStateError');
    }
    const cloned = new VideoFrame(this._data, {
      format: this._format ?? undefined,
      codedWidth: this._codedWidth,
      codedHeight: this._codedHeight,
      timestamp: this._timestamp,
      duration: this._duration ?? undefined,
    } as VideoFrameBufferInit);
    return cloned;
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

  allocationSize(options: { planeIndex: number }): number {
    // Get bytes per sample based on format
    const bytesPerSample = this._format.startsWith('f32') ? 4 :
                           this._format.startsWith('s32') ? 4 :
                           this._format.startsWith('s16') ? 2 : 1;
    
    // For planar formats, each plane has numberOfFrames samples
    // For interleaved formats, planeIndex 0 has all data
    if (this._format.endsWith('-planar')) {
      return this._numberOfFrames * bytesPerSample;
    } else {
      // Interleaved: all channels in plane 0
      if (options.planeIndex === 0) {
        return this._numberOfFrames * this._numberOfChannels * bytesPerSample;
      }
      return 0;
    }
  }

  copyTo(destination: BufferSource, options: { planeIndex: number }): void {
    if (this._closed) {
      throw new WebCodecsDOMException('AudioData is closed', 'InvalidStateError');
    }
    
    const destView = destination instanceof ArrayBuffer 
      ? new Uint8Array(destination) 
      : new Uint8Array((destination as ArrayBufferView).buffer, (destination as ArrayBufferView).byteOffset, (destination as ArrayBufferView).byteLength);
    
    const srcView = new Uint8Array(this._data);
    const bytesPerSample = this._format.startsWith('f32') ? 4 :
                           this._format.startsWith('s32') ? 4 :
                           this._format.startsWith('s16') ? 2 : 1;
    
    if (this._format.endsWith('-planar')) {
      // Planar: each plane is numberOfFrames * bytesPerSample
      const planeSize = this._numberOfFrames * bytesPerSample;
      const offset = options.planeIndex * planeSize;
      destView.set(srcView.subarray(offset, offset + planeSize));
    } else {
      // Interleaved: all data in plane 0
      if (options.planeIndex === 0) {
        destView.set(srcView.subarray(0, Math.min(srcView.length, destView.length)));
      }
    }
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
