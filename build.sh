#!/usr/bin/env bash
# Builds everything from source on Linux/macOS/Windows(git-bash). Needs: python3 and `pip install ziglang` (Zig is used as a C cross-compiler).
set -e
cd "$(dirname "$0")"
mkdir -p build
ZIG="python3 -m ziglang"
python3 build_release.py
# 1) native module (Windows x64 DLL, plain C, uses only steam_api64.dll that the game already loads)
$ZIG cc -target x86_64-windows-gnu -shared -O2 -s src/dtmod.c -o build/zz-dtmod-x64.ext.dll -lkernel32 -luser32 -lwinmm -ladvapi32
# 2) installer: embeds the DLL + src/dtmod.release.js
python3 installer/gen_payload.py build/zz-dtmod-x64.ext.dll src/dtmod.release.js installer/payload.h
$ZIG cc -target x86_64-windows-gnu -Os -s installer/dtsetup.c -o build/DTMod-Setup.exe -ladvapi32 -lshell32 -luser32 -lole32
# 3) Linux build of the same installer logic, used by the tests
$ZIG cc -Os -s installer/dtsetup.c -o build/dtsetup_linux
echo "built: build/DTMod-Setup.exe  build/zz-dtmod-x64.ext.dll"
