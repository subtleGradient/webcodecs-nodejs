# Node.js WebCodecs on Linux — N-API + FFmpeg Research

> **Parent document**: [WebCodecs Overview](./webcodecs-overview.md)  
> **Related**: [Node.js Implementation Tasks](./nodejs-implementation.md) | [Implementation Options](./options.md)
>
> ⚠️ **Important Update**: See [FFmpeg N-API Bindings Research](./ffmpeg-napi.md) for an **alternative faster path** using existing production-ready FFmpeg N-API bindings (node-av, @mmomtchev/ffmpeg). This document describes the from-scratch approach, which may still be useful if the existing bindings have gaps, but the shim-based approach is now recommended.

**Scope**

- Goal: Make the WebCodecs API usable in Node.js on **Linux** by any means necessary.
- Strategy: Implement a Node-API (N-API) native addon that wraps **FFmpeg** for encode/decode.
- Focus: Linux first (x64 / arm64). Other platforms are "later".

---

## 1. N-API Architecture Investigation

### 1.1 Goal

Design a robust N-API architecture for WebCodecs bindings that:

- Wraps complex native objects (`VideoDecoder`, `VideoEncoder`, `VideoFrame`, etc.)
- Handles threaded async operations without blocking the Node event loop
- Manages large buffers and native resources safely
- Is stable across Node versions (Node-API ABI stability)

### 1.2 Patterns from Existing Projects

**node-webrtc**

- Wraps the Chromium WebRTC stack behind a mostly spec-compatible WebRTC API in Node.
- Uses N-API / node-gyp + prebuilt binaries.
- Key patterns:
  - **C++ wrapper classes** own native WebRTC objects.
  - Methods exposed to JS via N-API.
  - Background threads do heavy work; results are marshalled back via main-thread-safe callbacks.

**sharp**

- Image processing library using libvips.
- Heavily optimized for large buffers and zero-copy where possible.
- Key patterns:
  - Node-API used for ABI-stable bindings.
  - Uses **external Buffers** to avoid copying between native and JS.
  - Ships prebuilt binaries with bundled native deps.

**General N-API patterns**

- `Napi::ObjectWrap` (or raw `napi_wrap`) to bind C++ object lifetime to JS object lifetime.
- `napi_create_threadsafe_function` for calling JS callbacks from worker threads safely.
- `napi_create_external_buffer/arraybuffer` for zero-copy sharing of native memory into JS.
- `napi_async_work` for one-shot tasks (less ideal for streaming media).

### 1.3 Proposed Object Model

Each WebCodecs class is a JS wrapper around a C++ class:

- `VideoDecoder` ⇄ `NativeVideoDecoder`
- `VideoEncoder` ⇄ `NativeVideoEncoder`
- `AudioDecoder` ⇄ `NativeAudioDecoder`
- `AudioEncoder` ⇄ `NativeAudioEncoder`
- `VideoFrame` ⇄ `NativeVideoFrame` (holding `AVFrame*` or similar)
- `AudioData` ⇄ `NativeAudioData`
- `EncodedVideoChunk` / `EncodedAudioChunk` ⇄ native buffers or `AVPacket*`

**Lifecycle**

- JS object created → C++ instance allocated and `napi_wrap`-ed.
- When JS object is GC'd:
  - Finalizer runs, freeing native state (codec contexts, frames, packets, threads).
- Explicit `close()` on JS object:
  - Immediately cleans native state and marks the wrapper as "closed".
  - Further operations throw spec-appropriate errors.

### 1.4 Async + Threads

**Constraints**

- Heavy encode/decode must **not** run on the Node main thread.
- Native threads must **not call JS** directly.

**Solution**

- Each codec instance owns:
  - A dedicated worker thread (simpler, robust, predictable ordering).
  - An input queue of work items (packets/frames + control commands).
  - One or more N-API **thread-safe functions** for delivering:
    - `output` callbacks (frames / encoded chunks)
    - `error` callbacks

**Flow**

