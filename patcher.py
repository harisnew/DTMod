#!/usr/bin/env python3
"""DTMod patcher for Devices Tycoon (Construct 3 / c3ab container).

Usage:  python patcher.py status|patch|unpatch [--game DIR] [--js FILE] [--devtools]

How it works (no 1.3 GB rewrite):
  * www/assets.dat is a c3ab container. The mod JS is appended to the original
    scripts/modernjscheck.js (the first classic script index.html loads).
  * The new payload (original + mod) is appended to the END of assets.dat and the directory
    entry of modernjscheck.js is re-pointed to it; the 'blob' length field is updated.
  * dtmod.patch.json (next to the game exe) remembers the original entry and original file
    length, so `unpatch` restores the file bit-exactly (entry restored, file truncated).
  * --devtools additionally sets "enable-devtools": true in package.json (backup kept).
The game must be closed. After a Steam update/verify of game files, simply run `patch` again.
"""
import argparse, hashlib, json, os, re, struct, sys

TARGET = 'scripts/modernjscheck.js'
STATE = 'dtmod.patch.json'
ENT = struct.Struct('>QQQQIB')  # zero, offset, size, size2, flag, namelen


def die(msg, code=1):
    print('ERROR: ' + msg)
    sys.exit(code)


class Container:
    def __init__(self, path):
        self.path = path
        self.f = open(path, 'r+b')
        h = self.f.read(32)
        if h[:4] != b'c3ab' or h[16:20] != b'fdir':
            die('assets.dat: unknown format (not c3ab); the game version may have changed.')
        self.dirsize = struct.unpack('>Q', h[20:28])[0]
        self.n = struct.unpack('>I', h[28:32])[0]
        self.base = 32 + self.dirsize + 8
        d = self.f.read(self.dirsize)
        if d[-4:] != b'blob':      # last 4 bytes of the directory region are the 'blob' tag; u64 length follows
            die("assets.dat: 'blob' marker not found at expected position.")
        self.f.seek(0, 2)
        self.size = self.f.tell()
        self.entries = {}
        pos = 0
        for _ in range(self.n):
            z, off, sz, sz2, fl, nl = ENT.unpack_from(d, pos)
            name = d[pos + ENT.size:pos + ENT.size + nl].decode('utf-8')
            self.entries[name] = (32 + pos, off, sz, sz2, fl)
            pos += ENT.size + nl

    def read(self, off, size):
        self.f.seek(self.base + off)
        return self.f.read(size)

    def blob_field(self):
        """Return (pos, value) of the 'blob' length field (the 8 bytes right after 'blob')."""
        pos = 32 + self.dirsize
        self.f.seek(pos)
        return pos, struct.unpack('>Q', self.f.read(8))[0]

    def close(self):
        self.f.close()


def load_state(game):
    p = os.path.join(game, STATE)
    if os.path.exists(p):
        try:
            return json.load(open(p, 'r', encoding='utf-8'))
        except Exception:
            return None
    return None


def save_state(game, st):
    with open(os.path.join(game, STATE), 'w', encoding='utf-8') as f:
        json.dump(st, f, indent=1)


def entry_ptr_write(c, dir_pos, off, size):
    # dir_pos points at the u64 'zero' field of the entry
    c.f.seek(dir_pos + 8)
    c.f.write(struct.pack('>QQQ', off, size, size))


def is_patched(c, st):
    if not st or TARGET not in c.entries:
        return False
    _, off, sz, _, _ = c.entries[TARGET]
    return off == st.get('new_off') and sz == st.get('new_size')


def do_status(game, apath):
    c = Container(apath)
    st = load_state(game)
    _, off, sz, _, _ = c.entries[TARGET]
    pos, bl = c.blob_field()
    print('assets.dat size   :', c.size)
    print('blob field        :', bl, '(expected %d)' % (c.size - c.base))
    print('%s : off=%d size=%d' % (TARGET, off, sz))
    print('patched           :', 'YES' if is_patched(c, st) else 'no')
    if st and not is_patched(c, st):
        print('note: stale state file (game files were replaced/updated) - run `patch` again.')
    pk = os.path.join(game, 'package.json')
    if os.path.exists(pk):
        print('devtools          :', 'on' if re.search(r'"enable-devtools"\s*:\s*true', open(pk, encoding='utf-8').read()) else 'off')
    c.close()


