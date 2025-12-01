---
title: VideoFrame Memory Management
status: todo
priority: critical
effort: large
category: implementation
dependencies:
  - napi-poc-addon.md
  - threading-worker-loop.md
research: ../research/nodejs-linux-napi-ffmpeg.md
timeline: Week 2
---

# VideoFrame Memory Management

Implement efficient memory management for VideoFrame objects with zero-copy patterns where possible and proper lifecycle handling.

## Objective

Design and implement the native backing for `VideoFrame` objects that:
- Minimizes memory copies between native and JS layers
- Properly manages AVFrame* lifecycle
- Supports `copyTo()` with format conversion
- Handles `close()` and GC cleanup correctly

## Background

From [Memory Management Strategy](../research/nodejs-linux-napi-ffmpeg.md#4-memory-management-strategy):

> Use **lazy-copy** strategy:
> - `VideoFrame` contains an `AVFrame*` (native).
> - On creation: no copy to JS memory; just store pointer + metadata.
> - On `copyTo(view, options)`: Convert `AVFrame` to requested format using libswscale if needed.

## Tasks

- [ ] Design NativeVideoFrame C++ class structure
- [ ] Implement AVFrame* ownership and reference counting
- [ ] Implement VideoFrame JS wrapper with N-API bindings
- [ ] Implement `copyTo(destination, options)` method
- [ ] Integrate libswscale for format conversions
- [ ] Implement `close()` method for explicit cleanup
- [ ] Wire up N-API destructor for GC cleanup
- [ ] Handle GPU frame download (if HW decode enabled)
- [ ] Implement EncodedVideoChunk with external buffer
- [ ] Add memory benchmarks

## VideoFrame Data Model

```cpp
class NativeVideoFrame {
 private:
  AVFrame* frame_;           // Owned AVFrame
  bool closed_;              // Prevent use after close
  std::atomic<int> refcount_; // For potential sharing
  
  // Cached metadata
  int display_width_;
  int display_height_;
  int64_t timestamp_;
  int64_t duration_;
  VideoPixelFormat format_;
  
 public:
  NativeVideoFrame(AVFrame* frame);
  ~NativeVideoFrame();
  
  void Close();
  bool IsClosed() const;
  
  // Copy frame data to JS buffer
  napi_status CopyTo(napi_env env, 
                     napi_value destination,
                     const CopyOptions& options);
};
```

## Pixel Format Mapping

| WebCodecs Format | FFmpeg Format | Notes |
|------------------|---------------|-------|
| `I420` | `AV_PIX_FMT_YUV420P` | Most common |
| `I420A` | `AV_PIX_FMT_YUVA420P` | With alpha |
| `I422` | `AV_PIX_FMT_YUV422P` | |
| `I444` | `AV_PIX_FMT_YUV444P` | |
| `NV12` | `AV_PIX_FMT_NV12` | Common HW format |
| `RGBA` | `AV_PIX_FMT_RGBA` | For display |
| `RGBX` | `AV_PIX_FMT_RGB0` | No alpha |
| `BGRA` | `AV_PIX_FMT_BGRA` | Windows common |
| `BGRX` | `AV_PIX_FMT_BGR0` | |

## copyTo() Implementation

```cpp
napi_status NativeVideoFrame::CopyTo(
    napi_env env,
    napi_value destination,
    const CopyOptions& options) {
  
  if (closed_) {
    return ThrowInvalidStateError(env);
  }
  
  // Get destination buffer info
  void* dest_data;
  size_t dest_length;
  napi_get_buffer_info(env, destination, &dest_data, &dest_length);
  
  // Determine target format
  AVPixelFormat target_fmt = MapToAVPixFmt(options.format);
  
  // Get or create swscale context
  SwsContext* sws_ctx = sws_getContext(
    frame_->width, frame_->height, (AVPixelFormat)frame_->format,
    frame_->width, frame_->height, target_fmt,
    SWS_BILINEAR, nullptr, nullptr, nullptr
  );
  
  // Scale/convert
  uint8_t* dest_planes[4] = { (uint8_t*)dest_data, nullptr, nullptr, nullptr };
  int dest_strides[4] = { options.stride, 0, 0, 0 };
  
  sws_scale(sws_ctx, frame_->data, frame_->linesize,
            0, frame_->height, dest_planes, dest_strides);
  
  sws_freeContext(sws_ctx);
  return napi_ok;
}
```

## EncodedVideoChunk Zero-Copy

```cpp
class NativeEncodedVideoChunk {
 private:
  // Option 1: Own the AVPacket
  AVPacket* packet_;
  
  // Option 2: External buffer reference
  napi_ref buffer_ref_;
  
 public:
  // Create external buffer wrapping packet data
  static napi_value CreateBuffer(napi_env env, AVPacket* pkt) {
    return napi_create_external_buffer(
      env,
      pkt->size,
      pkt->data,
      [](napi_env, void*, void* hint) {
        AVPacket* p = (AVPacket*)hint;
        av_packet_unref(p);
        av_packet_free(&p);
      },
      pkt,
      nullptr
    );
  }
};
```

## GPU Frame Handling

For hardware-decoded frames:

```cpp
if (frame_->format == AV_PIX_FMT_CUDA ||
    frame_->format == AV_PIX_FMT_VAAPI) {
  // Download to CPU frame first
  AVFrame* cpu_frame = av_frame_alloc();
  if (av_hwframe_transfer_data(cpu_frame, frame_, 0) < 0) {
    return ThrowOperationError(env, "GPU download failed");
  }
  // Use cpu_frame for copyTo
  // Free cpu_frame when done
}
```

## Lifecycle State Machine

```
                ┌─────────────┐
                │ Uncreated   │
                └──────┬──────┘
                       │ new VideoFrame(data)
                       ▼
                ┌─────────────┐
                │   Active    │◄──────────┐
                └──────┬──────┘           │
                       │                  │
         close()       │      clone()     │
                       ▼                  │
                ┌─────────────┐           │
                │   Closed    │           │
                └─────────────┘           │
                                          │
                              (Creates new frame)
```

## Acceptance Criteria

1. VideoFrame wraps AVFrame* without copying on creation
2. `copyTo()` converts to requested format via libswscale
3. `close()` immediately frees AVFrame
4. GC finalizer frees AVFrame if not already closed
5. Access to closed frame throws `InvalidStateError`
6. GPU frames are downloaded to CPU transparently
7. EncodedVideoChunk uses external buffer for zero-copy
8. No memory leaks under repeated frame creation/destruction

## Benchmarks

- [ ] VideoFrame creation overhead (no copy)
- [ ] `copyTo()` for 1080p I420 → RGBA
- [ ] `copyTo()` for 4K I420 → RGBA  
- [ ] Memory stability over 10,000 frame cycle
- [ ] GPU frame download time (if applicable)

## Deliverables

- [ ] `src/native/video_frame.cc` — NativeVideoFrame implementation
- [ ] `src/native/encoded_chunk.cc` — EncodedVideoChunk implementation
- [ ] Format conversion utilities using libswscale
- [ ] Tests for lifecycle and copyTo behavior
- [ ] Memory benchmark results

## Related

- [Threading & Worker Loop](./threading-worker-loop.md) — Creates VideoFrame instances
- [Hardware Acceleration Support](./hardware-acceleration.md) — GPU frame handling
- [Node.js Linux N-API + FFmpeg Research](../research/nodejs-linux-napi-ffmpeg.md#4-memory-management-strategy)
