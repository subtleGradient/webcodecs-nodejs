---
title: Hardware Acceleration Support
status: todo
priority: medium
effort: large
category: implementation
dependencies:
  - ffmpeg-static-build.md
  - threading-worker-loop.md
  - videoframe-memory.md
research: ../research/nodejs-linux-napi-ffmpeg.md
timeline: Week 3-4
---

# Hardware Acceleration Support

Implement hardware-accelerated encode/decode using NVIDIA NVENC/NVDEC and Intel/AMD VA-API on Linux.

## Objective

Enable hardware acceleration for video encoding and decoding when available, matching the WebCodecs `hardwareAcceleration` config option behavior.

## Background

From [Hardware Acceleration on Linux](../research/nodejs-linux-napi-ffmpeg.md#26-hardware-acceleration-on-linux):

> - **NVIDIA (NVENC/NVDEC)**: Encoders: `h264_nvenc`, `hevc_nvenc`
> - **VA-API (Intel/AMD)**: Encoders: `h264_vaapi`, `hevc_vaapi`, VP9/AV1 where supported

## Tasks

- [ ] Implement GPU device detection for NVIDIA
- [ ] Implement GPU device detection for VA-API (Intel/AMD)
- [ ] Create FFmpeg hardware device context (CUDA, VAAPI)
- [ ] Implement HW decoder selection based on codec and config
- [ ] Implement HW encoder selection based on codec and config
- [ ] Handle `hardwareAcceleration` config option:
  - [ ] `"no-preference"` — Use HW if available, fallback to SW
  - [ ] `"prefer-hardware"` — Prioritize HW, fallback to SW
  - [ ] `"prefer-software"` — Prioritize SW, use HW if SW unavailable
- [ ] Implement GPU frame → CPU frame download
- [ ] Update `isConfigSupported()` to check HW availability
- [ ] Add HW acceleration benchmarks
- [ ] Document driver requirements

## Hardware Matrix (Linux)

| GPU Vendor | API | H.264 Dec | H.264 Enc | H.265 Dec | H.265 Enc | VP9 Dec | AV1 Dec | AV1 Enc |
|------------|-----|-----------|-----------|-----------|-----------|---------|---------|---------|
| NVIDIA | NVDEC/NVENC | ✅ | ✅ | ✅ | ✅ | ✅ | ✅* | ✅* |
| Intel | VA-API | ✅ | ✅ | ✅ | ✅ | ✅ | ✅* | ✅* |
| AMD | VA-API | ✅ | ✅ | ✅ | ✅ | ✅* | ✅* | ✅* |

*Varies by GPU generation

## GPU Detection

### NVIDIA Detection

```cpp
bool DetectNvidiaGPU() {
  AVBufferRef* device_ref = nullptr;
  int ret = av_hwdevice_ctx_create(
    &device_ref, 
    AV_HWDEVICE_TYPE_CUDA,
    nullptr,  // Default device
    nullptr,
    0
  );
  
  if (ret >= 0) {
    av_buffer_unref(&device_ref);
    return true;
  }
  return false;
}
```

### VA-API Detection

```cpp
bool DetectVAAPI() {
  AVBufferRef* device_ref = nullptr;
  // Try common VA-API device paths
  const char* devices[] = {
    "/dev/dri/renderD128",
    "/dev/dri/renderD129",
    nullptr
  };
  
  for (const char** dev = devices; *dev; dev++) {
    int ret = av_hwdevice_ctx_create(
      &device_ref,
      AV_HWDEVICE_TYPE_VAAPI,
      *dev,
      nullptr,
      0
    );
    if (ret >= 0) {
      av_buffer_unref(&device_ref);
      return true;
    }
  }
  return false;
}
```

## HW Decoder Setup

```cpp
bool SetupHWDecoder(DecoderContext* ctx, const Config& config) {
  // Check if HW preferred
  if (config.hardwareAcceleration == "prefer-software") {
    return false;  // Use SW decoder
  }
  
  AVHWDeviceType hw_type = SelectHWType();
  if (hw_type == AV_HWDEVICE_TYPE_NONE) {
    if (config.hardwareAcceleration == "prefer-hardware") {
      // Log warning, fallback to SW
    }
    return false;
  }
  
  // Create HW device context
  int ret = av_hwdevice_ctx_create(
    &ctx->hw_device_ref,
    hw_type,
    nullptr,
    nullptr,
    0
  );
  
  if (ret < 0) {
    return false;
  }
  
  // Find HW decoder
  const AVCodec* decoder = avcodec_find_decoder(codec_id);
  
  // Set up HW pixel format
  ctx->codec_ctx->hw_device_ctx = av_buffer_ref(ctx->hw_device_ref);
  ctx->codec_ctx->get_format = GetHWFormat;
  
  return true;
}

AVPixelFormat GetHWFormat(AVCodecContext* ctx,
                          const AVPixelFormat* pix_fmts) {
  for (const AVPixelFormat* p = pix_fmts; *p != AV_PIX_FMT_NONE; p++) {
    if (*p == AV_PIX_FMT_CUDA || *p == AV_PIX_FMT_VAAPI) {
      return *p;
    }
  }
  return pix_fmts[0];  // Fallback
}
```

## HW Encoder Setup

```cpp
struct HWEncoderMap {
  AVCodecID codec_id;
  const char* nvenc_name;
  const char* vaapi_name;
};

static const HWEncoderMap hw_encoders[] = {
  { AV_CODEC_ID_H264, "h264_nvenc", "h264_vaapi" },
  { AV_CODEC_ID_HEVC, "hevc_nvenc", "hevc_vaapi" },
  { AV_CODEC_ID_AV1,  "av1_nvenc",  "av1_vaapi"  },
  { AV_CODEC_ID_VP9,  nullptr,      "vp9_vaapi"  },
};

const AVCodec* FindHWEncoder(AVCodecID codec_id, AVHWDeviceType hw_type) {
  for (const auto& entry : hw_encoders) {
    if (entry.codec_id != codec_id) continue;
    
    const char* name = nullptr;
    if (hw_type == AV_HWDEVICE_TYPE_CUDA && entry.nvenc_name) {
      name = entry.nvenc_name;
    } else if (hw_type == AV_HWDEVICE_TYPE_VAAPI && entry.vaapi_name) {
      name = entry.vaapi_name;
    }
    
    if (name) {
      return avcodec_find_encoder_by_name(name);
    }
  }
  return nullptr;
}
```

## GPU Frame Download

For VideoFrame `copyTo()`, GPU frames must be downloaded:

```cpp
AVFrame* DownloadGPUFrame(AVFrame* hw_frame) {
  if (hw_frame->format != AV_PIX_FMT_CUDA &&
      hw_frame->format != AV_PIX_FMT_VAAPI) {
    return av_frame_clone(hw_frame);  // Already CPU
  }
  
  AVFrame* cpu_frame = av_frame_alloc();
  cpu_frame->format = AV_PIX_FMT_NV12;  // Common intermediate
  
  int ret = av_hwframe_transfer_data(cpu_frame, hw_frame, 0);
  if (ret < 0) {
    av_frame_free(&cpu_frame);
    return nullptr;
  }
  
  return cpu_frame;
}
```

## isConfigSupported() Updates

```typescript
interface HWCapabilities {
  nvidia: {
    available: boolean;
    codecs: string[];  // ['h264', 'hevc', 'av1']
  };
  vaapi: {
    available: boolean;
    codecs: string[];
  };
}

async function isConfigSupported(config: VideoDecoderConfig): Promise<{
  supported: boolean;
  config: VideoDecoderConfig;
}> {
  const hwCaps = await detectHWCapabilities();
  
  if (config.hardwareAcceleration === 'prefer-hardware') {
    // Check if HW available for this codec
    const hasHW = checkHWSupport(config.codec, hwCaps);
    if (!hasHW) {
      // Can still be supported via SW
      return { supported: true, config: { ...config, _actualHW: false } };
    }
  }
  
  // ... rest of validation
}
```

## Acceptance Criteria

1. NVIDIA GPUs detected when CUDA driver present
2. Intel/AMD GPUs detected when VA-API available
3. HW decode works for H.264/HEVC on supported GPUs
4. HW encode works for H.264/HEVC on supported GPUs
5. `hardwareAcceleration: "prefer-hardware"` uses HW when available
6. `hardwareAcceleration: "prefer-software"` uses SW codec
7. Graceful fallback when HW unavailable
8. `isConfigSupported()` accurately reports HW capability
9. GPU frames download correctly for `copyTo()`

## Driver Requirements

Document minimum driver versions:
- NVIDIA: Driver 470+ for full codec support
- Intel: libva 2.x, intel-media-driver
- AMD: mesa-va-drivers or amdgpu-pro

## Deliverables

- [ ] GPU detection utilities
- [ ] HW device context management
- [ ] HW codec selection logic
- [ ] GPU frame download implementation
- [ ] Updated `isConfigSupported()` with HW checks
- [ ] Driver requirement documentation
- [ ] HW vs SW performance benchmarks

## Related

- [FFmpeg Static Build](./ffmpeg-static-build.md) — Must include HW codec support
- [VideoFrame Memory Management](./videoframe-memory.md) — GPU frame download
- [Node.js Linux N-API + FFmpeg Research](../research/nodejs-linux-napi-ffmpeg.md#26-hardware-acceleration-on-linux)