def do_unpatch(game, apath, quiet=False, keep_pkg=False):
    c = Container(apath)
    st = load_state(game)
    if not st:
        if not quiet:
            print('nothing to restore (no state file).')
        c.close()
        return
    if is_patched(c, st):
        entry_ptr_write(c, c.entries[TARGET][0], st['orig_off'], st['orig_size'])
        c.f.seek(st['blob_pos'])
        c.f.write(struct.pack('>Q', st['orig_blob']))
        c.f.flush()
        os.fsync(c.f.fileno())
        c.f.truncate(st['orig_len'])
        c.f.flush()
        os.fsync(c.f.fileno())
        if not quiet:
            print('assets.dat restored (entry repointed, file truncated to %d bytes).' % st['orig_len'])
    else:
        # entry is not ours; if the file is longer than recorded it may hold an orphan from a crashed patch
        if c.size > st['orig_len'] and c.entries[TARGET][1] == st['orig_off']:
            c.f.truncate(st['orig_len'])
            print('removed orphan tail from an interrupted patch.')
        elif not quiet:
            print('assets.dat is not in the patched state; leaving it untouched.')
    c.close()
    try:
        os.remove(os.path.join(game, STATE))
    except OSError:
        pass
    pk = os.path.join(game, 'package.json')
    bak = pk + '.dtmod.bak'
    if os.path.exists(bak) and not keep_pkg:
        os.replace(bak, pk)
        if not quiet:
            print('package.json restored.')


def do_patch(game, apath, jspath, devtools):
    if not os.path.exists(jspath):
        die('mod script not found: ' + jspath)
    js = open(jspath, 'rb').read()
    try:
        js.decode('utf-8')
    except UnicodeDecodeError:
        die('mod script is not valid UTF-8')
    # drop a stale/previous patch first, so we always patch from pristine
    c = Container(apath)
    st = load_state(game)
    patched = is_patched(c, st)
    c.close()
    if st and patched:
        do_unpatch(game, apath, quiet=True, keep_pkg=True)
    elif st:
        # stale: file was replaced (Steam update). Orphan tail can't exist then; just forget old state.
        try:
            os.remove(os.path.join(game, STATE))
        except OSError:
            pass

    c = Container(apath)
    if TARGET not in c.entries:
        die(TARGET + ' not found in assets.dat (unsupported game version).')
    dpos, off, sz, sz2, fl = c.entries[TARGET]
    orig = c.read(off, sz)
    if b'__DTMOD__' in orig:
        die('assets.dat already contains the mod but there is no state file. Verify game files in Steam, then retry.')
    bpos, blen = c.blob_field()
    if blen != c.size - c.base:
        die('blob length mismatch (%d vs %d); refusing to patch an unexpected container.' % (blen, c.size - c.base))
    payload = orig + b'\n;' + js + b'\n'
    st = {
        'tool': 'dtmod-patcher', 'target': TARGET, 'orig_off': off, 'orig_size': sz,
        'orig_len': c.size, 'orig_blob': blen, 'blob_pos': bpos,
        'new_off': c.size - c.base, 'new_size': len(payload),
        'js_sha256': hashlib.sha256(js).hexdigest(),
    }
    save_state(game, st)                      # state first: a crash later can always be undone
    c.f.seek(c.size)
    c.f.write(payload)
    c.f.flush()
    os.fsync(c.f.fileno())
    entry_ptr_write(c, dpos, st['new_off'], st['new_size'])
    c.f.seek(bpos)
    c.f.write(struct.pack('>Q', blen + len(payload)))
    c.f.flush()
    os.fsync(c.f.fileno())
    c.close()
    # verify by re-reading
    c = Container(apath)
    _, o2, s2, _, _ = c.entries[TARGET]
    back = c.read(o2, s2)
    ok = back == payload and c.blob_field()[1] == c.size - c.base
    c.close()
    if not ok:
        do_unpatch(game, apath, quiet=True)
        die('verification failed; the original state was restored.')
    print('patched OK: +%d bytes appended, %s repointed.' % (len(payload), TARGET))

    if devtools:
        pk = os.path.join(game, 'package.json')
        txt = open(pk, encoding='utf-8').read()
        if not os.path.exists(pk + '.dtmod.bak'):
            open(pk + '.dtmod.bak', 'w', encoding='utf-8').write(txt)
        new = re.sub(r'("enable-devtools"\s*:\s*)false', r'\1true', txt)
        open(pk, 'w', encoding='utf-8').write(new)
        print('devtools enabled in package.json (F12 in game / remote debugging).' if new != txt else 'devtools already enabled.')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('cmd', choices=['status', 'patch', 'unpatch'])
    here = os.path.dirname(os.path.abspath(__file__))
    ap.add_argument('--game', default=os.path.dirname(here))
    ap.add_argument('--js', default=os.path.join(here, 'dtmod.js'))
    ap.add_argument('--devtools', action='store_true')
    a = ap.parse_args()
    apath = os.path.join(a.game, 'www', 'assets.dat')
    if not os.path.exists(apath):
        die('not found: ' + apath + ' (use --game DIR)')
    if a.cmd == 'status':
        do_status(a.game, apath)
    elif a.cmd == 'patch':
        do_patch(a.game, apath, a.js, a.devtools)
    else:
        do_unpatch(a.game, apath)


if __name__ == '__main__':
    main()
