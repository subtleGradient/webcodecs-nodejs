# Getting WebCodecs Working in Node.js, Deno, and Bun

WebCodecs is a **Web API for low-level media encoding/decoding** that gives developers direct access to audio and video codecs. It exposes primitives like `VideoDecoder`, `VideoEncoder`, `AudioDecoder`, `AudioEncoder`, `VideoFrame`, and `EncodedVideoChunk`, letting you process frames and samples without the overhead of spawning external tools or going through WebAssembly-heavy codecs.

All major browsers have (or are gaining) WebCodecs support (Chrome/Edge, Firefox, Safari). Server-side runtimes like **Node.js**, **Deno**, and **Bun**, however, do **not** yet ship WebCodecs, and adding it is a non-trivial project.

This document explores what it would take to implement WebCodecs in these runtimes:

- Runtime-level constraints
- Codec backend choices (FFmpeg, OS APIs, etc.)
- Architecture requirements (threads, memory, API surface)
- Feasibility and current efforts (e.g. the WebCodecs Node.js $10k challenge)
- Likely paths for Node.js, Deno, and Bun

---

## 1. WebCodecs in Browsers vs. Server Runtimes

### 1.1 How browsers implement WebCodecs

In browsers:

- WebCodecs is essentially a **JS API layer over native codec implementations**.
- The spec explicitly **does not require any particular codec**; it just defines interfaces and processing models. Each UA chooses which codecs to expose.
- Under the hood, browsers typically rely on:
  - OS media frameworks (e.g. VideoToolbox on macOS, MediaFoundation on Windows)
  - Or bundled codec libs (e.g. libvpx, libaom, etc.)
  - Often with **hardware acceleration** where available.

Key points:

- WebCodecs is designed for **high throughput**: queues, async callbacks, and codec work done off the main thread.
- APIs like `VideoDecoder`, `VideoEncoder` are thin control surfaces around a substantial C/C++ media stack.
- WebCodecs **does not handle containers** (MP4, WebM, etc.) – only the **compressed elementary streams**. Demux/mux is out of scope and must be handled separately.

### 1.2 Why this is hard to replicate in Node/Deno/Bun

Server runtimes:

- Have **no built-in codec stack**.
- Historically rely on:
  - Calling FFmpeg CLI / libavcodec
  - Using external tools or native addons for media
- Do not have a "browser media pipeline" to piggyback on.

To implement WebCodecs in Node/Deno/Bun, you essentially have to **recreate (or reuse) a significant chunk of a browser's media subsystem** and then expose a spec-compliant JS API.

---

## 2. Core Challenges of Implementing WebCodecs in JS Runtimes

### 2.1 Codec backends

You need codecs for at least:

- **Video**: H.264/AVC, H.265/HEVC, VP8, VP9, AV1 (realistically at least H.264 + one royalty-free option).
- **Audio**: Opus, AAC, maybe Vorbis, etc.
- **Images** (`ImageDecoder`): JPEG, PNG, GIF, WebP, AVIF, etc.

Options:

1. **FFmpeg (libavcodec + libavformat)**  
   - Pros:
     - Huge codec coverage in one place.
     - Mature, cross-platform, highly optimized.
   - Cons:
     - Binary size and complexity.
     - Licensing (GPL/LGPL); patent issues for H.264/HEVC/AAC depending on how it's built and shipped.
     - You still need to map FFmpeg's API into WebCodecs' streaming model.

2. **OS media frameworks (per OS)**  
   - Windows: Media Foundation
   - macOS: AVFoundation / VideoToolbox
   - Linux: VA-API, GStreamer, V4L2 stacks, etc.
   - Pros:
     - Let the OS handle codec licensing and hardware acceleration.
   - Cons:
     - You must write and maintain a different backend per OS.
     - API surface is inconsistent across platforms.
     - Some Linux environments won't have the right codecs installed.

3. **Hybrid approach**  
   - Open codecs via bundled libs (VP8/9/AV1/Opus).
   - Patented codecs via OS APIs when available.
   - Good compromise but doubles complexity.

In all cases you must:

- Map WebCodecs codec strings (e.g. `"avc1.42E01E"`, `"vp09.00.10.08"`) to specific backend configurations.
- Implement `isConfigSupported()` realistically.
- Decide if your implementation exposes only a subset of codecs.

### 2.2 Threading and async model

WebCodecs' design:

- JS calls like `decode()` and `encode()` are **asynchronous enqueues**.
- The actual heavy work runs on internal **codec threads**.
- Output is delivered via callbacks / events.

A runtime implementation must:

- Create and manage codec worker threads (Node libuv threads, Rust threads in Deno, etc.).
- Ensure **non-blocking** behavior for JS:
  - No busy loops.
  - All heavy work off the main thread.