1. JS calls `decoder.decode(chunk)`:
   - Native `decode` enqueues a work item into the decoder's queue.
2. Worker thread:
   - Waits on queue.
   - Runs `avcodec_send_packet` / `avcodec_receive_frame`.
   - Wraps frame in a native `VideoFrame` object.
   - Schedules JS `output` callback via `napi_call_threadsafe_function`.
3. JS callback runs on main thread, receives `VideoFrame`.

**Why per-instance threads (not shared pool)?**

- Each codec context is stateful and not thread-safe.
- Per-instance threads:
  - Make packet ordering trivial.
  - Avoid fine-grained locking on codec contexts.
  - Trade some overhead for simpler correctness.

### 1.5 Buffer & Overhead Considerations

- Use **Node Buffers / Uint8Array** wrapping native memory:
  - Encoded data → wrap `AVPacket->data` as `Buffer` via `napi_create_external_buffer`.
  - Decoded frames → store `AVFrame*` in `VideoFrame`; copy out only upon `copyTo()`.
- N-API overhead:
  - Single N-API call + TSFN dispatch is negligible vs. codec CPU cost.
  - Still worth micro-benchmarking a "no-op" decode to quantify overhead.

### 1.6 Minimal PoC Design

**PoC target**

- A `DummyDecoder` N-API class with:
  - `configure()`
  - `decode(chunk)`
  - `flush()`
- Worker thread that:
  - Sleeps 5ms pretending to decode
  - Returns a fake `VideoFrame` object via TSFN

This validates:

- Object wrapping
- Worker thread loop
- Thread-safe callback into JS
- Basic lifetime management

---

## 2. FFmpeg Integration Strategy (Linux)

### 2.1 Goal

Use FFmpeg as the codec engine for all WebCodecs operations on Linux:

- Map WebCodecs calls to libavcodec/libavformat/libswscale/libswresample APIs.
- Handle both software and (optionally) hardware acceleration paths.
- Respect licensing constraints (LGPL vs GPL vs patents).

### 2.2 Linking Options

**Static linking**

- Pros:
  - Single self-contained `.node` binary.
  - No system dependencies beyond libc.
- Cons:
  - Larger binary (tens of MB).
  - If GPL codecs (x264/x265/libfdk_aac) are included, the addon must be GPL-compatible.

**Dynamic linking to system FFmpeg**

- Pros:
  - Smaller addon binary.
  - System admins can upgrade FFmpeg independently.
- Cons:
  - Requires specific FFmpeg versions and configs installed.
  - Installation friction; inconsistent behavior across distros.

**Hybrid**

- Default: statically link FFmpeg with only **LGPL-compatible components** and BSD libs (libvpx, libopus, libdav1d, libaom, SVT-AV1, OpenH264).
- Optional: a "full-GPL" build configuration for people who knowingly want GPL codecs (x264/x265/libfdk_aac) and are okay with the license implications.

### 2.3 Mapping WebCodecs to FFmpeg APIs

**Decoder**

- `configure(config)`:
  - Parse codec string (e.g. `"avc1.42E01E"`).
  - Resolve FFmpeg `AVCodec` via `avcodec_find_decoder`.
  - Allocate `AVCodecContext`, set:
    - codec parameters
    - width/height
    - pixel format if known
    - extradata (e.g., SPS/PPS for H.264)
  - `avcodec_open2()`.

- `decode(EncodedVideoChunk chunk)`:
  - Wrap chunk buffer in `AVPacket`.
  - `avcodec_send_packet(ctx, pkt)`.
  - Read zero or more frames with `avcodec_receive_frame(ctx, frame)`.
  - For each frame:
    - Produce a `VideoFrame` object with timestamp/duration.
    - Call JS `output(frame)` callback.

**Encoder**

- `configure(config)`:
  - Pick encoder: `avcodec_find_encoder`.
    - e.g. `libvpx-vp8`, `libvpx-vp9`, `libaom-av1`, `libx264` or `libopenh264`, etc.
  - Set `bit_rate`, `gop_size`, `time_base`, etc.
  - `avcodec_open2()`.

