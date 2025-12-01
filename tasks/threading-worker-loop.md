---
title: Threading & Worker Loop Implementation
status: todo
priority: critical
effort: large
category: implementation
dependencies:
  - napi-poc-addon.md
research: ../research/nodejs-linux-napi-ffmpeg.md
timeline: Week 2
---

# Threading & Worker Loop Implementation

Implement the production threading model for codec instances with proper queue management and lifecycle handling.

## Objective

Build the threading infrastructure that allows each codec instance to process encode/decode operations without blocking the Node.js event loop, with proper handling of reset, close, and error conditions.

## Background

From [Threading Model Design](../research/nodejs-linux-napi-ffmpeg.md#3-threading-model-design):

> Each `VideoDecoder` / `VideoEncoder` owns:
> - A dedicated worker thread
> - A thread-safe input queue
> - One or more thread-safe functions (TSFNs) for JS callbacks

## Tasks

- [ ] Design command queue data structure
- [ ] Implement thread-safe queue with condition variables
- [ ] Define command protocol (DECODE, ENCODE, FLUSH, RESET, CLOSE)
- [ ] Implement worker thread main loop
- [ ] Handle FLUSH with promise resolution
- [ ] Handle RESET with proper codec buffer flush
- [ ] Handle CLOSE with clean shutdown
- [ ] Implement error propagation via errorTSFN
- [ ] Add backpressure mechanism for output queue
- [ ] Handle edge cases (reset during decode, close during flush)
- [ ] Add metrics (queue sizes, processing times)
- [ ] Write stress tests for threading behavior

## Command Protocol

```cpp
enum class CommandType {
  DECODE,   // Process an EncodedVideoChunk
  ENCODE,   // Process a VideoFrame  
  FLUSH,    // Drain pending frames, resolve promise
  RESET,    // Clear buffers, drop pending work
  CLOSE     // Shutdown thread, cleanup
};

struct Command {
  CommandType type;
  void* data;           // Packet or frame data
  size_t dataSize;
  int64_t timestamp;
  bool isKeyFrame;      // For decode
  napi_deferred deferred; // For flush promise
};
```

## Worker Loop Implementation

```cpp
void WorkerThread::Run() {
  while (running_) {
    Command cmd = queue_.Pop();  // Blocking wait
    
    switch (cmd.type) {
      case CommandType::DECODE:
        ProcessDecode(cmd);
        break;
        
      case CommandType::ENCODE:
        ProcessEncode(cmd);
        break;
        
      case CommandType::FLUSH:
        DrainCodec();
        ResolveFlushPromise(cmd.deferred);
        break;
        
      case CommandType::RESET:
        FlushCodecBuffers();
        DropPendingWork();
        break;
        
      case CommandType::CLOSE:
        DrainCodec();  // Optional: drain before close
        running_ = false;
        break;
    }
  }
  
  CleanupResources();
}
```

## Edge Cases to Handle

### Reset During In-Flight Operations

```cpp
case CommandType::RESET:
  // 1. Flush codec internal buffers
  avcodec_flush_buffers(codec_ctx_);
  
  // 2. Drop any pending commands in queue
  queue_.Clear();
  
  // 3. Reset internal state
  state_ = State::Configured;
  
  // 4. Do NOT emit any more outputs from before reset
  output_sequence_++;  // Invalidate old outputs
  break;
```

### Close During Active Decoding

```cpp
case CommandType::CLOSE:
  // Signal other threads to not queue more work
  accepting_work_ = false;
  
  // Optionally drain remaining frames
  if (drain_on_close_) {
    DrainCodec();
  }
  
  // Shutdown
  running_ = false;
  break;
```

### Error Handling

```cpp
void ProcessDecode(Command& cmd) {
  int ret = avcodec_send_packet(ctx_, packet);
  if (ret < 0 && ret != AVERROR(EAGAIN)) {
    // Emit error to JS via errorTSFN
    EmitError("Decode failed", ret);
    return;
  }
  
  // Drain frames...
}
```

## Backpressure Design

Options for handling saturated output queues:

1. **Block input** — Queue has max size, `decode()` blocks until space
2. **Drop frames** — Only for specific use cases (live streaming)
3. **Expose queue size** — Let JS handle backpressure

Recommended: Expose `decodeQueueSize` property (similar to `encodeQueueSize` in spec).

## Acceptance Criteria

1. Worker thread starts on `configure()` and stops on `close()`
2. Commands are processed in order
3. `flush()` returns a Promise that resolves after all pending outputs
4. `reset()` drops pending work and clears codec buffers
5. `close()` performs clean shutdown without leaks
6. Errors from codec are delivered via `error` callback
7. No race conditions under concurrent operations
8. Queue size metrics are exposed

## Stress Tests

- [ ] Rapid `configure` / `reset` / `close` cycles
- [ ] High-throughput decode (1000+ chunks/second)
- [ ] Multiple concurrent codec instances
- [ ] `reset()` while decode is in progress
- [ ] `close()` while flush is in progress
- [ ] Memory pressure scenarios

## Deliverables

- [ ] `src/native/worker_thread.cc` — Worker thread implementation
- [ ] `src/native/command_queue.cc` — Thread-safe queue
- [ ] `tests/threading.test.ts` — Threading behavior tests
- [ ] Stress test suite

## Related

- [N-API PoC Addon](./napi-poc-addon.md) — Foundation for this work
- [VideoFrame Memory Management](./videoframe-memory.md) — Frame lifecycle
- [Node.js Linux N-API + FFmpeg Research](../research/nodejs-linux-napi-ffmpeg.md#3-threading-model-design)
