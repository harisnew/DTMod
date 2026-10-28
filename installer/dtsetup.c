// DTMod-Setup: installs / removes the Devices Tycoon co-op mod (Steam lobbies).
//  - finds the game through the Steam registry + libraryfolders.vdf (or a path argument / typed path)
//  - copies zz-dtmod-x64.ext.dll next to Devices Tycoon.exe
//  - appends the mod UI to www/assets.dat (c3ab container) and repoints scripts/modernjscheck.js
//  - stores dtmod.patch.json so the change is undone bit-exactly by "uninstall"
// Same on-disk state format as patcher.py (the two tools are interchangeable).
#define _FILE_OFFSET_BITS 64
#define _POSIX_C_SOURCE 200809L
#ifndef _WIN32
#define _strdup strdup
#endif
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <ctype.h>
#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <io.h>
#define SEP '\\'
#define FSEEK _fseeki64
#define FTELL _ftelli64
#else
#include <sys/types.h>
#include <unistd.h>
#define SEP '/'
#define FSEEK fseeko
#define FTELL ftello
#endif
#include "payload.h"

#define VERSION "1.0"
#define TARGET "scripts/modernjscheck.js"
#define STATE_NAME "dtmod.patch.json"
#define DLL_NAME "zz-dtmod-x64.ext.dll"

// ---------------- messages (en, ru) ----------------
enum { M_TITLE, M_FOUND, M_NOTFOUND, M_ASKPATH, M_MENU, M_CHOICE, M_CLOSEGAME, M_BADFMT, M_OK_INST, M_OK_UNINST, M_ALREADY,
       M_NOSTATE, M_STATUS_ON, M_STATUS_OFF, M_PRESS, M_FAIL_DLL, M_UNSUPPORTED, M_VERIFY_FAIL, M_NEXT, M_RESTORED, M_BYE, M_STEPDLL, M_STEPJS, M_STALE, M_COUNT };
static const char* TXT[M_COUNT][2] = {
 /*TITLE*/ {"DTMod - Devices Tycoon co-op mod (Steam lobbies) - installer v" VERSION, "DTMod - кооперативный мод для Devices Tycoon (лобби Steam) - установщик v" VERSION},
 /*FOUND*/ {"Game found:", "Игра найдена:"},
 /*NOTFOUND*/ {"Could not find Devices Tycoon automatically.", "Не удалось автоматически найти Devices Tycoon."},
 /*ASKPATH*/ {"Paste the game folder path (the one with 'Devices Tycoon.exe'), then press Enter: ", "Вставьте путь к папке игры (где лежит 'Devices Tycoon.exe') и нажмите Enter: "},
 /*MENU*/ {"\n  [1] Install / update the mod\n  [2] Uninstall the mod (restores the original game files)\n  [3] Show status\n  [0] Exit\n", "\n  [1] Установить / обновить мод\n  [2] Удалить мод (вернёт оригинальные файлы игры)\n  [3] Показать состояние\n  [0] Выход\n"},
 /*CHOICE*/ {"Your choice: ", "Ваш выбор: "},
 /*CLOSEGAME*/ {"ERROR: cannot open the game data for writing. Close Devices Tycoon (and Steam's 'Verify' if running) and try again.", "ОШИБКА: не удаётся открыть данные игры на запись. Закройте Devices Tycoon и попробуйте снова."},
 /*BADFMT*/ {"ERROR: unexpected format of www/assets.dat. The game was probably updated; this installer version does not support it.", "ОШИБКА: неожиданный формат www/assets.dat. Вероятно, игра обновилась; эта версия установщика её не поддерживает."},
 /*OK_INST*/ {"Installed. Start the game from Steam: a 'Co-op' button appears in the main menu (or press F8).", "Готово. Запустите игру из Steam: в главном меню появится кнопка «Кооператив» (или нажмите F8)."},
 /*OK_UNINST*/ {"Mod removed. Original files restored.", "Мод удалён. Оригинальные файлы восстановлены."},
 /*ALREADY*/ {"Updating the existing installation...", "Обновляю существующую установку..."},
 /*NOSTATE*/ {"Nothing to remove: the mod is not installed.", "Нечего удалять: мод не установлен."},
 /*STATUS_ON*/ {"Status: mod is INSTALLED", "Состояние: мод УСТАНОВЛЕН"},
 /*STATUS_OFF*/ {"Status: mod is not installed", "Состояние: мод не установлен"},
 /*PRESS*/ {"\nPress Enter to close...", "\nНажмите Enter, чтобы закрыть..."},
 /*FAIL_DLL*/ {"ERROR: cannot write the native module (zz-dtmod-x64.ext.dll). Is the game running?", "ОШИБКА: не удаётся записать нативный модуль (zz-dtmod-x64.ext.dll). Игра запущена?"},
 /*UNSUPPORTED*/ {"ERROR: this does not look like a supported Devices Tycoon build (start script not found / already modified by another tool). Use Steam 'Verify integrity of game files' and retry.", "ОШИБКА: это не похоже на поддерживаемую версию Devices Tycoon (стартовый скрипт не найден или изменён другим инструментом). Выполните в Steam «Проверить целостность файлов игры» и повторите."},
 /*VERIFY_FAIL*/ {"ERROR: verification failed; original files were restored.", "ОШИБКА: проверка не прошла; оригинальные файлы восстановлены."},
 /*NEXT*/ {"After a Steam game update, run this installer again.", "После обновления игры в Steam запустите установщик ещё раз."},
 /*RESTORED*/ {"game data restored", "данные игры восстановлены"},
 /*BYE*/ {"", ""},
 /*STEPDLL*/ {"Copying native module...", "Копирую нативный модуль..."},
 /*STEPJS*/ {"Patching game data (this is quick)...", "Встраиваю мод в данные игры (это быстро)..."},
 /*STALE*/ {"Note: the game files were updated by Steam since the previous install; starting clean.", "Примечание: файлы игры были обновлены Steam после прошлой установки; ставлю заново."},
};
static int g_lang = 0;
static const char* tr(int id) { return TXT[id][g_lang]; }

