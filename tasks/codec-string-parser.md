---
title: Codec String Parser
status: todo
priority: high
effort: small
category: implementation
dependencies: []
research: ../research/nodejs-linux-napi-ffmpeg.md
timeline: Week 1
---

# Codec String Parser

Implement a parser for WebCodecs codec strings that maps them to FFmpeg codec parameters.

## Objective

Parse codec identifier strings like `avc1.42E01E` or `vp09.00.10.08` and extract the codec family, profile, level, and other parameters needed to configure FFmpeg.

## Background

From [Codec String Parsing](../research/nodejs-linux-napi-ffmpeg.md#24-codec-string-parsing):

> WebCodecs uses codec identifiers like:
> - H.264: `avc1.42E01E`, `avc3.640028`
> - VP9: `vp09.00.10.08...`
> - AV1: `av01.0.08M.08...`

## Tasks

- [ ] Research codec string formats for each codec family
- [ ] Implement parser for H.264/AVC codec strings (`avc1.*`, `avc3.*`)
- [ ] Implement parser for VP8/VP9 codec strings (`vp8`, `vp09.*`)
- [ ] Implement parser for AV1 codec strings (`av01.*`)
- [ ] Implement parser for HEVC codec strings (`hvc1.*`, `hev1.*`)
- [ ] Implement parser for audio codec strings (`mp4a.*`, `opus`)
- [ ] Map parsed values to FFmpeg codec ID and options
- [ ] Handle invalid/unsupported codec strings gracefully
- [ ] Add comprehensive unit tests
- [ ] Document supported codec strings

## Codec String Formats

### H.264 (AVC)

Format: `avc1.PPCCLL` or `avc3.PPCCLL`
- `PP` = Profile (hex)
- `CC` = Constraints (hex)  
- `LL` = Level (hex)

Examples:
- `avc1.42E01E` → Baseline Profile, Level 3.0
- `avc1.4D401F` → Main Profile, Level 3.1
- `avc1.640028` → High Profile, Level 4.0

### VP9

Format: `vp09.PP.LL.DD.CC.cp.tc.mc.FF`
- `PP` = Profile (00-03)
- `LL` = Level (10-62)
- `DD` = Bit depth (08, 10, 12)

Examples:
- `vp09.00.10.08` → Profile 0, Level 1.0, 8-bit
- `vp09.02.10.10` → Profile 2, 10-bit HDR

### AV1

Format: `av01.P.LLT.DD.M.CCC.cp.tc.mc.F`
- `P` = Profile (0-2)
- `LL` = Level (00-23)
- `T` = Tier (M/H)
- `DD` = Bit depth

Examples:
- `av01.0.08M.08` → Main Profile, Level 4.0 Main tier, 8-bit

## Implementation

### TypeScript Interface

```typescript
interface ParsedCodec {
  family: 'h264' | 'vp8' | 'vp9' | 'av1' | 'hevc' | 'aac' | 'opus';
  ffmpegCodecId: string;
  profile?: string;
  level?: number;
  bitDepth?: number;
  chromaSubsampling?: string;
  extraOptions?: Record<string, string | number>;
}

function parseCodecString(codec: string): ParsedCodec | null;
```

### FFmpeg Mapping

| Codec String | FFmpeg Decoder | FFmpeg Encoder |
|--------------|----------------|----------------|
| `avc1.*` | `h264` | `libopenh264` or `libx264` |
| `vp8` | `vp8` | `libvpx` |
| `vp09.*` | `vp9` | `libvpx-vp9` |
| `av01.*` | `libdav1d` | `libaom-av1` |
| `hvc1.*` | `hevc` | `libx265` |
| `mp4a.40.2` | `aac` | `aac` |
| `opus` | `libopus` | `libopus` |

## Acceptance Criteria

1. All common H.264 profiles/levels parse correctly
2. VP8 and VP9 codec strings parse correctly
3. AV1 codec strings parse correctly
4. Audio codec strings (AAC, Opus) parse correctly
5. Invalid strings return null or throw appropriate error
6. FFmpeg codec IDs are correctly mapped
7. Unit tests cover all codec families
8. Used by `isConfigSupported()` implementation

## Deliverables

- [ ] `src/codec-parser.ts` — Parser implementation
- [ ] `tests/codec-parser.test.ts` — Unit tests
- [ ] Documentation of supported codec strings

## Related

- [N-API PoC Addon](./napi-poc-addon.md) — Will use parser for `configure()`
- [Node.js Linux N-API + FFmpeg Research](../research/nodejs-linux-napi-ffmpeg.md#24-codec-string-parsing)
