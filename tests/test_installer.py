import os, struct, subprocess, sys, tempfile, hashlib, shutil
HERE=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
exe=HERE+'/build/dtsetup_linux'
def build(path, files):
    ents=b''; data=b''
    for name,content in files:
        nb=name.encode(); ents+=struct.pack('>QQQQIB',0,len(data),len(content),len(content),0,len(nb))+nb; data+=content
    ents+=b'blob'
    hdr=b'c3ab'+struct.pack('>Q',16)+b'\0'*4+b'fdir'+struct.pack('>QI',len(ents),len(files)); assert len(hdr)==32
    open(path,'wb').write(hdr+ents+struct.pack('>Q',len(data))+data)
def fresh(d):
    os.makedirs(d+'/www',exist_ok=True); os.makedirs(d+'/DTMod',exist_ok=True)
    build(d+'/www/assets.dat',[('a.bin',b'A'*500),('scripts/modernjscheck.js',b'"use strict";window.X=1;'),('index.html',b'<html>'),('z.bin',b'Z'*4000)])
    open(d+'/Devices Tycoon.exe','wb').write(b'MZ')
    shutil.copy(HERE+'/patcher.py',d+'/DTMod/'); shutil.copy(HERE+'/src/dtmod.release.js',d+'/DTMod/')
sha=lambda p:hashlib.sha256(open(p,'rb').read()).hexdigest()
def run(d,*a,inp=None):
    r=subprocess.run([exe,'--game',d,'--quiet',*a],capture_output=True,text=True); print(' $',*a,'->',r.returncode,'|',r.stdout.strip().splitlines()[-1] if r.stdout.strip() else '',r.stderr.strip()); return r
def py(d,*a):
    r=subprocess.run([sys.executable,d+'/DTMod/patcher.py',*a],capture_output=True,text=True); print(' py',*a,'->',r.stdout.strip().splitlines()[-1] if r.stdout.strip() else r.stderr.strip()[-200:]); return r
def readback(d):
    f=open(d+'/www/assets.dat','rb').read(); dirsize=struct.unpack('>Q',f[20:28])[0]; base=32+dirsize+8
    assert struct.unpack('>Q',f[32+dirsize:40+dirsize])[0]==len(f)-base, 'blob len'
    pos=32; n=struct.unpack('>I',f[28:32])[0]
    for i in range(n):
        z,off,sz,sz2,fl,nl=struct.unpack('>QQQQIB',f[pos:pos+37]); name=f[pos+37:pos+37+nl].decode(); pos+=37+nl
        if name=='scripts/modernjscheck.js': return f[base+off:base+off+sz]
d=tempfile.mkdtemp(); fresh(d); h0=sha(d+'/www/assets.dat')
js=open(HERE+'/src/dtmod.release.js','rb').read()
print('1) install'); run(d,'--install'); b=readback(d); assert b.startswith(b'"use strict";window.X=1;') and js in b and os.path.exists(d+'/zz-dtmod-x64.ext.dll')
assert open(d+'/zz-dtmod-x64.ext.dll','rb').read()==open(HERE+'/build/zz-dtmod-x64.ext.dll','rb').read()
print('2) python sees it as patched'); r=py(d,'status'); assert 'YES' in r.stdout
print('3) install again (update)'); run(d,'--install'); assert readback(d).count(b'__DTMOD__')>=1; print('   size ok', len(open(d+'/www/assets.dat','rb').read()))
print('4) status'); run(d,'--status')
print('5) uninstall'); run(d,'--uninstall'); assert sha(d+'/www/assets.dat')==h0 and not os.path.exists(d+'/zz-dtmod-x64.ext.dll') and not os.path.exists(d+'/dtmod.patch.json')
print('6) python patch -> C uninstall'); py(d,'patch'); run(d,'--uninstall'); assert sha(d+'/www/assets.dat')==h0
print('7) C install -> python unpatch'); run(d,'--install'); py(d,'unpatch'); assert sha(d+'/www/assets.dat')==h0
print('8) stale state (game updated by Steam): install, replace assets, install again')
run(d,'--install'); fresh(d); h1=sha(d+'/www/assets.dat'); run(d,'--install'); b=readback(d); assert js in b
run(d,'--uninstall'); assert sha(d+'/www/assets.dat')==h1
print('9) uninstall when not installed'); run(d,'--uninstall')
print('10) locked/unwritable file'); os.chmod(d+'/www/assets.dat',0o444)
r=run(d,'--install')
if os.geteuid()!=0: assert r.returncode==1
os.chmod(d+'/www/assets.dat',0o644)
print('11) garbage container'); open(d+'/www/assets.dat','wb').write(b'not a container'*100); r=run(d,'--install'); assert r.returncode==1
print('ALL OK')