- `encode(VideoFrame frame)`:
  - Convert `VideoFrame` to an `AVFrame` (possibly using libswscale).
  - `avcodec_send_frame(ctx, frame)`.
  - Gather any produced packets via `avcodec_receive_packet`.
  - Wrap each as `EncodedVideoChunk` and deliver via JS `output(chunk)`.

**Flush**

- `flush()`:
  - Push `NULL` frame/packet.
  - Drain `avcodec_receive_frame/packet` until `EAGAIN` / `EOF`.
  - Resolve the flush promise once queues are empty.

### 2.4 Codec String Parsing

WebCodecs uses codec identifiers like:

- Video:
  - H.264: `avc1.42E01E`, `avc3.640028`, etc.
  - VP9: `vp09.00.10.08...`
  - AV1: `av01.0.08M.08...`
  - H.265: `hvc1.1.6.L93.B0`, `hev1...`
- Audio:
  - AAC: `mp4a.40.2` (AAC-LC)
  - Opus: `opus`

We need a parser that:

- Extracts **codec family** (e.g. `"avc1" → H.264`).
- Extracts profile & level when present.
- Maps that to FFmpeg codec name and options.

**Implementation sketch**

- A small pure-TS or C++ parser taking a codec string and returning:
  - `codecId` (e.g. `AV_CODEC_ID_H264`)
  - `profile`, `level`, `chroma_subsampling`, etc.
- If unknown or unsupported → `isConfigSupported()` returns `{ supported: false }`.

### 2.5 Licensing Implications

- FFmpeg core can be built as **LGPL** if we avoid GPL components.
- Including encoders like **x264/x265/libfdk_aac** triggers **GPL / non-free** licensing:
  - Any static-linked binary including them must be GPL-compatible.
  - That means the **addon itself** must be GPL, and distribution needs source disclosure.
- Safer default:
  - Provide an **LGPL-only build**:
    - Use OpenH264 for H.264 encoding.
    - Use libvpx for VP8/VP9 encode.
    - Use libaom/SVT-AV1 for AV1 encode.
    - Use FFmpeg's internal AAC or Opus encoders (Opus via libopus).
  - Optionally support a "GPL build" variant for custom installations.

### 2.6 Hardware Acceleration on Linux

Targets:

- **NVIDIA (NVENC/NVDEC)**:
  - Encoders: `h264_nvenc`, `hevc_nvenc`, (AV1 on newer GPUs).
  - Decoders: NVDEC-based (via FFmpeg or CUVID).
- **VA-API (Intel/AMD)**:
  - Encoders: `h264_vaapi`, `hevc_vaapi`, VP9/AV1 where supported.
  - Decoders: VAAPI decoders for H.264/H.265/VP8/VP9/AV1.

**Design**

- Provide a `hardwareAcceleration` hint in config (matching WebCodecs):
  - `"prefer-hardware"`, `"prefer-software"`, `"require-hardware"`.
- On configure:
  - Detect GPU availability and FFmpeg HW support.
  - Try to set up `AVHWDeviceContext` (CUDA, VAAPI).
  - Select HW encoder/decoder if matching codec and HW present.
- On decode:
  - Use FFmpeg's HW frame pipeline.
  - Immediately **download to CPU memory** for `VideoFrame` unless and until we support GPU-side sharing.

---

## 3. Threading Model Design

### 3.1 Goal

Non-blocking, robust threading for encode/decode:

- Never block the Node event loop.
- Preserve correct order of outputs.
- Handle reset/close safely.
- Work well with many concurrent decoders/encoders.

### 3.2 Per-Instance Worker Thread

**Model**

- Each `VideoDecoder` / `VideoEncoder` owns:
  - A dedicated worker thread.
  - A thread-safe input queue.
  - One or more thread-safe functions (TSFNs) for JS callbacks.