// ---------------- portable helpers ----------------
static void say(const char* s) { fputs(s, stdout); fputc('\n', stdout); fflush(stdout); }
#ifdef _WIN32
static wchar_t* u8w(const char* s) {
    int n = MultiByteToWideChar(CP_UTF8, 0, s, -1, NULL, 0);
    wchar_t* w = (wchar_t*)malloc((size_t)(n ? n : 1) * sizeof(wchar_t));
    if (n) MultiByteToWideChar(CP_UTF8, 0, s, -1, w, n); else w[0] = 0;
    return w;
}
static char* w2u8(const wchar_t* w) {
    int n = WideCharToMultiByte(CP_UTF8, 0, w, -1, NULL, 0, NULL, NULL);
    char* s = (char*)malloc((size_t)(n ? n : 1));
    if (n) WideCharToMultiByte(CP_UTF8, 0, w, -1, s, n, NULL, NULL); else s[0] = 0;
    return s;
}
static FILE* fopen_u8(const char* p, const char* mode) {
    wchar_t* wp = u8w(p); wchar_t* wm = u8w(mode);
    FILE* f = _wfopen(wp, wm); free(wp); free(wm); return f;
}
static int remove_u8(const char* p) { wchar_t* w = u8w(p); int r = _wremove(w); free(w); return r; }
#else
static FILE* fopen_u8(const char* p, const char* mode) { return fopen(p, mode); }
static int remove_u8(const char* p) { return remove(p); }
#endif

static char* path_join(const char* a, const char* b) {
    size_t la = strlen(a), lb = strlen(b);
    char* r = (char*)malloc(la + lb + 2);
    memcpy(r, a, la);
    size_t n = la;
    if (n && r[n - 1] != '/' && r[n - 1] != '\\') r[n++] = SEP;
    memcpy(r + n, b, lb + 1);
    return r;
}
static int file_exists(const char* p) { FILE* f = fopen_u8(p, "rb"); if (!f) return 0; fclose(f); return 1; }
static int truncate_file(FILE* f, int64_t len) {
    fflush(f);
#ifdef _WIN32
    return _chsize_s(_fileno(f), len);
#else
    return ftruncate(fileno(f), (off_t)len);
#endif
}
static void sync_file(FILE* f) {
    fflush(f);
#ifdef _WIN32
    _commit(_fileno(f));
#else
    fsync(fileno(f));
#endif
}
static uint64_t be64(const unsigned char* p) { uint64_t v = 0; for (int i = 0; i < 8; i++) v = (v << 8) | p[i]; return v; }
static void put64(unsigned char* p, uint64_t v) { for (int i = 7; i >= 0; i--) { p[i] = (unsigned char)(v & 0xFF); v >>= 8; } }
static uint32_t be32(const unsigned char* p) { return ((uint32_t)p[0] << 24) | ((uint32_t)p[1] << 16) | ((uint32_t)p[2] << 8) | p[3]; }