- Handle cancellation (`reset()`, `close()`, `flush()` semantics).
- Keep ordering guarantees and error propagation consistent with the spec.

### 2.3 Memory management and data transfer

Video frames are large:

- A single raw 4K frame (8-bit RGBA) is ≈ 32 MB.
- Streams can produce many frames per second.

You need:

- Efficient representation of frame data (`VideoFrame`, `AudioData`):
  - Shared memory buffers or native handles.
  - Minimizing copies between JS and native layers.
- Clean lifetime management:
  - JS must be able to explicitly `close()`/`destroy()` frames.
  - The GC must not leak native resources.
- Possibly, GPU memory management for hardware acceleration (complex).

### 2.4 Hardware acceleration

To really compete with browser WebCodecs:

- Hardware acceleration is highly desirable (especially for server workloads).
- Means integrating with:
  - NVENC/NVDEC on Nvidia
  - VideoToolbox on macOS
  - VA-API / other drivers on Linux
- Or letting OS media frameworks abstract that.

This is a big chunk of engineering just by itself.

### 2.5 Containers (demuxing/muxing)

WebCodecs **intentionally** avoids container concerns:

- It operates on `EncodedVideoChunk` / `EncodedAudioChunk`, which are **elementary stream packets**.
- If you have an MP4 or WebM:
  - You must demux it to codec frames yourself.
  - On the other side, you must remux codec output to a container.

In a Node/Deno/Bun context:

- You likely want a companion:
  - FFmpeg (as CLI or library), or
  - MP4Box.js / webm-tools, etc.
- WebCodecs itself will not help you with file I/O or container logic.

So a "WebCodecs runtime" is:

- Only the codec interface.
- You still need demux/mux solutions bundled or as separate modules.

---

## 3. Runtime-Specific Considerations

### 3.1 Node.js

**What Node has:**

- C++ core and libuv, good at native addons.
- A culture of using FFmpeg, GStreamer, etc. from JS.
- Experience exposing web-like APIs (e.g. `crypto.webcrypto`).

**What Node lacks:**

- Any built-in media codec stack.
- Any part of Chromium's media pipeline.

**Likely implementation path:**

1. **Node core or native addon**
   - Implement the WebCodecs classes in C++:
     - `VideoDecoder`, `VideoEncoder`, `AudioDecoder`, `AudioEncoder`, `VideoFrame`, `EncodedVideoChunk`, `ImageDecoder`, etc.
   - Bind them via N-API or as new core modules.

2. **Use FFmpeg or OS media APIs**
   - FFmpeg approach:
     - Link against libavcodec (+ optionally libavformat).
     - Implement decode/enocde loops matching WebCodecs semantics.
   - OS APIs approach:
     - Use VideoToolbox / MediaFoundation / etc. for H.264/HEVC/VP9 etc.
     - Add open codecs as needed.

3. **Threading via libuv**
   - Each `VideoDecoder` / `VideoEncoder` gets its own worker threads.
   - JS calls enqueue tasks, which libuv dispatches to threads.
   - Worker threads push results back via async callbacks.

4. **Testing + interop**
   - Run Web Platform Tests for WebCodecs against Node.
   - Ensure interop with browser WebCodecs (e.g. Node-encoded video decodable in Chrome).

**Community signal: the $10k WebCodecs Node.js challenge**

- Vjeux's `webcodecs-nodejs-10k-challenge` repo offers a **$10k bounty** to implement WebCodecs in Node.js by a given deadline.
- This implies:
  - Demand is real.
  - It's hard enough that a bounty is considered necessary.
- A winning solution is almost certainly:
  - A Node fork or addon.
  - Using FFmpeg and/or platform codecs.
  - With a good chunk of spec coverage.

**Reality check:**

- This is roughly on the order of **node-webrtc** level difficulty:
  - node-webrtc had to embed Google's libwebrtc.
  - A WebCodecs addon might need to embed FFmpeg or parts of Chromium's media pipeline.
- Node core might be hesitant to own this; a third-party addon is more realistic initially.

---

### 3.2 Deno

**Deno's philosophy:**

- Strong preference for **web-standard APIs**.
- Rust core with a careful permission model.

**WebCodecs interest:**

- There is explicit discussion about adding WebCodecs support.
- Motivations:
  - Unified web-style media APIs across browser and server.
  - Avoiding external native deps (FFmpeg CLI) for simple transforms.
  - Leveraging the API for video/image processing and even WebGPU pipelines.

**Likely approach:**

