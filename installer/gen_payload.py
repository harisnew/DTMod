import sys
dll, js, out = sys.argv[1:4]
def arr(name, data):
    lines=[]
    for i in range(0,len(data),24):
        lines.append(','.join(str(b) for b in data[i:i+24]))
    return 'static const unsigned char %s[] = {\n%s\n};\nstatic const unsigned long long %s_LEN = %d;\n' % (name, ',\n'.join(lines), name, len(data))
d=open(dll,'rb').read(); j=open(js,'rb').read()
open(out,'w').write(arr('DTMOD_DLL',d)+arr('DTMOD_JS',j))
print('payload: dll=%d js=%d'%(len(d),len(j)))