// ---------------- c3ab container ----------------
typedef struct {
    FILE* f; int64_t size; uint64_t dirsize; uint32_t n; int64_t base;
    unsigned char* dir; int64_t target_dirpos; uint64_t off, sz; int have_target;
    int64_t blob_pos; uint64_t blob_len;
} Cont;

static int cont_open(Cont* c, const char* path, int* locked) {
    memset(c, 0, sizeof(*c));
    if (locked) *locked = 0;
    c->f = fopen_u8(path, "r+b");
    if (!c->f) { if (locked) *locked = 1; return 0; }
    unsigned char h[32];
    if (fread(h, 1, 32, c->f) != 32 || memcmp(h, "c3ab", 4) != 0 || memcmp(h + 16, "fdir", 4) != 0) { fclose(c->f); c->f = NULL; return -1; }
    c->dirsize = be64(h + 20); c->n = be32(h + 28);
    if (c->dirsize < 8 || c->dirsize > (64u << 20) || c->n > 5000000) { fclose(c->f); c->f = NULL; return -1; }
    c->dir = (unsigned char*)malloc((size_t)c->dirsize);
    if (!c->dir || fread(c->dir, 1, (size_t)c->dirsize, c->f) != c->dirsize) { fclose(c->f); c->f = NULL; free(c->dir); return -1; }
    if (memcmp(c->dir + c->dirsize - 4, "blob", 4) != 0) { fclose(c->f); c->f = NULL; free(c->dir); return -1; }
    c->base = 32 + (int64_t)c->dirsize + 8;
    FSEEK(c->f, 0, SEEK_END); c->size = FTELL(c->f);
    c->blob_pos = 32 + (int64_t)c->dirsize;
    FSEEK(c->f, c->blob_pos, SEEK_SET);
    unsigned char b[8]; if (fread(b, 1, 8, c->f) != 8) { fclose(c->f); c->f = NULL; free(c->dir); return -1; }
    c->blob_len = be64(b);
    size_t pos = 0; const size_t tl = strlen(TARGET);
    for (uint32_t i = 0; i < c->n; i++) {
        if (pos + 37 > c->dirsize - 4) { fclose(c->f); c->f = NULL; free(c->dir); return -1; }
        unsigned nl = c->dir[pos + 36];
        if (pos + 37 + nl > c->dirsize - 4) { fclose(c->f); c->f = NULL; free(c->dir); return -1; }
        if (nl == tl && memcmp(c->dir + pos + 37, TARGET, tl) == 0) {
            c->have_target = 1; c->target_dirpos = 32 + (int64_t)pos;
            c->off = be64(c->dir + pos + 8); c->sz = be64(c->dir + pos + 16);
        }
        pos += 37 + nl;
    }
    return 1;
}
static void cont_close(Cont* c) { if (c->f) fclose(c->f); free(c->dir); memset(c, 0, sizeof(*c)); }
static int cont_set_entry(Cont* c, uint64_t off, uint64_t size) {
    unsigned char b[24]; put64(b, off); put64(b + 8, size); put64(b + 16, size);
    if (FSEEK(c->f, c->target_dirpos + 8, SEEK_SET) != 0) return 0;
    if (fwrite(b, 1, 24, c->f) != 24) return 0;
    return 1;
}
static int cont_set_blob(Cont* c, uint64_t v) {
    unsigned char b[8]; put64(b, v);
    if (FSEEK(c->f, c->blob_pos, SEEK_SET) != 0) return 0;
    return fwrite(b, 1, 8, c->f) == 8;
}
static unsigned char* cont_read(Cont* c, uint64_t off, uint64_t size) {
    unsigned char* b = (unsigned char*)malloc((size_t)size + 1);
    if (!b) return NULL;
    if (FSEEK(c->f, c->base + (int64_t)off, SEEK_SET) != 0 || fread(b, 1, (size_t)size, c->f) != size) { free(b); return NULL; }
    return b;
}

