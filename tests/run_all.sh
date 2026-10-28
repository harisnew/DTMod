#!/usr/bin/env bash
# Runs all unit tests (Node.js + python3). Run ./build.sh first (test_installer needs build/).
set -e; cd "$(dirname "$0")/.."
for f in smoke smoke2 smoke3 smoke4 smoke5 smoke6 smoke7 smoke8; do node tests/$f.js | tail -1; done
python3 tests/test_patcher.py | tail -1
python3 tests/test_installer.py | tail -1