**Pros**

- No shared locking on codec contexts.
- Linear, deterministic packet/frame ordering.
- Reasonable overhead: codecs are heavy, so per-instance thread cost is small relative to work done.

**Cons**

- Many instances → many threads.
- Can be mitigated by configurable limits later.

### 3.3 Queue & Command Protocol

Each worker's queue contains commands:

- `DECODE(packet)`
- `ENCODE(frame)`
- `FLUSH`
- `RESET`
- `CLOSE`

**Worker loop (pseudo)**

```cpp
while (running) {
  Command cmd = queue.pop()

  switch (cmd.type) {
    case DECODE:
      // send packet, drain frames, post output callbacks
      break
    case ENCODE:
      // send frame, drain packets, post output callbacks
      break
    case FLUSH:
      // push null frame/packet, drain, then resolve flush promise
      break
    case RESET:
      // avcodec_flush_buffers + clear pending queues
      break
    case CLOSE:
      // drain, free codec, break loop
      running = false
      break
  }
}
```

JS-facing methods just enqueue commands and return (or return a promise for flush).

### 3.4 Callback Delivery

- Worker threads **never** call JS directly.
- All JS callbacks go through **TSFN**:
  - `outputTSFN` for `output(VideoFrame|EncodedChunk)`.
  - `errorTSFN` for error events.

**Mode**

- Use non-blocking calls (`napi_tsfn_nonblocking` equivalent):
  - Avoid worker thread blocking on saturated JS queue.
- Consider a soft limit for queued outputs; if exceeded:
  - Option 1: slow input side (backpressure).
  - Option 2: drop frames (only acceptable when spec allows).

### 3.5 Reset / Close Edge Cases

**reset()**

- Enqueue `RESET`.
- Worker:
  - Flush codec (`avcodec_flush_buffers`).
  - Drop any queued inputs/frames.
- After reset:
  - Decoder re-enters "configured" state, ready for new input.
  - No still-in-flight outputs should appear after reset (spec behavior).

**close()**

- Enqueue `CLOSE`.
- Worker:
  - Finish processing any in-progress command, or stop immediately depending on policy.
  - Free FFmpeg contexts.
  - Signal TSFN completion and let TSFN be released.
- JS-side:
  - Mark object as `closed`.
  - Further calls (e.g., `decode` or `encode`) throw `InvalidStateError`.

### 3.6 Memory Considerations

- Per-thread frame buffers.
- Frame queue length caps to avoid unbounded memory use.
- For 4K YUV420 frames (~24–33MB), even small queues are expensive.
- Use `encodeQueueSize` and maybe `decodeQueueSize` metrics for backpressure.

### 3.7 Prototype

- Implement minimal async decode:
  - Input: a small H.264 file buffer.
  - Setup: `VideoDecoder` on Linux, decode entire file.
  - Validate:
    - No event-loop blocking.
    - All frames delivered and accounted for.
    - `reset()` and `close()` behave sanely.

---

## 4. Memory Management Strategy

### 4.1 Goals

- Minimize copying between native and JS.
- Ensure native resources are freed promptly:
  - On `close()`
  - On GC of JS objects
- Keep behavior aligned with WebCodecs semantics.

### 4.2 Zero-Copy Encoded Data

- Wrap FFmpeg `AVPacket->data` in a Node `Buffer` using `napi_create_external_buffer`.
- `EncodedVideoChunk` / `EncodedAudioChunk` simply holds that Buffer + metadata (timestamp, type).
- Finalizer:
  - Calls `av_packet_unref` (or frees custom buffer).
  - Runs when:
    - Chunk is `close()`-ed, or
    - JS GC frees the Chunk.

### 4.3 VideoFrame Backing

Use **lazy-copy** strategy:

- `VideoFrame` contains an `AVFrame*` (native).
- On creation:
  - no copy to JS memory; just store pointer + metadata.
- On `copyTo(view, options)`:
  - Convert `AVFrame` to requested `format` using libswscale if needed.
  - Copy into provided buffer(s).