// ---------------- state file (same keys as patcher.py) ----------------
typedef struct { uint64_t orig_off, orig_size, orig_len, orig_blob, blob_pos, new_off, new_size; int valid; } State;
static int json_u64(const char* txt, const char* key, uint64_t* out) {
    char pat[64]; snprintf(pat, sizeof(pat), "\"%s\":", key);
    const char* p = strstr(txt, pat); if (!p) return 0;
    p += strlen(pat); while (*p == ' ') p++;
    if (!isdigit((unsigned char)*p)) return 0;
    *out = (uint64_t)strtoull(p, NULL, 10); return 1;
}
static State state_load(const char* gamedir) {
    State s; memset(&s, 0, sizeof(s));
    char* p = path_join(gamedir, STATE_NAME);
    FILE* f = fopen_u8(p, "rb"); free(p);
    if (!f) return s;
    char buf[4096]; size_t n = fread(buf, 1, sizeof(buf) - 1, f); buf[n] = 0; fclose(f);
    s.valid = json_u64(buf, "orig_off", &s.orig_off) && json_u64(buf, "orig_size", &s.orig_size) && json_u64(buf, "orig_len", &s.orig_len) &&
              json_u64(buf, "orig_blob", &s.orig_blob) && json_u64(buf, "blob_pos", &s.blob_pos) && json_u64(buf, "new_off", &s.new_off) && json_u64(buf, "new_size", &s.new_size);
    return s;
}
static int state_save(const char* gamedir, const State* s) {
    char* p = path_join(gamedir, STATE_NAME);
    FILE* f = fopen_u8(p, "wb"); free(p);
    if (!f) return 0;
    fprintf(f, "{\n \"tool\": \"dtmod-setup " VERSION "\",\n \"target\": \"" TARGET "\",\n \"orig_off\": %llu,\n \"orig_size\": %llu,\n \"orig_len\": %llu,\n \"orig_blob\": %llu,\n \"blob_pos\": %llu,\n \"new_off\": %llu,\n \"new_size\": %llu\n}\n",
            (unsigned long long)s->orig_off, (unsigned long long)s->orig_size, (unsigned long long)s->orig_len, (unsigned long long)s->orig_blob,
            (unsigned long long)s->blob_pos, (unsigned long long)s->new_off, (unsigned long long)s->new_size);
    fclose(f); return 1;
}
static void state_delete(const char* gamedir) { char* p = path_join(gamedir, STATE_NAME); remove_u8(p); free(p); }

static int is_patched(const Cont* c, const State* s) { return s->valid && c->have_target && c->off == s->new_off && c->sz == s->new_size; }

// restore the container to the state recorded in `s` (entry + blob length + truncate)
static int restore_container(Cont* c, const State* s) {
    if (is_patched(c, s)) {
        if (!cont_set_entry(c, s->orig_off, s->orig_size) || !cont_set_blob(c, s->orig_blob)) return 0;
        sync_file(c->f);
        if (truncate_file(c->f, (int64_t)s->orig_len) != 0) return 0;
        sync_file(c->f);
        return 1;
    }
    // not patched: remove an orphan tail left by an interrupted patch
    if (s->valid && c->have_target && c->off == s->orig_off && (uint64_t)c->size > s->orig_len) {
        if (truncate_file(c->f, (int64_t)s->orig_len) != 0) return 0;
        sync_file(c->f);
    }
    return 1;
}

// ---------------- operations ----------------
static int do_status(const char* gamedir, const char* apath) {
    Cont c; int locked; int r = cont_open(&c, apath, &locked);
    if (r <= 0) { say(locked ? tr(M_CLOSEGAME) : tr(M_BADFMT)); return 1; }
    State s = state_load(gamedir);
    int on = is_patched(&c, &s);
    say(on ? tr(M_STATUS_ON) : tr(M_STATUS_OFF));
    cont_close(&c);
    return 0;
}

