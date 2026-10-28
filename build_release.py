"""Makes src/dtmod.release.js: src/dtmod.js without the /*LAB*/.../*ENDLAB*/ test-helper block (F2/F3/F4/F5/F6/F10 debug hotkeys)."""
import os, re
here = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(here, 'src', 'dtmod.js'), encoding='utf8').read()
out = re.sub(r'\n  /\*LAB\*/.*?/\*ENDLAB\*/\n', '\n', src, flags=re.S)
assert '/*LAB*/' not in out
open(os.path.join(here, 'src', 'dtmod.release.js'), 'w', encoding='utf8', newline='').write(out)
print(len(src), '->', len(out), 'bytes (test helpers removed)')
