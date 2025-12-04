{
  "targets": [
    {
      "target_name": "webcodecs_native",
      "sources": [
        "src/native/addon.cc"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "cflags_cc": [
        "-std=c++17",
        "-fPIC",
        "<!@(pkg-config --cflags libavcodec libavformat libavutil libswscale)"
      ],
      "libraries": [
        "<!@(pkg-config --libs libavcodec libavformat libavutil libswscale)"
      ],
      "defines": [
        "NAPI_VERSION=8",
        "NAPI_DISABLE_CPP_EXCEPTIONS"
      ],
      "conditions": [
        ["OS=='linux'", {
          "cflags_cc": ["-fPIC"],
          "ldflags": ["-Wl,-rpath,'$$ORIGIN'"]
        }]
      ]
    }
  ]
}