static int do_uninstall(const char* gamedir, const char* apath, int quiet) {
    State s = state_load(gamedir);
    char* dll = path_join(gamedir, DLL_NAME);
    if (!s.valid) {
        if (!quiet) say(tr(M_NOSTATE));
        if (file_exists(dll)) { remove_u8(dll); }
        free(dll); return 0;
    }
    Cont c; int locked; int r = cont_open(&c, apath, &locked);
    if (r <= 0) { say(locked ? tr(M_CLOSEGAME) : tr(M_BADFMT)); free(dll); return 1; }
    if (!restore_container(&c, &s)) { say(tr(M_CLOSEGAME)); cont_close(&c); free(dll); return 1; }
    cont_close(&c);
    state_delete(gamedir);
    if (file_exists(dll)) remove_u8(dll);
    free(dll);
    if (!quiet) say(tr(M_OK_UNINST));
    return 0;
}

static int do_install(const char* gamedir, const char* apath) {
    State s = state_load(gamedir);
    Cont c; int locked; int r = cont_open(&c, apath, &locked);
    if (r <= 0) { say(locked ? tr(M_CLOSEGAME) : tr(M_BADFMT)); return 1; }
    if (s.valid) {
        if (is_patched(&c, &s)) {
            say(tr(M_ALREADY));
            if (!restore_container(&c, &s)) { say(tr(M_CLOSEGAME)); cont_close(&c); return 1; }
            cont_close(&c);
            r = cont_open(&c, apath, &locked);
            if (r <= 0) { say(locked ? tr(M_CLOSEGAME) : tr(M_BADFMT)); return 1; }
        } else {
            say(tr(M_STALE));
            if (!restore_container(&c, &s)) { say(tr(M_CLOSEGAME)); cont_close(&c); return 1; }   // removes an orphan tail if any
            cont_close(&c);
            r = cont_open(&c, apath, &locked);
            if (r <= 0) { say(locked ? tr(M_CLOSEGAME) : tr(M_BADFMT)); return 1; }
        }
        state_delete(gamedir);
    }
    if (!c.have_target || c.sz == 0 || c.sz > 100000) { say(tr(M_UNSUPPORTED)); cont_close(&c); return 1; }
    if (c.blob_len != (uint64_t)(c.size - c.base)) { say(tr(M_BADFMT)); cont_close(&c); return 1; }
    unsigned char* orig = cont_read(&c, c.off, c.sz);
    if (!orig) { say(tr(M_BADFMT)); cont_close(&c); return 1; }
    if (strstr((const char*)orig, "__DTMOD__")) { say(tr(M_UNSUPPORTED)); free(orig); cont_close(&c); return 1; }

    say(tr(M_STEPDLL));
    char* dll = path_join(gamedir, DLL_NAME);
    FILE* df = fopen_u8(dll, "wb");
    if (!df || fwrite(DTMOD_DLL, 1, DTMOD_DLL_LEN, df) != DTMOD_DLL_LEN) { if (df) fclose(df); say(tr(M_FAIL_DLL)); free(dll); free(orig); cont_close(&c); return 1; }
    fclose(df); free(dll);

    say(tr(M_STEPJS));
    static const char sep[] = "\n;";
    size_t plen = (size_t)c.sz + 2 + DTMOD_JS_LEN + 1;
    unsigned char* payload = (unsigned char*)malloc(plen);
    memcpy(payload, orig, (size_t)c.sz); memcpy(payload + c.sz, sep, 2); memcpy(payload + c.sz + 2, DTMOD_JS, DTMOD_JS_LEN); payload[plen - 1] = '\n';
    State ns; memset(&ns, 0, sizeof(ns));
    ns.orig_off = c.off; ns.orig_size = c.sz; ns.orig_len = (uint64_t)c.size; ns.orig_blob = c.blob_len; ns.blob_pos = (uint64_t)c.blob_pos;
    ns.new_off = (uint64_t)(c.size - c.base); ns.new_size = plen; ns.valid = 1;
    if (!state_save(gamedir, &ns)) { say(tr(M_FAIL_DLL)); free(payload); free(orig); cont_close(&c); return 1; }   // state first: a crash can always be undone
    int ok = FSEEK(c.f, c.size, SEEK_SET) == 0 && fwrite(payload, 1, plen, c.f) == plen;
    if (ok) { sync_file(c.f); ok = cont_set_entry(&c, ns.new_off, ns.new_size) && cont_set_blob(&c, c.blob_len + plen); sync_file(c.f); }
    free(orig);
    cont_close(&c);
    if (ok) {   // verify by re-reading
        Cont v; int l2; if (cont_open(&v, apath, &l2) > 0) {
            ok = v.have_target && v.off == ns.new_off && v.sz == ns.new_size && v.blob_len == (uint64_t)(v.size - v.base);
            if (ok) { unsigned char* back = cont_read(&v, v.off, v.sz); ok = back && memcmp(back, payload, plen) == 0; free(back); }
            if (!ok) { State s2 = ns; restore_container(&v, &s2); }
            cont_close(&v);
        } else ok = 0;
    }
    free(payload);
    if (!ok) {
        Cont v; int l2; if (cont_open(&v, apath, &l2) > 0) { restore_container(&v, &ns); cont_close(&v); }
        state_delete(gamedir);
        say(tr(M_VERIFY_FAIL)); return 1;
    }
    say(tr(M_OK_INST)); say(tr(M_NEXT));
    return 0;
}

