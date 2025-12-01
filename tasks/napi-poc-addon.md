---
title: N-API Proof of Concept Addon
status: todo
priority: critical
effort: large
category: architecture
dependencies: []
research: ../research/nodejs-linux-napi-ffmpeg.md
timeline: Week 1
---

# N-API Proof of Concept Addon

Build a minimal N-API addon that validates the core architecture patterns for WebCodecs bindings.

> ⚠️ **Alternative Path Available**: Consider using existing FFmpeg N-API bindings (node-av, @mmomtchev/ffmpeg) instead of building from scratch. See:
> - [FFmpeg N-API Bindings Research](../research/ffmpeg-napi.md)
> - [Evaluate FFmpeg N-API Bindings](./evaluate-ffmpeg-napi-bindings.md)
> - [VideoDecoder Shim on node-av](./videodecoder-shim-node-av.md)
>
> This task is still valuable if the existing bindings have gaps, or if you want full control over the native layer.

## Objective

Create a `DummyDecoder` N-API class that demonstrates:
- Object wrapping with `Napi::ObjectWrap`
- Worker thread management
- Thread-safe function (TSFN) callbacks to JS
- Basic lifecycle management (`configure`, `decode`, `flush`, `close`)

## Background

From [N-API Architecture Investigation](../research/nodejs-linux-napi-ffmpeg.md#1-n-api-architecture-investigation):

> Each WebCodecs class is a JS wrapper around a C++ class... Worker thread that sleeps 5ms pretending to decode and returns a fake `VideoFrame` object via TSFN.

This PoC validates the threading and callback patterns before integrating real FFmpeg codecs.

## Tasks

- [ ] Set up node-gyp / cmake-js build infrastructure
- [ ] Implement `DummyDecoder` C++ class with N-API bindings
- [ ] Create dedicated worker thread per instance
- [ ] Implement thread-safe input queue for work items
- [ ] Wire up TSFN for `output` callback delivery
- [ ] Wire up TSFN for `error` callback delivery
- [ ] Implement state machine: unconfigured → configured → closed
- [ ] Handle `close()` and GC finalizer cleanup
- [ ] Write basic tests exercising the async flow
- [ ] Benchmark N-API overhead vs direct calls

## Acceptance Criteria

1. `DummyDecoder` can be instantiated from JS
2. `configure()` transitions state to "configured"
3. `decode(chunk)` enqueues work, worker thread processes it
4. `output` callback fires on main thread with fake frame
5. `close()` stops worker thread and cleans up
6. No memory leaks after repeated decode/close cycles
7. No event loop blocking during decode operations

## Technical Notes

### Key N-API Functions

```cpp
// Object wrapping
napi_wrap(env, js_object, native_object, destructor, nullptr, nullptr);

// Thread-safe function
napi_create_threadsafe_function(env, js_callback, async_resource, name, 
                                  max_queue_size, thread_count, finalize_data,
                                  finalize_cb, context, call_js_cb, &tsfn);

// External buffer (for future use)
napi_create_external_buffer(env, length, data, finalize_cb, hint, &result);
```

### Worker Thread Pattern

```cpp
void WorkerLoop() {
  while (running) {
    Command cmd = queue.pop();  // blocks
    switch (cmd.type) {
      case DECODE:
        std::this_thread::sleep_for(5ms);  // simulate work
        napi_call_threadsafe_function(outputTSFN, data, napi_tsfn_nonblocking);
        break;
      case CLOSE:
        running = false;
        break;
    }
  }
}
```

## Dependencies

- Node.js 16+ (for N-API version compatibility)
- node-addon-api (C++ wrapper for N-API)
- node-gyp or cmake-js for building

## Deliverables

- [ ] Working `DummyDecoder` addon
- [ ] Build configuration (binding.gyp or CMakeLists.txt)
- [ ] Test file demonstrating usage
- [ ] Performance baseline measurements

## Related

- [Threading & Worker Loop](./threading-worker-loop.md) — Detailed threading design
- [Node.js Linux N-API + FFmpeg Research](../research/nodejs-linux-napi-ffmpeg.md)
