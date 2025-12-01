---
title: FFmpeg Static Build for Linux
status: todo
priority: critical
effort: medium
category: infrastructure
dependencies: []
research: ../research/nodejs-linux-napi-ffmpeg.md
timeline: Week 1
---

# FFmpeg Static Build for Linux

Create a reproducible static FFmpeg build configured for WebCodecs use on Linux.

## Objective

Build FFmpeg with the required codecs statically linked, suitable for bundling into the Node.js addon. Focus on LGPL-compatible components initially.

## Background

From [FFmpeg Integration Strategy](../research/nodejs-linux-napi-ffmpeg.md#2-ffmpeg-integration-strategy-linux):

> **Hybrid** — Default: statically link FFmpeg with only **LGPL-compatible components** and BSD libs (libvpx, libopus, libdav1d, libaom, SVT-AV1, OpenH264).

## Tasks

- [ ] Create build script for FFmpeg with required configuration
- [ ] Configure LGPL-only build (no GPL codecs by default)
- [ ] Include required codec libraries:
  - [ ] libvpx (VP8/VP9)
  - [ ] libopus (Opus audio)
  - [ ] libdav1d (AV1 decode)
  - [ ] libaom (AV1 encode)
  - [ ] libopenh264 (H.264 encode, LGPL-compatible)
- [ ] Build for linux-x64 and linux-arm64
- [ ] Create Docker-based build environment for reproducibility
- [ ] Document build flags and configure options
- [ ] Test resulting libraries link correctly with N-API addon
- [ ] Measure binary size

## Build Configuration

### Build Variants

The build script should support multiple configurations via environment variables:

```bash
# Default: LGPL-only build
./scripts/build-ffmpeg.sh

# GPL build with x264/x265
BUILD_VARIANT=gpl ./scripts/build-ffmpeg.sh

# System FFmpeg (dynamic linking)
BUILD_VARIANT=system ./scripts/build-ffmpeg.sh
```

### Core FFmpeg Options (LGPL Default)

```bash
./configure \
  --prefix=/opt/ffmpeg-static \
  --enable-static \
  --disable-shared \
  --disable-programs \
  --disable-doc \
  --disable-network \
  --enable-pic \
  --enable-libvpx \
  --enable-libopus \
  --enable-libdav1d \
  --enable-libaom \
  --enable-libopenh264
```

### Required Libraries

| Library | Codec | License | Purpose |
|---------|-------|---------|---------|
| libvpx | VP8, VP9 | BSD | Encode/decode |
| libopus | Opus | BSD | Encode/decode |
| libdav1d | AV1 | BSD | Decode (fast) |
| libaom | AV1 | BSD | Encode/decode |
| libopenh264 | H.264 | BSD | Encode (LGPL-friendly) |

### Optional GPL Build

For users who want GPL codecs:

```bash
./configure \
  ... \
  --enable-gpl \
  --enable-libx264 \
  --enable-libx265 \
  --enable-libfdk-aac --enable-nonfree
```

## Acceptance Criteria

1. Build script produces static libraries for linux-x64
2. Build script produces static libraries for linux-arm64
3. Libraries pass basic codec function tests
4. Total static library size documented
5. All licenses documented and LGPL compliance verified
6. Docker build environment works consistently

## Technical Notes

### Dependency Order

Build in this order:
1. nasm/yasm (assembler)
2. libopus
3. libvpx  
4. dav1d
5. libaom
6. openh264
7. FFmpeg (linking all above)

### Cross-Compilation for arm64

```bash
./configure \
  --arch=aarch64 \
  --target-os=linux \
  --cross-prefix=aarch64-linux-gnu-
```

## Deliverables

- [ ] `scripts/build-ffmpeg.sh` — Main build script
- [ ] `docker/Dockerfile.ffmpeg-build` — Reproducible build environment
- [ ] Pre-built static libraries (or CI artifacts)
- [ ] License compliance documentation
- [ ] Binary size report

## Related

- [N-API PoC Addon](./napi-poc-addon.md) — Will consume these libraries
- [CI/CD Prebuild Pipeline](./cicd-prebuild.md) — Will automate builds
- [Node.js Linux N-API + FFmpeg Research](../research/nodejs-linux-napi-ffmpeg.md#22-linking-options)
