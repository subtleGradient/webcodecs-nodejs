# Lossless Verification for WebCodecs Testing

## Problem

We need to verify that encoding/decoding actually works by encoding a "secret" value and recovering it after decode. Simple RGB color matching fails because:

1. **YUV conversion loses precision** - RGB→YUV→RGB is lossy
2. **VP8 doesn't support lossless mode** - only VP9 has `-lossless 1`
3. **Even VP9 lossless with gbrp has conversion issues** in the filter chain

## Solution: QR Codes

QR codes survive lossy compression because:

1. **High contrast** - black/white only, no gradients
2. **Error correction** - up to 30% with ERROR_CORRECT_H
3. **Pattern-based** - spatial patterns survive DCT-based compression

### Tested Results

| Codec | CRF | Result |
|-------|-----|--------|
| VP8 | 4-50 | ✓ All pass |
| VP9 | 0-63 | ✓ All pass |
| H.264 | 0-40 | ✓ All pass |
| H.264 | 51 | ✗ Fails (extreme) |

## FFmpeg Commands

### Generate QR Code Test Frame

```bash
# Use Node.js/Bun to generate QR code PNG
bun -e "
import QRCode from 'qrcode';
const secret = 'DEADBE-' + Date.now();
await QRCode.toFile('qr.png', secret, {
  errorCorrectionLevel: 'H',
  margin: 2,
  width: 128
});
console.log(secret);
"
```

### Encode to VP9 (recommended)

```bash
# High quality (CRF 30 is default)
ffmpeg -y -loop 1 -framerate 25 -i qr.png -t 0.04 \
  -c:v libvpx-vp9 -crf 30 -b:v 0 -pix_fmt yuv420p \
  -f ivf output.ivf

# Lossless (for when exact reproduction is needed)
ffmpeg -y -i qr.png -c:v libvpx-vp9 -lossless 1 -pix_fmt gbrp \
  output_lossless.webm
```

### Encode to VP8

```bash
ffmpeg -y -loop 1 -framerate 25 -i qr.png -t 0.04 \
  -c:v libvpx -crf 10 -b:v 1M -pix_fmt yuv420p \
  -f ivf output.ivf
```

### Encode to H.264

```bash
ffmpeg -y -i qr.png -c:v libx264 -crf 18 -pix_fmt yuv420p \
  output.mp4
```

### Extract Raw Frame for WebCodecs

IVF format is ideal for WebCodecs because:
- Simple header structure (32 bytes)
- Raw encoded frames without container overhead
- Each frame has 12-byte header (size + timestamp)

```bash
# VP9 to IVF (WebCodecs-ready)
ffmpeg -y -i input.png -c:v libvpx-vp9 -crf 30 -b:v 0 \
  -pix_fmt yuv420p -f ivf output.ivf
```

## Verification Code (TypeScript)

```typescript
import jsQR from 'jsqr';
import sharp from 'sharp';
import { execSync } from 'child_process';

async function verifyEncodedFrame(
  encodedFile: string, 
  expectedSecret: string
): Promise<boolean> {
  // Decode to PNG
  const tmpPng = `/tmp/verify_${Date.now()}.png`;
  execSync(`ffmpeg -y -i "${encodedFile}" -frames:v 1 -update 1 "${tmpPng}"`);
  
  // Read as RGBA
  const { data, info } = await sharp(tmpPng)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  
  // Decode QR
  const code = jsQR(new Uint8ClampedArray(data), info.width, info.height);
  
  return code?.data === expectedSecret;
}
```

## Alternative: VP9 True Lossless

For cases where exact pixel values matter:

```bash
# Input must be raw RGB
ffmpeg -y -f rawvideo -pix_fmt rgb24 -s 64x64 -r 1 -i input.rgb \
  -c:v libvpx-vp9 -lossless 1 -pix_fmt gbrp output.webm

# Verified: RGB #DEADBE survives round-trip exactly
```

Key requirements:
- Use `gbrp` pixel format (planar RGB)
- Use `-lossless 1` flag
- Input must be raw RGB, not from PNG (avoids filter chain conversion)

## Recommendation

**Use QR codes for test fixtures:**

1. Generate QR with secret = `{codec}-{timestamp}-{random}`
2. Encode with target codec at reasonable quality (CRF 30)
3. After decode, scan QR and verify secret matches
4. If QR decode fails, the codec round-trip is broken

This approach:
- Works with all codecs (VP8, VP9, H.264, AV1)
- Works with lossy compression
- Has built-in error detection
- Produces human-inspectable test frames
