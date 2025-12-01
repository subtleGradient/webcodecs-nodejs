---
title: CI/CD Prebuild Pipeline
status: todo
priority: high
effort: medium
category: infrastructure
dependencies:
  - ffmpeg-static-build.md
  - napi-poc-addon.md
research: ../research/nodejs-linux-napi-ffmpeg.md
timeline: Week 4
---

# CI/CD Prebuild Pipeline

Set up automated builds and prebuild distribution for Linux x64 and arm64.

## Objective

Create a GitHub Actions pipeline that:
- Builds the native addon with bundled FFmpeg
- Produces prebuilt binaries for linux-x64 and linux-arm64
- Publishes to npm with prebuilds included

## Background

From [Distribution Strategy](../research/nodejs-linux-napi-ffmpeg.md#8-distribution-strategy):

> Use prebuild tooling such as:
> - `prebuildify` + `node-gyp-build` **or**
> - `node-pre-gyp` with hosted binaries.

## Tasks

- [ ] Choose prebuild tooling (prebuildify vs node-pre-gyp)
- [ ] Set up GitHub Actions workflow for linux-x64
- [ ] Set up GitHub Actions workflow for linux-arm64 (cross-compile or qemu)
- [ ] Integrate FFmpeg static build into CI
- [ ] Cache FFmpeg build artifacts for faster CI
- [ ] Configure prebuildify to include binaries in npm package
- [ ] Set up automated npm publish on tagged releases
- [ ] Add build matrix for Node.js LTS versions (18, 20, 22)
- [ ] Document manual build process for contributors
- [ ] Add CI status badges to README

## Prebuild Tooling Choice

### Option A: prebuildify + node-gyp-build

```json
{
  "scripts": {
    "prebuild": "prebuildify --napi --strip",
    "install": "node-gyp-build"
  },
  "devDependencies": {
    "prebuildify": "^6.0.0",
    "node-gyp-build": "^4.6.0"
  }
}
```

Pros:
- Binaries included in npm tarball
- No separate hosting needed
- Simple fallback to build from source

### Option B: node-pre-gyp

```json
{
  "binary": {
    "module_name": "webcodecs",
    "module_path": "./lib/binding/{platform}-{arch}",
    "remote_path": "./{version}/",
    "host": "https://github.com/org/repo/releases/download"
  }
}
```

Pros:
- Smaller npm package (binaries downloaded on install)
- Separate versioning of binaries

**Recommendation**: Use prebuildify for simplicity.

## GitHub Actions Workflow

```yaml
# .github/workflows/build.yml
name: Build

on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:
    branches: [main]

jobs:
  build-linux-x64:
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          
      - name: Cache FFmpeg
        uses: actions/cache@v4
        with:
          path: deps/ffmpeg
          key: ffmpeg-linux-x64-${{ hashFiles('scripts/build-ffmpeg.sh') }}
          
      - name: Build FFmpeg
        run: ./scripts/build-ffmpeg.sh
        
      - name: Install dependencies
        run: npm ci
        
      - name: Build addon
        run: npm run build
        
      - name: Run tests
        run: npm test
        
      - name: Prebuild
        run: npx prebuildify --napi --strip
        
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: prebuilds-linux-x64
          path: prebuilds/

  build-linux-arm64:
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3
        with:
          platforms: arm64
          
      - name: Build in arm64 container
        run: |
          docker run --rm --platform linux/arm64 \
            -v ${{ github.workspace }}:/workspace:rw \
            -w /workspace \
            --security-opt=no-new-privileges:true \
            node:20 \
            bash -c "npm ci && npm run build && npx prebuildify --napi --strip"
            
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: prebuilds-linux-arm64
          path: prebuilds/

  publish:
    needs: [build-linux-x64, build-linux-arm64]
    runs-on: ubuntu-22.04
    if: startsWith(github.ref, 'refs/tags/v')
    steps:
      - uses: actions/checkout@v4
      
      - name: Download all prebuilds
        uses: actions/download-artifact@v4
        with:
          path: prebuilds/
          merge-multiple: true
          
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: 'https://registry.npmjs.org'
          
      - name: Publish to npm
        run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Build Matrix

Test across Node.js versions:

```yaml
strategy:
  matrix:
    node-version: [18, 20, 22]
    
steps:
  - uses: actions/setup-node@v4
    with:
      node-version: ${{ matrix.node-version }}
```

Note: With N-API, same binary works across Node versions.

## FFmpeg Caching

Cache the built FFmpeg libraries:

```yaml
- name: Cache FFmpeg
  id: ffmpeg-cache
  uses: actions/cache@v4
  with:
    path: |
      deps/ffmpeg/lib
      deps/ffmpeg/include
    key: ffmpeg-${{ runner.os }}-${{ runner.arch }}-${{ hashFiles('scripts/build-ffmpeg.sh') }}
    
- name: Build FFmpeg
  if: steps.ffmpeg-cache.outputs.cache-hit != 'true'
  run: ./scripts/build-ffmpeg.sh
```

## Package.json Configuration

```json
{
  "name": "@webcodecs/node",
  "version": "0.1.0",
  "main": "lib/index.js",
  "types": "lib/index.d.ts",
  "files": [
    "lib/",
    "prebuilds/",
    "binding.gyp",
    "src/"
  ],
  "scripts": {
    "install": "node-gyp-build",
    "prebuild": "prebuildify --napi --strip",
    "build": "node-gyp rebuild",
    "test": "vitest run"
  },
  "devDependencies": {
    "node-addon-api": "^7.0.0",
    "node-gyp": "^10.0.0",
    "node-gyp-build": "^4.8.0",
    "prebuildify": "^6.0.0"
  }
}
```

## Acceptance Criteria

1. CI builds succeed on every push to main
2. Prebuilts generated for linux-x64 and linux-arm64
3. `npm install` uses prebuilt binary (no compile)
4. Fallback to source build works when prebuild missing
5. Tagged releases auto-publish to npm
6. FFmpeg build cached to speed up CI
7. Tests pass in CI for all Node.js LTS versions

## Deliverables

- [ ] `.github/workflows/build.yml` — Main build workflow
- [ ] `.github/workflows/test.yml` — PR test workflow
- [ ] `scripts/build-ffmpeg.sh` — FFmpeg build script
- [ ] Updated `package.json` with prebuild config
- [ ] `binding.gyp` — Build configuration
- [ ] Documentation for manual builds
- [ ] npm publish setup

## Related

- [FFmpeg Static Build](./ffmpeg-static-build.md) — FFmpeg build script
- [N-API PoC Addon](./napi-poc-addon.md) — Addon to build
- [Node.js Linux N-API + FFmpeg Research](../research/nodejs-linux-napi-ffmpeg.md#8-distribution-strategy)