- On `close()`:
  - Free `AVFrame` and mark the frame closed.

This matches browser semantics where `copyTo` can be expensive and is explicit.

### 4.4 GPU Memory

Initial strategy: **always download to CPU**.

- If using HW decode (NVDEC/VAAPI):
  - Use FFmpeg's `av_hwframe_transfer_data` to copy GPU frame → CPU frame.
  - Wrap CPU frame in `VideoFrame`.
- This avoids exposing GPU handles at first.
- Later enhancement: keep GPU frames for GPU → GPU pipelines (e.g., NVDEC → NVENC).

### 4.5 Reference Counting

If we ever share underlying data:

- Maintain a `refcount` on the backing resource (frame / audio buffer / packet).
- Each `VideoFrame` or `EncodedChunk` increments on creation, decrements on `close()`/GC.
- Only free once `refcount == 0`.

For v1, easiest is:

- No implicit sharing.
- Each frame/chunk has its own allocation.

### 4.6 GC Interactions

- Use N-API finalizers on:
  - Wrapped objects (`VideoDecoder`, `VideoEncoder`, `VideoFrame`, etc.).
  - External Buffers (encoded data).
- Finalizers must:
  - Free native memory if not already freed by `close()`.
  - Tear down TSFNs and join worker threads as needed.

### 4.7 Benchmarks

Plan benchmarks:

- Copy vs wrap for encoded data:
  - Size: 1MB, 10MB, 100MB.
- Frame copy cost:
  - 1080p and 4K YUV420 → RGBA in JS via `copyTo`.
- Memory leak checks:
  - Repeated decode of many frames; monitor process RSS for plateau.

---

## 5. API Surface Implementation

### 5.1 Classes to Implement

- `VideoDecoder`
- `VideoEncoder`
- `AudioDecoder`
- `AudioEncoder`
- `VideoFrame`
- `AudioData`
- `EncodedVideoChunk`
- `EncodedAudioChunk`
- `ImageDecoder` (lower priority, but part of full WebCodecs)

### 5.2 Core Behavior (VideoDecoder/VideoEncoder)

**VideoDecoder**

- Constructor / `configure(config)`
- `decode(chunk: EncodedVideoChunk)`
- `flush(): Promise<void>`
- `reset()`
- `close()`
- `state` property (`"unconfigured" | "configured" | "closed"`)
- `output(frame: VideoFrame)` callback
- `error(error: DOMException)` callback

**VideoEncoder**

- `configure(config)`
- `encode(frame: VideoFrame)` (with optional metadata)
- `flush(): Promise<void>`
- `reset()`
- `close()`
- `encodeQueueSize` property
- `output(chunk: EncodedVideoChunk)` callback
- `error(error: DOMException)` callback

### 5.3 Static `isConfigSupported()`

- Async static method returning `{ supported, config }`.
- Implementation:
  - Parse `codec`.
  - Check presence of:
    - Decoder or encoder in FFmpeg.
    - Required features (dimensions, hardwareAcceleration constraints).
  - Potentially "normalize" config (e.g., rounding dimensions to codec requirements).

### 5.4 Error Semantics

Match browser exceptions:

- `NotSupportedError`
  - Unsupported codec, unsupported combination of options.
- `InvalidStateError`
  - Methods called on a closed / unconfigured instance.
- `OperationError`
  - Internal decoding/encoding failure.

In Node:

- Either implement a simple DOMException polyfill or use typed `Error` objects with `.name` set appropriately.

### 5.5 Implementation Priorities

- **Phase 1**: `VideoDecoder`, `VideoEncoder`, `VideoFrame`, `EncodedVideoChunk`.
- **Phase 2**: Audio classes.
- **Phase 3**: `ImageDecoder` and any remaining spec details.

---

## 6. Codec Support Matrix (Linux)

### 6.1 Priority

**Must have (v1)**