1. **Rust bindings to codec libs**
   - Use Rust crates or raw FFI to:
     - FFmpeg (libavcodec) for broad codec support, or
     - System media APIs.
   - Wrap these in Rust structs that implement WebCodecs behavior.

2. **Expose via Deno's JS bindings**
   - Create JS classes mirroring browser WebCodecs.
   - Use serialized work queues + Rust async tasks for encode/decode.

3. **Gradual support**
   - Realistic first step:
     - Implement `ImageDecoder` (JPEG/PNG/AVIF/GIF).
     - Implement video decode only (no encoder).
   - Then expand coverage over time.

**Challenges:**

- Deno avoids heavy static dependencies where possible; bundling FFmpeg is a sizable decision.
- Patent/licensing issues (same as Node).
- Deno's roadmap has focused more on Node compatibility and performance, so WebCodecs is competing with other priorities.

---

### 3.3 Bun

**Bun's engine: JavaScriptCore (WebKit)**

- Bun uses JavaScriptCore and a bunch of WebKit-derived implementations.
- Safari / WebKit have been gradually implementing WebCodecs.
  - At various points: `VideoDecoder` / `VideoEncoder` first, then more pieces.

**Bun's potential advantage:**

- If Bun updates to a WebKit version that has WebCodecs:
  - The underlying engine already knows about many WebCodecs classes.
  - Bun "only" needs to:
    - Wire those classes into the global scope for its runtime context.
    - Ensure the media backend (frameworks) is present and initialized.

**Complications:**

- WebKit's WebCodecs implementation is designed for a **browser**:
  - Assumes certain media subsystems are available.
  - Uses platform APIs heavily.
- Bun runs outside a browser shell:
  - On macOS, it might naturally hook into AVFoundation.
  - On Linux, it may need extra glue (GStreamer/FFmpeg or similar).
- Packaging:
  - Bun's binaries on non-Apple platforms would have to ship the right libs or check system availability.

**Realistic path:**

1. Track WebKit's WebCodecs status.
2. Once stable, enable the feature in Bun's JavaScriptCore build.
3. Wrap and surface those APIs in Bun's runtime the same way `fetch` and `WebSocket` are exposed.
4. Add shims or separate backends for Linux/Windows where WebKit's default environment may be missing.

**Summary:**

- Bun is probably the **closest** to "flipping a switch" for WebCodecs among non-browser runtimes, thanks to WebKit.
- But it still has to solve native media backends and distribution for non-Apple platforms.

---

## 4. Practical Implementation Steps

If you wanted to actually build WebCodecs support for Node/Deno/Bun, the work roughly looks like this:

### Step 1 – Choose codec strategy

Decide:

- **FFmpeg-centric**:
  - One codebase across all platforms.
  - Great for coverage; heavy for dist.
- **OS-API-centric**:
  - Lighter packaging.
  - Depends on OS having codecs installed.
  - Needs per-OS backends.

You might start with:

- VP8/VP9/AV1/Opus via bundled libs (royalty-free), and
- Optionally, H.264 via OS APIs where available.

### Step 2 – Design the internal architecture

- For each decoder/encoder instance:
  - Have a dedicated worker thread or job queue.
  - Maintain:
    - Input queue of chunks/frames.
    - Output queue of decoded frames/encoded packets.
    - State machine matching WebCodecs spec (config, draining, reset, closed, etc.).
- Implement time stamps, keyframe flags, and other metadata.

### Step 3 – Implement the JS API surface

Implement the following classes with browser-compatible signatures:

- `VideoDecoder`, `AudioDecoder`
- `VideoEncoder`, `AudioEncoder`
- `EncodedVideoChunk`, `EncodedAudioChunk`
- `VideoFrame`, `AudioData`
- `ImageDecoder`

And their methods:

- `configure()`, `decode()`, `encode()`, `flush()`, `reset()`, `close()`
- `isConfigSupported()`, etc.

Ensure:

- Same error semantics.
- Same async behavior (Promises, callbacks, events).

### Step 4 – Integrate with the runtime event loop

For Node:

- Use libuv async handles to notify JS code when frames are ready.
- Make sure that you never block the event loop.

For Deno:

- Use Rust async tasks and Deno's op layer.
- Map codec events to JS promises/callbacks.

For Bun:

- Use the same mechanisms it uses for `fetch`/sockets; integrate with JavaScriptCore's scheduling.

### Step 5 – Testing and compatibility

- Wire up **Web Platform Tests (WPT)** for WebCodecs to your runtime.
- Add round-trip tests:
  - Browser encodes → runtime decodes.
  - Runtime encodes → browser decodes.
- Add stress tests for:
  - Large resolutions.
  - High frame rate.
  - Abrupt resets / errors.

### Step 6 – Demux/mux integration