// ---------------- game discovery ----------------
static char* trim_eol(char* s) { size_t n = strlen(s); while (n && (s[n - 1] == '\n' || s[n - 1] == '\r' || s[n - 1] == ' ' || s[n - 1] == '"')) s[--n] = 0; return s; }
static int check_game(const char* dir) {
    char* a = path_join(dir, "www"); char* b = path_join(a, "assets.dat"); int ok = file_exists(b); free(a); free(b); return ok;
}
static char* try_library(const char* lib) {
    char* a = path_join(lib, "steamapps"); char* b = path_join(a, "common"); char* c = path_join(b, "Devices Tycoon");
    free(a); free(b);
    if (check_game(c)) return c;
    free(c); return NULL;
}
static char* find_game_from_steam(const char* steam) {
    char* r = try_library(steam); if (r) return r;
    char* a = path_join(steam, "steamapps"); char* v = path_join(a, "libraryfolders.vdf"); free(a);
    FILE* f = fopen_u8(v, "rb"); free(v);
    if (!f) return NULL;
    char line[2048];
    while (fgets(line, sizeof(line), f)) {
        char* p = strstr(line, "\"path\"");
        if (!p) continue;
        p += 6;
        char* q = strchr(p, '"'); if (!q) continue;
        q++;
        char* e = strrchr(q, '"'); if (!e) continue;
        *e = 0;
        // unescape \\ -> \ (VDF)
        char* w = q; for (char* rd = q; *rd; rd++) { if (rd[0] == '\\' && rd[1] == '\\') rd++; *w++ = *rd; } *w = 0;
        r = try_library(q);
        if (r) { fclose(f); return r; }
    }
    fclose(f);
    return NULL;
}
#ifdef _WIN32
static char* reg_str(HKEY root, const wchar_t* sub, const wchar_t* val) {
    HKEY k; if (RegOpenKeyExW(root, sub, 0, KEY_READ | KEY_WOW64_32KEY, &k) != ERROR_SUCCESS) return NULL;
    wchar_t buf[1024]; DWORD sz = sizeof(buf), type = 0;
    LONG rc = RegQueryValueExW(k, val, NULL, &type, (LPBYTE)buf, &sz); RegCloseKey(k);
    if (rc != ERROR_SUCCESS || type != REG_SZ) return NULL;
    buf[1023] = 0; return w2u8(buf);
}
#endif
static char* find_game(void) {
    char* steam = NULL; char* r = NULL;
#ifdef _WIN32
    steam = reg_str(HKEY_CURRENT_USER, L"Software\\Valve\\Steam", L"SteamPath");
    if (steam) { r = find_game_from_steam(steam); free(steam); if (r) return r; }
    steam = reg_str(HKEY_LOCAL_MACHINE, L"SOFTWARE\\Valve\\Steam", L"InstallPath");
    if (steam) { r = find_game_from_steam(steam); free(steam); if (r) return r; }
    const char* defs[] = { "C:\\Program Files (x86)\\Steam", "C:\\Program Files\\Steam", "D:\\Steam", "D:\\SteamLibrary", "E:\\SteamLibrary", "F:\\SteamLibrary", NULL };
    for (int i = 0; defs[i]; i++) { r = find_game_from_steam(defs[i]); if (r) return r; }
#endif
    (void)steam;
    return r;
}