- Video decode: H.264, VP8, VP9
- Video encode: at least one from {H.264, VP8, VP9}
- Audio decode: AAC, Opus
- Audio encode: Opus (AAC via FFmpeg internal encoder if acceptable)

**Should have**

- Video decode: HEVC, AV1
- Video encode: AV1 (software), HEVC if HW available

**Nice to have**

- Vorbis, MP3, legacy formats depending on cost/benefit.

### 6.2 Mapping to FFmpeg

**Video**

- H.264:
  - Decode: `h264` (native).
  - Encode:
    - GPL variant: `libx264`.
    - LGPL-ish variant: `libopenh264` or HW enc (NVENC/VAAPI).
- VP8:
  - Decode: `vp8` (native).
  - Encode: `libvpx-vp8`.
- VP9:
  - Decode: `vp9` (native).
  - Encode: `libvpx-vp9`.
- AV1:
  - Decode: `libdav1d` or `av1`.
  - Encode: `libaom-av1` or `libsvtav1`.
- HEVC:
  - Decode: `hevc`.
  - Encode:
    - HW: `hevc_nvenc`, `hevc_vaapi`.
    - GPL: `libx265`.

**Audio**

- AAC:
  - Decode: `aac` (native).
  - Encode: internal `aac` encoder or `libfdk_aac` (GPL-ish).
- Opus:
  - Decode/Encode: `libopus`.
- Vorbis:
  - Decode/Encode: vorbis libs or FFmpeg native.

### 6.3 Hardware Matrix (Linux)

High level summary (varies by GPU and drivers):

- **NVIDIA**:
  - H.264/H.265: encode+decode via NVENC/NVDEC.
  - VP9/AV1: decode on newer GPUs; AV1 encode on latest (e.g., RTX 40).
- **Intel (VA-API / QuickSync)**:
  - H.264/H.265: encode+decode.
  - VP9/AV1: decode (and in some generations, encode).
- **AMD (VA-API)**:
  - H.264/H.265: encode+decode.
  - VP9/AV1: decode/encode support on modern chips.

### 6.4 `isConfigSupported()` Behavior

- For each codec:
  - Check compiled-in support.
  - Check HW support if `hardwareAcceleration: "require-hardware"`.
  - Validate basic constraints (e.g., multiple-of-2 dimensions for H.264).
- Return:
  - `supported: true/false`
  - Possibly normalized `config` with adjustments documented.

---

## 7. Testing and Compatibility

### 7.1 Goals

- API correctness against the WebCodecs spec.
- Interop with browser WebCodecs.
- Stability under load.
- No leaks or UAFs.

### 7.2 Web Platform Tests (WPT)

- Import WebCodecs tests from WPT.
- Adapt them to run under Node:
  - Replace browser primitives where needed.
  - Load the Node addon as `WebCodecs` polyfill.
- Run in CI to catch regressions.

### 7.3 Browser Interop Tests

**Node encodes → Browser decodes**

- Node:
  - Use `VideoEncoder` to encode a synthetic pattern or frames from a file.
- Browser:
  - Use WebCodecs `VideoDecoder` to decode those chunks.
  - Compare frames (pixel-wise or via checksum).

**Browser encodes → Node decodes**

- Browser:
  - Use `VideoEncoder` or MediaRecorder-like pipeline with WebCodecs.
- Node:
  - Decode with `VideoDecoder`.
  - Compare decoded frames to expected frames.

### 7.4 Stress Tests

- High frame rate:
  - 1080p60 and 4K60 decode & encode loops.
- Long duration:
  - Decode/encode long videos to check leaks.
- Rapid state changes:
  - Repeated `configure` / `reset` / `close`.
- Multi-instance:
  - Many decoders/encoders running in parallel.

### 7.5 CI Integration

- Linux-only CI (initially), with:
  - Build step (addon + FFmpeg).
  - Unit tests:
    - codec string parser
    - `isConfigSupported`
    - minimal encode/decode
  - Integration tests:
    - WPT subset
    - Interop smoke tests (where feasible without full browsers).

