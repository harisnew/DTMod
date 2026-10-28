import os, struct, subprocess, sys, tempfile, hashlib, shutil
HERE=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def build(path, files):
    ents=b''; data=b''; 
    for name,content in files:
        nb=name.encode()
        ents+=struct.pack('>QQQQIB',0,len(data),len(content),len(content),0,len(nb))+nb
        data+=content
    ents+=b'blob'
    hdr=b'c3ab'+struct.pack('>Q',16)+b'\0'*4+b'fdir'+struct.pack('>QI',len(ents),len(files))
    assert len(hdr)==32
    open(path,'wb').write(hdr+ents+struct.pack('>Q',len(data))+data)
d=tempfile.mkdtemp(); os.makedirs(d+'/www'); os.makedirs(d+'/DTMod')
orig=b'"use strict";window.X=1;'
build(d+'/www/assets.dat',[('scripts/modernjscheck.js',orig),('a.bin',b'A'*1000),('index.html',b'<html>'),('z.bin',b'Z'*77)])
open(d+'/package.json','w').write('{\n\t\t"enable-devtools": false,\n}\n')
shutil.copy(HERE+'/patcher.py',d+'/DTMod/'); open(d+'/DTMod/dtmod.js','w').write('window.__DTMOD__=1; // ü\n')
sha=lambda p:hashlib.sha256(open(p,'rb').read()).hexdigest()
h0=sha(d+'/www/assets.dat'); p0=sha(d+'/package.json')
def run(*a):
    r=subprocess.run([sys.executable,d+'/DTMod/patcher.py',*a],capture_output=True,text=True); print(r.stdout,r.stderr); return r
run('status'); run('patch','--devtools'); run('status')
assert sha(d+'/www/assets.dat')!=h0 and 'true' in open(d+'/package.json').read()
run('patch')   # re-patch idempotent
run('status')
# independent read of patched file
f=open(d+'/www/assets.dat','rb').read()
dirsize=struct.unpack('>Q',f[20:28])[0]; base=32+dirsize+8
assert struct.unpack('>Q',f[32+dirsize:40+dirsize])[0]==len(f)-base
off,sz=struct.unpack('>QQ',f[32+8:32+24]); print(f[base+off:base+off+sz])
assert f[base+off:base+off+sz].startswith(orig) and b'__DTMOD__' in f[base+off:base+off+sz]
run('unpatch')
assert sha(d+'/www/assets.dat')==h0 and sha(d+'/package.json')==p0, 'restore not bit exact'
print('ROUNDTRIP OK')
