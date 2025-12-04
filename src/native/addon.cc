/**
 * WebCodecs Native Addon
 * 
 * N-API bindings for FFmpeg-based video encoding/decoding.
 * This is the entry point for the native module.
 */

#include <napi.h>
#include <string>
#include <cstdio>

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libavutil/avutil.h>
#include <libavutil/imgutils.h>
#include <libswscale/swscale.h>
}

/**
 * Returns FFmpeg version information.
 * Used to verify the addon loaded correctly and FFmpeg is available.
 */
Napi::Value GetFFmpegVersion(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  char version[512];
  snprintf(version, sizeof(version), 
    "libavcodec %d.%d.%d, libavformat %d.%d.%d, libavutil %d.%d.%d, libswscale %d.%d.%d",
    LIBAVCODEC_VERSION_MAJOR, LIBAVCODEC_VERSION_MINOR, LIBAVCODEC_VERSION_MICRO,
    LIBAVFORMAT_VERSION_MAJOR, LIBAVFORMAT_VERSION_MINOR, LIBAVFORMAT_VERSION_MICRO,
    LIBAVUTIL_VERSION_MAJOR, LIBAVUTIL_VERSION_MINOR, LIBAVUTIL_VERSION_MICRO,
    LIBSWSCALE_VERSION_MAJOR, LIBSWSCALE_VERSION_MINOR, LIBSWSCALE_VERSION_MICRO);
  
  return Napi::String::New(env, version);
}

/**
 * Simple hello world to verify addon is working.
 */
Napi::Value Hello(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  return Napi::String::New(env, "Hello from WebCodecs native addon!");
}

/**
 * Check if a codec is available (by FFmpeg codec name).
 * Returns { decoder: boolean, encoder: boolean }
 */
Napi::Value HasCodec(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "Expected codec name as string").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  std::string codecName = info[0].As<Napi::String>().Utf8Value();
  
  const AVCodec* decoder = avcodec_find_decoder_by_name(codecName.c_str());
  const AVCodec* encoder = avcodec_find_encoder_by_name(codecName.c_str());
  
  Napi::Object result = Napi::Object::New(env);
  result.Set("decoder", Napi::Boolean::New(env, decoder != nullptr));
  result.Set("encoder", Napi::Boolean::New(env, encoder != nullptr));
  
  if (decoder) {
    result.Set("decoderName", Napi::String::New(env, decoder->long_name ? decoder->long_name : decoder->name));
  }
  if (encoder) {
    result.Set("encoderName", Napi::String::New(env, encoder->long_name ? encoder->long_name : encoder->name));
  }
  
  return result;
}

/**
 * List all available codecs that match a filter.
 * listCodecs("vp") returns all codecs with "vp" in the name.
 */
Napi::Value ListCodecs(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  std::string filter = "";
  if (info.Length() >= 1 && info[0].IsString()) {
    filter = info[0].As<Napi::String>().Utf8Value();
  }
  
  Napi::Array result = Napi::Array::New(env);
  uint32_t index = 0;
  
  void* iter = nullptr;
  const AVCodec* codec;
  
  while ((codec = av_codec_iterate(&iter))) {
    std::string name(codec->name);
    
    // Apply filter if provided
    if (!filter.empty() && name.find(filter) == std::string::npos) {
      continue;
    }
    
    Napi::Object codecInfo = Napi::Object::New(env);
    codecInfo.Set("name", Napi::String::New(env, codec->name));
    codecInfo.Set("longName", Napi::String::New(env, codec->long_name ? codec->long_name : ""));
    codecInfo.Set("isEncoder", Napi::Boolean::New(env, av_codec_is_encoder(codec)));
    codecInfo.Set("isDecoder", Napi::Boolean::New(env, av_codec_is_decoder(codec)));
    
    // Codec type
    const char* type = "unknown";
    switch (codec->type) {
      case AVMEDIA_TYPE_VIDEO: type = "video"; break;
      case AVMEDIA_TYPE_AUDIO: type = "audio"; break;
      case AVMEDIA_TYPE_SUBTITLE: type = "subtitle"; break;
      default: break;
    }
    codecInfo.Set("type", Napi::String::New(env, type));
    
    result.Set(index++, codecInfo);
  }
  
  return result;
}

/**
 * Decode a VP8 frame from raw IVF frame data.
 * This is a synchronous decode for testing purposes.
 * 
 * decodeVP8Frame(frameData: Buffer) => { width, height, format, data: Buffer }
 */
