"""Check that a DTMod-Setup.exe really contains the JavaScript from this source tree:
    python3 verify.py path/to/DTMod-Setup.exe
Builds src/dtmod.release.js from src/dtmod.js and looks for those exact bytes inside the exe. Also prints what the DLL imports."""
import hashlib, os, re, subprocess, sys
here = os.path.dirname(os.path.abspath(__file__))
exe = open(sys.argv[1], 'rb').read()
subprocess.check_call([sys.executable, os.path.join(here, 'build_release.py')], stdout=subprocess.DEVNULL)
js = open(os.path.join(here, 'src', 'dtmod.release.js'), 'rb').read()
# the installer stores the payload as a C byte array -> raw bytes inside the exe
print('release JS sha256:', hashlib.sha256(js).hexdigest())
print('JS found verbatim inside the exe:', js in exe)
dll_start = exe.find(b'MZ', 1000)
imports = sorted(set(m.decode() for m in re.findall(rb'[A-Za-z0-9_.-]+\.dll', exe)))
print('DLL names referenced by the exe:', ', '.join(imports))
sys.exit(0 if js in exe else 1)
