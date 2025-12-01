# Existing FFmpeg N-API Bindings Research

> **Parent document**: [Node.js Implementation Tasks](./nodejs-implementation.md)  
> **Related**: [Node.js Linux N-API + FFmpeg Research](./nodejs-linux-napi-ffmpeg.md) | [Implementation Options](./options.md)

## Summary

| Aspect | Finding |
|--------|---------|
| **Outcome** | Yes, there are existing N-API FFmpeg bindings you can stand on. |
| **Obstacles** | None of them are WebCodecs-shaped; you still need an adapter layer. |
| **Plan** | Reuse an FFmpeg N-API library as the "engine" and build WebCodecs on top. |

---

## Key Finding

There are already serious FFmpeg bindings built on Node-API, so you don't have to start from raw C FFmpeg + N-API. This avoids the largest yak: raw FFmpeg + Node-API integration.

---

## 1. Strong Candidates

### node-av (SeydX)

- **Repository**: [seydx/node-av](https://github.com/seydx/node-av)
- Native FFmpeg v8 bindings for Node.js.
- Uses a compiled addon (Node-API) with:
  - **Low-level API**: `FormatContext`, `CodecContext`, `Frame`, `Packet`, etc., very close to libav* C API.
  - **High-level API**: `Demuxer`, `Decoder`, `Encoder`, `Muxer`, plus a "pipeline" API that already models decode/encode chains.
- Supports hardware acceleration (CUDA, VAAPI, auto-detect) and exposes `HardwareContext`.
- Ships prebuilt binaries for all major platforms; on Linux you can just `npm install node-av`.
- Fully typed for TypeScript, modern async/await patterns.

**This is probably the best "drop-in engine" for a Linux-only WebCodecs implementation right now.**

---

### @mmomtchev/ffmpeg / node-ffmpeg (avcpp + nobind17)

- **Repository**: [mmomtchev/ffmpeg](https://github.com/mmomtchev/ffmpeg) (library name often referred to as node-ffmpeg).
- Wraps avcpp (a C++ wrapper around FFmpeg's C API) and exposes it to Node via nobind17, which itself sits on Node-API / node-addon-api.
- Provides:
  - A fairly complete mapping of FFmpeg (demuxers, decoders, encoders, filters).
  - A Node.js Streams API: `Demuxer`, `AudioDecoder`, `VideoDecoder`, `Filter`, `VideoTransform`, `AudioTransform`, `VideoEncoder`, `AudioEncoder`, `Muxer`, etc.
- Designed to allow safe-ish async use and multi-threading, with some explicit caveats around misconfigured streams.

**Good fit if you like the streams model and don't mind the extra avcpp layer.**

---

### libav (Astronaut Labs)

- **Package**: `libav` / **Repository**: [astronautlabs/libav](https://github.com/AstronautLabs/libav)
- Node.js bindings to FFmpeg's libav* libraries, adapted to be "comfortable and efficient" in TypeScript.
- Uses Node-API as well, but:
  - Marked **"Pre-Alpha Quality; incomplete, broken, heavy development"**.
  - Requires system FFmpeg 5.x and dev headers installed on Linux.

**Probably better as inspiration/reference than a solid base for a WebCodecs project right now.**

---

### ff-helper (napi-rs-based helper)

- **Package**: `ff-helper`
- A napi-rs binding wrapping a few FFmpeg features, like getting video info and generating screenshots.
- Explicitly **not** a full FFmpeg binding; just a helper.

**Useful as a tiny example of napi-rs + FFmpeg, but not enough for WebCodecs.**

---

## 2. How This Helps the WebCodecs Plan (Linux-only)

You can absolutely avoid writing raw C++/Node-API around FFmpeg from scratch:

1. **Pick one of the full bindings as your "FFmpegService"**:
   - If you want modern TS + pipelines + prebuilt binaries → **node-av**.
   - If you want streams + avcpp and don't mind extra C++ layer → **node-ffmpeg**.

2. **Implement WebCodecs classes** (`VideoDecoder`, `VideoEncoder`, `VideoFrame`, etc.) **in TypeScript**, and internally:
   - Use node-av's `Decoder` / `Encoder` or node-ffmpeg's `VideoDecoder` / `VideoEncoder` to do the actual work.
   - Map WebCodecs `configure()` → underlying codec/stream setup.
   - Map `decode()`/`encode()` → feed frames/packets into the N-API binding.
   - Use their existing thread/memory/resource management instead of building your own.

### What You'd Still Need to Build

You'd still need to:
- Reproduce **WebCodecs semantics** (state machine, reset, close, `isConfigSupported`, error types).
- Possibly wrap/normalize timestamps, formats, and pixel layouts to match spec.

…but you **avoid the largest yak: raw FFmpeg + Node-API integration**.

---

## 3. Concrete Recommendation

For a Linux-first WebCodecs-in-Node prototype:

1. **Start with node-av as the backend**:
   - Use its high-level `Decoder`/`Encoder` for quick progress; drop to low-level `CodecContext`/`Frame` when you need more control.

2. **Wrap it in TS classes that exactly match the WebCodecs IDL**.

3. **Only reach for your own N-API code** if you discover a semantic gap you cannot bridge cleanly via node-av.

---

## 4. Next Steps

See extracted tasks for actionable follow-ups:

- [Evaluate FFmpeg N-API Bindings](../tasks/evaluate-ffmpeg-napi-bindings.md) — Compare node-av vs node-ffmpeg for WebCodecs use
- [VideoDecoder Shim on node-av](../tasks/videodecoder-shim-node-av.md) — Sketch a VideoDecoder shim that sits on top of node-av.Decoder

---

## 5. Library Comparison Matrix

| Library | API Style | Prebuilt Binaries | HW Accel | TypeScript | Maturity | Best For |
|---------|-----------|-------------------|----------|------------|----------|----------|
| **node-av** | High + Low level | ✅ All platforms | ✅ CUDA/VAAPI | ✅ Full | Production | Quick WebCodecs prototype |
| **@mmomtchev/ffmpeg** | Streams | ✅ | ⚠️ Limited | ✅ | Stable | Stream-based pipelines |
| **libav (Astronaut)** | Low-level | ❌ | ❌ | ✅ | Pre-alpha | Reference/learning |
| **ff-helper** | Utilities | ✅ | ❌ | ✅ | Minimal | Quick video info |

---

## Related Documents

- [Node.js Linux N-API + FFmpeg Research](./nodejs-linux-napi-ffmpeg.md) — Original from-scratch N-API design
- [Node.js Implementation Tasks](./nodejs-implementation.md) — Higher-level task breakdown
- [Implementation Options](./options.md) — Comparison of implementation approaches
