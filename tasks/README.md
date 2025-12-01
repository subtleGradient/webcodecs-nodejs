# Implementation Tasks

This directory contains individual implementation tasks extracted from research documents. Each task file includes YAML frontmatter with metadata for tracking and prioritization.

## Task Format

Each task file follows this structure:

```yaml
---
title: Task Title
status: todo | in-progress | done | blocked
priority: critical | high | medium | low
effort: small | medium | large | x-large
category: architecture | implementation | testing | infrastructure
dependencies: []
research: ../research/relevant-doc.md
---
```

## Current Tasks

### Week 1: Architecture + FFmpeg PoC

| Task | Priority | Effort | Status |
|------|----------|--------|--------|
| [Evaluate FFmpeg N-API Bindings](./evaluate-ffmpeg-napi-bindings.md) | critical | medium | todo |
| [VideoDecoder Shim on node-av](./videodecoder-shim-node-av.md) | critical | medium | todo |
| [N-API PoC Addon](./napi-poc-addon.md) | critical | large | todo |
| [FFmpeg Static Build](./ffmpeg-static-build.md) | critical | medium | todo |
| [Codec String Parser](./codec-string-parser.md) | high | small | todo |

> **Note**: The first two tasks (Evaluate FFmpeg N-API Bindings and VideoDecoder Shim) represent an alternative faster path using existing N-API bindings. See [FFmpeg N-API Bindings Research](../research/ffmpeg-napi.md) for details.

### Week 2: Threading + Memory

| Task | Priority | Effort | Status |
|------|----------|--------|--------|
| [Threading & Worker Loop](./threading-worker-loop.md) | critical | large | todo |
| [VideoFrame Memory Management](./videoframe-memory.md) | critical | large | todo |

### Week 3-4: Features + Polish

| Task | Priority | Effort | Status |
|------|----------|--------|--------|
| [Hardware Acceleration Support](./hardware-acceleration.md) | medium | large | todo |
| [CI/CD Prebuild Pipeline](./cicd-prebuild.md) | high | medium | todo |
| [WPT Integration](./wpt-integration.md) | high | medium | todo |

## Related Research

- [FFmpeg N-API Bindings Research](../research/ffmpeg-napi.md) — **NEW**: Existing N-API bindings that can accelerate development
- [Node.js Linux N-API + FFmpeg Research](../research/nodejs-linux-napi-ffmpeg.md) — Primary research document (from-scratch approach)
- [Node.js Implementation Overview](../research/nodejs-implementation.md) — Higher-level task breakdown
- [Implementation Options](../research/options.md) — Comparison of implementation approaches