Napi::Value DecodeVP8Frame(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 1 || !info[0].IsBuffer()) {
    Napi::TypeError::New(env, "Expected Buffer with VP8 frame data").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  Napi::Buffer<uint8_t> inputBuffer = info[0].As<Napi::Buffer<uint8_t>>();
  uint8_t* frameData = inputBuffer.Data();
  size_t frameSize = inputBuffer.Length();
  
  // Find VP8 decoder
  const AVCodec* codec = avcodec_find_decoder(AV_CODEC_ID_VP8);
  if (!codec) {
    Napi::Error::New(env, "VP8 decoder not found").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  // Allocate codec context
  AVCodecContext* ctx = avcodec_alloc_context3(codec);
  if (!ctx) {
    Napi::Error::New(env, "Failed to allocate codec context").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  // Open codec
  if (avcodec_open2(ctx, codec, nullptr) < 0) {
    avcodec_free_context(&ctx);
    Napi::Error::New(env, "Failed to open codec").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  // Create packet
  AVPacket* pkt = av_packet_alloc();
  pkt->data = frameData;
  pkt->size = static_cast<int>(frameSize);
  
  // Create frame
  AVFrame* frame = av_frame_alloc();
  
  // Send packet
  int ret = avcodec_send_packet(ctx, pkt);
  if (ret < 0) {
    av_frame_free(&frame);
    av_packet_free(&pkt);
    avcodec_free_context(&ctx);
    
    char errbuf[256];
    av_strerror(ret, errbuf, sizeof(errbuf));
    Napi::Error::New(env, std::string("Failed to send packet: ") + errbuf).ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  // Receive frame
  ret = avcodec_receive_frame(ctx, frame);
  if (ret < 0) {
    av_frame_free(&frame);
    av_packet_free(&pkt);
    avcodec_free_context(&ctx);
    
    char errbuf[256];
    av_strerror(ret, errbuf, sizeof(errbuf));
    Napi::Error::New(env, std::string("Failed to receive frame: ") + errbuf).ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  // Convert to RGB24 for easy verification
  int width = frame->width;
  int height = frame->height;
  size_t rgbSize = width * height * 3;
  
  SwsContext* swsCtx = sws_getContext(
    width, height, static_cast<AVPixelFormat>(frame->format),
    width, height, AV_PIX_FMT_RGB24,
    SWS_BILINEAR, nullptr, nullptr, nullptr
  );
  
  if (!swsCtx) {
    av_frame_free(&frame);
    av_packet_free(&pkt);
    avcodec_free_context(&ctx);
    Napi::Error::New(env, "Failed to create swscale context").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  
  // Allocate RGB buffer
  Napi::Buffer<uint8_t> rgbBuffer = Napi::Buffer<uint8_t>::New(env, rgbSize);
  uint8_t* rgbData = rgbBuffer.Data();
  
  uint8_t* dstSlice[1] = { rgbData };
  int dstStride[1] = { width * 3 };
  
  sws_scale(swsCtx, frame->data, frame->linesize, 0, height, dstSlice, dstStride);
  
  // Build result
  Napi::Object result = Napi::Object::New(env);
  result.Set("width", Napi::Number::New(env, width));
  result.Set("height", Napi::Number::New(env, height));
  result.Set("format", Napi::String::New(env, "rgb24"));
  result.Set("data", rgbBuffer);
  
  // First pixel for quick verification
  result.Set("firstPixelR", Napi::Number::New(env, rgbData[0]));
  result.Set("firstPixelG", Napi::Number::New(env, rgbData[1]));
  result.Set("firstPixelB", Napi::Number::New(env, rgbData[2]));
  
  // Cleanup
  sws_freeContext(swsCtx);
  av_frame_free(&frame);
  av_packet_free(&pkt);
  avcodec_free_context(&ctx);
  
  return result;
}

/**
 * Module initialization
 */
Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("hello", Napi::Function::New(env, Hello));
  exports.Set("getFFmpegVersion", Napi::Function::New(env, GetFFmpegVersion));
  exports.Set("hasCodec", Napi::Function::New(env, HasCodec));
  exports.Set("listCodecs", Napi::Function::New(env, ListCodecs));
  exports.Set("decodeVP8Frame", Napi::Function::New(env, DecodeVP8Frame));
  
  return exports;
}

NODE_API_MODULE(webcodecs_native, Init)