// ---------------- main ----------------
static void pause_exit(int quiet) { if (quiet) return; fputs(tr(M_PRESS), stdout); fflush(stdout); char b[16]; if (!fgets(b, sizeof(b), stdin)) { /* ignore */ } }

int main(int argc, char** argv) {
#ifdef _WIN32
    SetConsoleOutputCP(CP_UTF8);
    g_lang = ((GetUserDefaultUILanguage() & 0xFF) == 0x19) ? 1 : 0;      // LANG_RUSSIAN
#else
    { const char* l = getenv("LANG"); g_lang = (l && strncmp(l, "ru", 2) == 0) ? 1 : 0; }
#endif
    const char* cmd = NULL; char* game = NULL; int quiet = 0;
    for (int i = 1; i < argc; i++) {
        if (!strcmp(argv[i], "--install") || !strcmp(argv[i], "/install")) cmd = "install";
        else if (!strcmp(argv[i], "--uninstall") || !strcmp(argv[i], "/uninstall")) cmd = "uninstall";
        else if (!strcmp(argv[i], "--status") || !strcmp(argv[i], "/status")) cmd = "status";
        else if (!strcmp(argv[i], "--quiet") || !strcmp(argv[i], "/quiet")) quiet = 1;
        else if (!strcmp(argv[i], "--lang=ru")) g_lang = 1;
        else if (!strcmp(argv[i], "--lang=en")) g_lang = 0;
        else if (!strcmp(argv[i], "--game") && i + 1 < argc) game = _strdup(argv[++i]);
        else if (!game && argv[i][0] != '-' && argv[i][0] != '/') game = _strdup(argv[i]);
    }
    say(tr(M_TITLE)); say("");
    if (game) { while (strlen(game) && (game[strlen(game) - 1] == '\\' || game[strlen(game) - 1] == '/' || game[strlen(game) - 1] == '"')) game[strlen(game) - 1] = 0; }
    if (game && !check_game(game)) { free(game); game = NULL; }
    if (!game) game = find_game();
    while (!game) {
        say(tr(M_NOTFOUND));
        if (quiet) return 2;
        fputs(tr(M_ASKPATH), stdout); fflush(stdout);
        char buf[1024]; if (!fgets(buf, sizeof(buf), stdin)) return 2;
        trim_eol(buf); char* s = buf; while (*s == '"') s++;
        if (!*s) return 2;
        if (check_game(s)) game = _strdup(s);
    }
    printf("%s %s\n", tr(M_FOUND), game); fflush(stdout);
    char* a1 = path_join(game, "www"); char* apath = path_join(a1, "assets.dat"); free(a1);
    int rc = 0;
    if (cmd) {
        rc = !strcmp(cmd, "install") ? do_install(game, apath) : !strcmp(cmd, "uninstall") ? do_uninstall(game, apath, 0) : do_status(game, apath);
        pause_exit(quiet);
    } else {
        for (;;) {
            fputs(tr(M_MENU), stdout); fputs(tr(M_CHOICE), stdout); fflush(stdout);
            char b[32]; if (!fgets(b, sizeof(b), stdin)) break;
            if (b[0] == '1') { rc = do_install(game, apath); pause_exit(0); break; }
            if (b[0] == '2') { rc = do_uninstall(game, apath, 0); pause_exit(0); break; }
            if (b[0] == '3') { do_status(game, apath); continue; }
            if (b[0] == '0') break;
        }
    }
    free(game); free(apath);
    return rc;
}