WebCodecs alone isn't enough for typical workflows (MP4 in, MP4 out). Options:

- Provide helper libs:
  - A Node/Deno/Bun module that uses FFmpeg or MP4Box.js to demux/mux.
- Keep this layer **logically separate** from WebCodecs:
  - WebCodecs deals strictly with codec frames.
  - Demux/mux deals with containers and I/O.

---

## 5. Current Status and Ecosystem Efforts

### 5.1 Browser side: WebCodecs is mature enough

- Chromium / Blink: WebCodecs has been available for multiple stable versions.
- Firefox: Implemented WebCodecs (gated behind preferences for a while, now shipping).
- Safari / WebKit: Gradual roll-out, initially only some parts, expanding over time.

Result: The API is **real and battle-tested** in browsers, and tooling like:

- WebCodecs demos for video processing, transcoding, streaming.
- Web apps using WebCodecs in workers for performance.

### 5.2 Server side: still early

Facts on the ground:

- No official WebCodecs implementation shipped in Node, Deno, or Bun yet.
- Projects like **Remotion** investigated using WebCodecs in Node but concluded that:
  - Chromium's WebCodecs implementation is tightly coupled to the Chromium codebase.
  - Extracting it cleanly isn't appealing.
  - Using FFmpeg directly from Node remains simpler and more flexible for now.

### 5.3 Vjeux's WebCodecs Node.js $10k challenge

Key signals from the challenge:

- The goal:
  - Implement WebCodecs in Node.js (API compatible with the spec).
  - Run real workloads.
- Prize:
  - $10k, indicating non-trivial effort.
- Implication:
  - There's practical interest in **reusing web media code on the server**.
  - A credible solution would likely become the de facto "Node WebCodecs" library.

So far (as of this writing) there is no widely-adopted, fully-spec-compliant Node WebCodecs implementation, but the challenge is likely to kickstart one.

### 5.4 Bun and Deno outlook

- **Bun**:
  - Strong candidate because it can reuse WebKit's work.
  - Main work: enabling and wiring WebCodecs, plus ensuring backends on all platforms.
- **Deno**:
  - Philosophically aligned with adding web APIs.
  - Implementation is more work (Rust + codec bindings), but also clean architecturally.
  - Could ship as a built-in feature or as an official extension.

---

## 6. Overall Feasibility and Tradeoffs

### 6.1 Is it feasible?

Yes, but:

- It is closer to a **"multi-person, multi-month"** effort than a weekend hack.
- The complexity is similar to:
  - Binding a full WebRTC stack, or
  - Embedding FFmpeg deeply and wrapping it with a non-trivial async API.

### 6.2 Why bother vs "just use FFmpeg"?

Reasons to bother:

- **Unified API** across browser and server:
  - Write once, run in browser workers and server runtimes.
- Possible **hardware acceleration** on the server.
- Better integration with other web APIs (e.g. WebGPU pipelines, WebRTC data, etc.).

Reasons not to bother:

- FFmpeg already exists and is extremely powerful.
- Many server-side video workflows are already stable around FFmpeg CLI or native libs.
- WebCodecs doesn't solve containers, only codec frames, so you still need other tooling.

### 6.3 Likely future

- Short-term:
  - Node/Deno/Bun developers continue using FFmpeg / native libs.
  - Experimentation with WebCodecs bindings (e.g. attempts to win the $10k challenge).
- Medium-term:
  - At least one runtime (Bun is a likely candidate) exposes WebCodecs in some form.
  - A Node addon appears that implements a **usable subset** of WebCodecs on top of FFmpeg.
- Long-term:
  - If these experiments succeed, WebCodecs becomes a **cross-environment media API**, not just a browser feature.

---

## 7. References & Further Reading

- **Spec & Explainer**
  - WebCodecs Explainer (W3C):  
    https://raw.githubusercontent.com/w3c/webcodecs/refs/heads/main/explainer.md
  - WebCodecs Specification (W3C):  
    https://w3c.github.io/webcodecs/
- **API Docs & Samples**
  - MDN WebCodecs API Overview:  
    https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API
  - WebCodecs Samples:  
    https://w3c.github.io/webcodecs/samples/
- **Browser Support**
  - Chrome Platform Status – WebCodecs:  
    https://www.chromestatus.com/feature/5669293909868544
  - Firefox Bugzilla Meta-Bug for WebCodecs:  
    https://bugzilla.mozilla.org/show_bug.cgi?id=WebCodecs
- **Node.js Challenge**
  - WebCodecs Node.js $10k Challenge (Vjeux):  
    https://raw.githubusercontent.com/vjeux/webcodecs-nodejs-10k-challenge/refs/heads/main/README.md