---

## 8. Distribution Strategy

### 8.1 Goals

- `npm install <pkg>` "just works" on Linux.
- Avoid requiring FFmpeg system install.
- Keep room for advanced/custom builds.

### 8.2 Prebuild Strategy

Use prebuild tooling such as:

- `prebuildify` + `node-gyp-build` **or**
- `node-pre-gyp` with hosted binaries.

**Plan**

- Build per platform/arch:

  - `linux-x64`
  - `linux-arm64`

- Package `.node` binaries in the npm tarball (prebuildify) or upload to a release bucket (node-pre-gyp).

### 8.3 Node-API Version & Node Support

- Use Node-API version that supports:
  - `napi_create_threadsafe_function` (Node 10.6+).
- Target Node LTSes (e.g., 16, 18, 20).
- ABI-stable across Node versions thanks to Node-API.

### 8.4 FFmpeg Packaging

**Default**

- Statically link FFmpeg + codecs into the addon:
  - LGPL-compatible & BSD deps only for default build.

**Optional**

- Build-time flag for:
  - Using **system FFmpeg** (dynamic link).
  - Enabling GPL codecs (producing a GPL build).

### 8.5 CI/CD

- GitHub Actions or similar:
  - Matrix build for Linux x64 and arm64.
  - Upload prebuild artifacts on tagged releases.
- Release process:
  - Tag in git → CI builds binaries → publish to npm (with prebuilds included).

### 8.6 Installation Docs

Document for users:

- How to install: `npm install @org/webcodecs-node`.
- What's included:
  - Prebuilt FFmpeg-enabled addon for Linux.
- Optional:
  - How to build from source with custom FFmpeg (system or GPL).
  - How to enable hardware acceleration (NVIDIA / VA-API) and required driver/library setup.

---

## 9. Timeline Alignment (4-Week Challenge)

**Week 1 — Architecture + FFmpeg PoC**

- Finalize N-API object model.
- Implement minimal N-API addon with:
  - Dummy decoder using worker thread + TSFN.
  - One real FFmpeg-backed decode of a single frame (H.264).

**Week 2 — Threading + Memory**

- Implement per-instance worker threads for real decoders/encoders.
- Wire up external buffers for encoded data.
- Wrap AVFrame inside VideoFrame with lazy-copy semantics.

**Week 3 — Core API (Video)**

- Implement full `VideoDecoder`, `VideoEncoder`, `VideoFrame`, `EncodedVideoChunk`.
- Get an end-to-end demo:
  - Decode → transform (optional) → encode.

**Week 4 — Codecs + Tests + Packaging**

- Expand codec support (H.264, VP8, VP9, AAC, Opus; start AV1/HEVC where feasible).
- Run WPT subset + interop tests.
- Set up CI + prebuild distribution for Linux.

Once core Linux support is solid, extend to other platforms and refine distribution/licensing story as needed.

---

## Follow-up Tasks

For detailed implementation tasks extracted from this research, see:

- [Task: N-API PoC Addon](../tasks/napi-poc-addon.md)
- [Task: FFmpeg Static Build](../tasks/ffmpeg-static-build.md)
- [Task: Codec String Parser](../tasks/codec-string-parser.md)
- [Task: Threading & Worker Loop](../tasks/threading-worker-loop.md)
- [Task: VideoFrame Memory Management](../tasks/videoframe-memory.md)
- [Task: Hardware Acceleration Support](../tasks/hardware-acceleration.md)
- [Task: CI/CD Prebuild Pipeline](../tasks/cicd-prebuild.md)
- [Task: WPT Integration](../tasks/wpt-integration.md)

---

## Related Documents

- [WebCodecs Overview](./webcodecs-overview.md)
- [Implementation Options](./options.md)
- [Node.js Implementation Tasks](./nodejs-implementation.md)
- [Deno Implementation Tasks](./deno-implementation.md)
- [Bun Implementation Tasks](./bun-implementation.md)
