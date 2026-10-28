// DTMod native module (Construct WebView2 wrapper extension, SDK v2), plain C.
// Provides Steam lobbies for the Devices Tycoon co-op mod using ONLY the flat C exports of
// steam_api64.dll that the game already ships and has already initialised (via Scirra's Steam ext).
// No Steamworks SDK headers are needed. All Steam calls happen on the game's UI thread
// (driven by the JS "tick" message), so no extra threading.
//
// JS -> DLL : chrome.webview.postMessage({type:"extension-message", componentId:"dtmod", messageId, params:[...], asyncId:-1})
// DLL -> JS : SendWebMessage("evt", {json:"<json event>"})
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdio.h>
#include <stdint.h>
#include <stdarg.h>
#include <stdlib.h>
#include <string.h>
#include <wchar.h>

#define DTMOD_VERSION "0.8"
#define COMPONENT_ID "dtmod"
#define GAME_APPID 2085660u
#define MAX_VALUE_BYTES 7800
#define MAX_PEND 6

// ================= Wrapper SDK ABI (IExtension.h / IApplication.h, SDK v2) =================
typedef enum { EPT_Boolean, EPT_Number, EPT_String, EPT_Invalid, EPT_ForceDword = 0x7FFFFFFF } ParamType;
typedef struct { ParamType type; double number; LPCSTR str; } ParamPOD;
typedef struct { LPCSTR key; ParamPOD value; } NamedParamPOD;

typedef struct IApplication IApplication;
typedef struct {
    int  (*RegisterComponentId)(IApplication*, LPCSTR);
    void (*SendWebMessage)(IApplication*, LPCSTR, size_t, const NamedParamPOD*, double);
    LPCSTR (*GetAppFolder)(IApplication*);
    LPCSTR (*GetWebResourceFolder)(IApplication*);
    LPCSTR (*GetCurrentAppDataFolder)(IApplication*);
    void (*SetSdkVersion)(IApplication*, int);
    void (*SetSharedPtr)(IApplication*, LPCSTR, void*);
    void*(*GetSharedPtr)(IApplication*, LPCSTR);
    void (*RemoveSharedPtr)(IApplication*, LPCSTR);
} IApplicationVtbl;
struct IApplication { const IApplicationVtbl* vt; };

typedef struct IExtension IExtension;
typedef struct {
    void (*Release)(IExtension*);
    void (*OnWebMessage)(IExtension*, LPCSTR, size_t, const ParamPOD*, double);
    void (*OnMainWindowCreated)(IExtension*, HWND);
    void (*Init)(IExtension*);
} IExtensionVtbl;
struct IExtension { const IExtensionVtbl* vt; };

static IApplication* g_app = NULL;
static HMODULE g_self = NULL;
static char g_logPath[MAX_PATH] = "dtmod.log";

static void logf_(const char* fmt, ...) {
    FILE* f = fopen(g_logPath, "a");
    if (!f) return;
    SYSTEMTIME st; GetLocalTime(&st);
    fprintf(f, "[%02d:%02d:%02d.%03d] ", st.wHour, st.wMinute, st.wSecond, st.wMilliseconds);
    va_list ap; va_start(ap, fmt); vfprintf(f, fmt, ap); va_end(ap);
    fputc('\n', f);
    fclose(f);
}

// ================= Small JSON string builder (with UTF-8 sanitising) =================
typedef struct { char* p; size_t n, cap; } SB;
static void sb_init(SB* b) { b->cap = 512; b->n = 0; b->p = (char*)malloc(b->cap); if (b->p) b->p[0] = 0; }
static void sb_free(SB* b) { free(b->p); b->p = NULL; b->n = b->cap = 0; }
static void sb_grow(SB* b, size_t need) {
    if (!b->p) return;
    if (b->n + need + 1 <= b->cap) return;
    size_t nc = b->cap * 2; while (nc < b->n + need + 1) nc *= 2;
    char* np = (char*)realloc(b->p, nc);
    if (!np) { free(b->p); b->p = NULL; b->n = b->cap = 0; return; }
    b->p = np; b->cap = nc;
}
static void sb_putc(SB* b, char c) { sb_grow(b, 1); if (!b->p) return; b->p[b->n++] = c; b->p[b->n] = 0; }
static void sb_puts(SB* b, const char* s) { size_t l = strlen(s); sb_grow(b, l); if (!b->p) return; memcpy(b->p + b->n, s, l); b->n += l; b->p[b->n] = 0; }
static void sb_fmt(SB* b, const char* fmt, ...) {
    char tmp[256]; va_list ap; va_start(ap, fmt); vsnprintf(tmp, sizeof(tmp), fmt, ap); va_end(ap); sb_puts(b, tmp);
}
// JSON-quoted string; invalid UTF-8 bytes are replaced with '?', so the host's JSON layer never sees bad UTF-8.
static void sb_str(SB* b, const char* s) {
    const unsigned char* u = (const unsigned char*)(s ? s : "");
    sb_putc(b, '"');
    while (*u) {
        unsigned c = *u;
        if (c == '"' || c == '\\') { sb_putc(b, '\\'); sb_putc(b, (char)c); u++; }
        else if (c < 0x20) { char t[8]; snprintf(t, sizeof(t), "\\u%04x", c); sb_puts(b, t); u++; }
        else if (c < 0x80) { sb_putc(b, (char)c); u++; }
        else {
            int len = 0; unsigned cp = 0;
            if ((c & 0xE0) == 0xC0) { len = 2; cp = c & 0x1F; }
            else if ((c & 0xF0) == 0xE0) { len = 3; cp = c & 0x0F; }
            else if ((c & 0xF8) == 0xF0) { len = 4; cp = c & 0x07; }
            int ok = len > 0;
            for (int i = 1; ok && i < len; i++) {
                if ((u[i] & 0xC0) != 0x80) ok = 0; else cp = (cp << 6) | (u[i] & 0x3F);
            }
            if (ok) {
                if (len == 2 && cp < 0x80) ok = 0;
                if (len == 3 && (cp < 0x800 || (cp >= 0xD800 && cp <= 0xDFFF))) ok = 0;
                if (len == 4 && (cp < 0x10000 || cp > 0x10FFFF)) ok = 0;
            }
            if (ok) { for (int i = 0; i < len; i++) sb_putc(b, (char)u[i]); u += len; }
            else { sb_putc(b, '?'); u++; }
        }
    }
    sb_putc(b, '"');
}
static void sb_id(SB* b, uint64_t id) { char t[32]; snprintf(t, sizeof(t), "\"%llu\"", (unsigned long long)id); sb_puts(b, t); }

// ================= Steam flat API, resolved at run time =================
typedef struct {
    HMODULE dll; int ready;
    void *user, *fr, *mm, *ut;
    int      (__cdecl *GetHSteamUser)(void);
    uint64_t (__cdecl *GetSteamID)(void*);
    uint32_t (__cdecl *GetAppID)(void*);
    uint8_t  (__cdecl *IsCallDone)(void*, uint64_t, uint8_t*);
    uint8_t  (__cdecl *GetCallResult)(void*, uint64_t, void*, int, int, uint8_t*);
    uint64_t (__cdecl *CreateLobby)(void*, int, int);
    uint64_t (__cdecl *JoinLobby)(void*, uint64_t);
    void     (__cdecl *LeaveLobby)(void*, uint64_t);
    uint64_t (__cdecl *RequestLobbyList)(void*);
    void     (__cdecl *AddStrFilter)(void*, const char*, const char*, int);
    void     (__cdecl *AddDistFilter)(void*, int);
    void     (__cdecl *AddCountFilter)(void*, int);
    uint64_t (__cdecl *GetLobbyByIndex)(void*, int);
    const char* (__cdecl *GetLobbyData)(void*, uint64_t, const char*);
    uint8_t  (__cdecl *SetLobbyData)(void*, uint64_t, const char*, const char*);
    int      (__cdecl *GetLobbyDataCount)(void*, uint64_t);
    uint8_t  (__cdecl *GetLobbyDataByIndex)(void*, uint64_t, int, char*, int, char*, int);
    int      (__cdecl *GetNumMembers)(void*, uint64_t);
    uint64_t (__cdecl *GetMemberByIndex)(void*, uint64_t, int);
    const char* (__cdecl *GetMemberData)(void*, uint64_t, uint64_t, const char*);
    void     (__cdecl *SetMemberData)(void*, uint64_t, const char*, const char*);
    uint64_t (__cdecl *GetLobbyOwner)(void*, uint64_t);
    uint8_t  (__cdecl *SetLobbyJoinable)(void*, uint64_t, int);
    uint8_t  (__cdecl *InviteToLobby)(void*, uint64_t, uint64_t);
    int      (__cdecl *GetFriendCount)(void*, int);
    uint64_t (__cdecl *GetFriendByIndex)(void*, int, int);
    const char* (__cdecl *GetFriendName)(void*, uint64_t);
    int      (__cdecl *GetFriendState)(void*, uint64_t);
    uint8_t  (__cdecl *GetFriendGame)(void*, uint64_t, void*);
    uint8_t  (__cdecl *SetRichPresence)(void*, const char*, const char*);
    void     (__cdecl *InviteDialog)(void*, uint64_t);
    uint8_t  (__cdecl *RequestUserInfo)(void*, uint64_t, int);
    void     (__cdecl *RunCallbacks)(void);
    void     (__cdecl *RegisterCallback)(void*, int);
    void     (__cdecl *UnregisterCallback)(void*);
} SteamApi;
static SteamApi S;
static uint64_t g_me = 0;

static const char* cs(const char* s) { return s ? s : ""; }

// ================= Manual CCallbackBase (hand-built vtable; works for either overload order) =================
typedef struct CB {
    const void* const* vt;   // Steam's CCallbackBase: vptr
    uint8_t flags;           // m_nCallbackFlags (set by Steam on register)
    int icb;                 // m_iCallback (set by Steam on register)
    int size;                // ours
    void (*fn)(void*);       // ours
} CB;
static void __cdecl cb_run(CB* self, void* pv, int ioFail, uint64_t call) { (void)ioFail; (void)call; if (self && self->fn && pv) self->fn(pv); }
static int  __cdecl cb_size(CB* self) { return self->size; }
// Both Run() overload slots point at the same 4-arg function, so it is correct whichever slot Steam calls
// (extra arguments are simply ignored under the x64 calling convention).
static const void* const g_cbvt[3] = { (const void*)cb_run, (const void*)cb_run, (const void*)cb_size };

// ================= State =================
static uint64_t g_lobby = 0;
static char* g_lastLobbyJson = NULL;
static char g_myName[128] = "";

enum { PK_NONE = 0, PK_CREATE, PK_LIST, PK_JOIN };
typedef struct { int kind; uint64_t call; DWORD t0; char name[160]; int type; int max; uint64_t jid; } Pend;
static Pend g_pend[MAX_PEND];

static CB g_cbJoinLobby, g_cbJoinRP;
static volatile uint64_t g_reqJoin = 0;     // set from callbacks, consumed on tick

// ================= Event emit =================
static void emit_sb(SB* b) {
    if (!b->p || !g_app) return;
    NamedParamPOD np;
    np.key = "json"; np.value.type = EPT_String; np.value.number = 0.0; np.value.str = b->p;
    g_app->vt->SendWebMessage(g_app, "evt", 1, &np, -1.0);
}
static void emit_t(const char* t) { SB b; sb_init(&b); sb_fmt(&b, "{\"t\":\"%s\"}", t); emit_sb(&b); sb_free(&b); }
static void emit_err(const char* where, const char* msg, int code) {
    SB b; sb_init(&b);
    sb_puts(&b, "{\"t\":\"error\",\"where\":"); sb_str(&b, where);
    sb_puts(&b, ",\"msg\":"); sb_str(&b, msg);
    sb_fmt(&b, ",\"code\":%d}", code);
    emit_sb(&b); sb_free(&b);
    logf_("ERROR %s: %s (%d)", where, msg, code);
}

// ================= Helpers =================
static uint64_t parse_u64(const char* s) { return s ? (uint64_t)_strtoui64(s, NULL, 10) : 0; }
static int valid_key(const char* k) {
    size_t n = k ? strlen(k) : 0;
    if (n == 0 || n > 32) return 0;
    for (size_t i = 0; i < n; i++) { char c = k[i]; if (!((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '_')) return 0; }
    return 1;
}
static const char* name_of(uint64_t id) {
    const char* n = S.GetFriendName(S.fr, id);
    if (!n || !*n) { S.RequestUserInfo(S.fr, id, 1); return ""; }
    return n;
}

// ================= Rich presence =================
static void update_presence(int members, int maxm) {
    if (!S.ready) return;
    if (g_lobby) {
        char tmp[96];
        snprintf(tmp, sizeof(tmp), "+connect_lobby %llu", (unsigned long long)g_lobby);
        S.SetRichPresence(S.fr, "connect", tmp);
        snprintf(tmp, sizeof(tmp), "Co-op lobby (%d/%d)", members, maxm);
        S.SetRichPresence(S.fr, "status", tmp);
    } else {
        S.SetRichPresence(S.fr, "connect", NULL);
        S.SetRichPresence(S.fr, "status", NULL);
    }
}

// ================= Voice chat =================
// Capture + Opus-style compression: Steam's own voice API (ISteamUser). Transport: lobby chat messages (<=4 KB, every ~60-120 ms).
// Playback: one waveOut device per remote speaker (mixed by Windows). Everything runs on the thread that delivers "tick"/"vtick".
#include <mmsystem.h>
typedef struct {
    void     (__cdecl *StartRec)(void*);
    void     (__cdecl *StopRec)(void*);
    int      (__cdecl *GetAvail)(void*, uint32_t*, uint32_t*, uint32_t);
    int      (__cdecl *GetVoice)(void*, uint8_t, void*, uint32_t, uint32_t*, uint8_t, void*, uint32_t, uint32_t*, uint32_t);
    int      (__cdecl *Decomp)(void*, const void*, uint32_t, void*, uint32_t, uint32_t*, uint32_t);
    uint32_t (__cdecl *OptRate)(void*);
    uint8_t  (__cdecl *SendChat)(void*, uint64_t, const void*, int);
    int      (__cdecl *GetChat)(void*, uint64_t, int, uint64_t*, void*, int, int*);
} VoiceApi;
static VoiceApi V;
static int g_voiceOk = 0;
static int g_vrec = 0, g_vloop = 0, g_vvol = 100, g_vdeaf = 0;
static uint32_t g_vrate = 24000;
static DWORD g_vlastTx = 0, g_vlastStat = 0;
static unsigned g_vPolls = 0, g_vNoData = 0; static int g_vLastR = -1;
static unsigned g_vtxMsgs = 0, g_vtxBytes = 0, g_vrxMsgs = 0, g_vrxDec = 0, g_vErrLog = 0;
static uint64_t g_vmuted[8];
static CB g_cbChat;
static SRWLOCK g_vlock = SRWLOCK_INIT;
static uint32_t g_vcq[128]; static int g_vcqh = 0, g_vcqt = 0;
static char g_vlastSpeak[200] = "";
static int g_vlastMic = -1;

#define VMAX_SPK 6
#define VQ 20
typedef struct { uint64_t id; HWAVEOUT h; WAVEHDR hdr[VQ]; char* data[VQ]; int used[VQ]; int nq; int paused; int open; DWORD lastRx, firstQ; } Spk;
static Spk g_spk[VMAX_SPK];

static int vmuted(uint64_t id) { for (int i = 0; i < 8; i++) if (g_vmuted[i] == id) return 1; return 0; }
static void vset_muted(uint64_t id, int on) {
    for (int i = 0; i < 8; i++) if (g_vmuted[i] == id) { if (!on) g_vmuted[i] = 0; return; }
    if (on) for (int i = 0; i < 8; i++) if (!g_vmuted[i]) { g_vmuted[i] = id; return; }
}
static void spk_reclaim(Spk* s) {
    for (int i = 0; i < VQ; i++) if (s->used[i] && (s->hdr[i].dwFlags & WHDR_DONE)) {
        waveOutUnprepareHeader(s->h, &s->hdr[i], sizeof(WAVEHDR)); free(s->data[i]); s->data[i] = NULL; s->used[i] = 0; s->nq--;
    }
}
static void spk_close(Spk* s) {
    if (!s->open) return;
    waveOutReset(s->h);
    for (int k = 0; k < 20; k++) { spk_reclaim(s); if (s->nq <= 0) break; Sleep(5); }
    for (int i = 0; i < VQ; i++) if (s->used[i]) { waveOutUnprepareHeader(s->h, &s->hdr[i], sizeof(WAVEHDR)); free(s->data[i]); s->used[i] = 0; }
    s->nq = 0; waveOutClose(s->h); s->open = 0; s->id = 0;
}
static Spk* spk_for(uint64_t id) {
    Spk* free_ = NULL; Spk* oldest = NULL;
    for (int i = 0; i < VMAX_SPK; i++) {
        Spk* s = &g_spk[i];
        if (s->open && s->id == id) return s;
        if (!s->open && !free_) free_ = s;
        if (s->open && (!oldest || s->lastRx < oldest->lastRx)) oldest = s;
    }
    Spk* s = free_;
    if (!s) { s = oldest; if (!s) return NULL; spk_close(s); }
    WAVEFORMATEX f; memset(&f, 0, sizeof(f));
    f.wFormatTag = WAVE_FORMAT_PCM; f.nChannels = 1; f.nSamplesPerSec = g_vrate; f.wBitsPerSample = 16;
    f.nBlockAlign = 2; f.nAvgBytesPerSec = g_vrate * 2;
    MMRESULT mr = waveOutOpen(&s->h, WAVE_MAPPER, &f, 0, 0, CALLBACK_NULL);
    if (mr != MMSYSERR_NOERROR) { if (g_vErrLog++ < 5) logf_("voice: waveOutOpen failed %u", (unsigned)mr); return NULL; }
    memset(s->used, 0, sizeof(s->used)); s->nq = 0; s->open = 1; s->id = id; s->paused = 1; s->firstQ = 0; s->lastRx = GetTickCount();
    waveOutPause(s->h);
    logf_("voice: opened speaker for %llu @%u Hz", (unsigned long long)id, (unsigned)g_vrate);
    return s;
}
static int spk_queued_ms(Spk* s) {
    unsigned bytes = 0;
    for (int i = 0; i < VQ; i++) if (s->used[i] && !(s->hdr[i].dwFlags & WHDR_DONE)) bytes += s->hdr[i].dwBufferLength;
    return (int)(bytes * 1000u / (g_vrate * 2u));
}
static void spk_queue(Spk* s, const void* pcm, unsigned n) {
    int slot = -1; for (int i = 0; i < VQ; i++) if (!s->used[i]) { slot = i; break; }
    if (slot < 0 || n == 0) return;                       // queue full: drop
    char* d = (char*)malloc(n); if (!d) return; memcpy(d, pcm, n);
    WAVEHDR* h = &s->hdr[slot]; memset(h, 0, sizeof(*h)); h->lpData = d; h->dwBufferLength = n;
    if (waveOutPrepareHeader(s->h, h, sizeof(*h)) != MMSYSERR_NOERROR) { free(d); return; }
    if (waveOutWrite(s->h, h, sizeof(*h)) != MMSYSERR_NOERROR) { waveOutUnprepareHeader(s->h, h, sizeof(*h)); free(d); return; }
    s->data[slot] = d; s->used[slot] = 1; s->nq++;
    s->lastRx = GetTickCount();
    if (s->paused) {
        if (!s->firstQ) s->firstQ = s->lastRx;
        if (spk_queued_ms(s) >= 120) { waveOutRestart(s->h); s->paused = 0; s->firstQ = 0; }
    }
}
static void voice_stop_mic(void) { if (g_vrec) { V.StopRec(S.user); g_vrec = 0; logf_("voice: mic off (tx %u msgs / %u bytes)", g_vtxMsgs, g_vtxBytes); } }
static void voice_reset(void) {
    voice_stop_mic();
    for (int i = 0; i < VMAX_SPK; i++) spk_close(&g_spk[i]);
    AcquireSRWLockExclusive(&g_vlock); g_vcqh = g_vcqt = 0; ReleaseSRWLockExclusive(&g_vlock);
    g_vlastSpeak[0] = 0; g_vlastMic = -1;
}
static void on_lobby_chat(void* pv) {                    // LobbyChatMsg_t: lobby(8) user(8) type(1) pad chatID(u32 @20)
    if (!g_voiceOk || !pv) return;
    uint64_t lobby = *(uint64_t*)pv; uint32_t id = *(uint32_t*)((char*)pv + 20);
    if (!g_lobby || lobby != g_lobby) return;
    AcquireSRWLockExclusive(&g_vlock);
    int nt = (g_vcqt + 1) % 128; if (nt != g_vcqh) { g_vcq[g_vcqt] = id; g_vcqt = nt; }
    ReleaseSRWLockExclusive(&g_vlock);
}
static void voice_transmit(void) {
    if (!g_vrec || !g_lobby) return;
    static uint8_t buf[8300];
    for (int loops = 0; loops < 4; loops++) {
        uint32_t avail = 0; int r = V.GetAvail(S.user, &avail, NULL, 0);
        g_vPolls++; g_vLastR = r; if (r != 0 || avail == 0) g_vNoData++;
        if (r != 0 || avail == 0) { if (r != 0 && r != 3 && g_vErrLog++ < 8) logf_("voice: GetAvailableVoice -> %d", r); break; }
        uint32_t w = 0; r = V.GetVoice(S.user, 1, buf + 3, 8000, &w, 0, NULL, 0, NULL, 0);
        if (r != 0 || w == 0) { if (r != 0 && r != 3 && g_vErrLog++ < 8) logf_("voice: GetVoice -> %d", r); break; }
        if (w > 3800) { logf_("voice: chunk too large (%u), dropped", (unsigned)w); continue; }
        buf[0] = 'V'; buf[1] = '1'; buf[2] = 0;
        if (V.SendChat(S.mm, g_lobby, buf, (int)w + 3)) { g_vtxMsgs++; g_vtxBytes += w + 3; g_vlastTx = GetTickCount(); }
        else if (g_vErrLog++ < 8) logf_("voice: SendLobbyChatMsg failed");
    }
}
static void voice_receive(void) {
    static uint8_t d[4300]; static int16_t pcm[48000];
    for (int guard = 0; guard < 40; guard++) {
        AcquireSRWLockExclusive(&g_vlock);
        if (g_vcqh == g_vcqt) { ReleaseSRWLockExclusive(&g_vlock); break; }
        uint32_t id = g_vcq[g_vcqh]; g_vcqh = (g_vcqh + 1) % 128;
        ReleaseSRWLockExclusive(&g_vlock);
        if (!g_lobby || g_vdeaf) continue;
        uint64_t user = 0; int et = 0;
        int len = V.GetChat(S.mm, g_lobby, (int)id, &user, d, 4096, &et);
        if (len <= 3 || d[0] != 'V' || d[1] != '1') continue;
        if ((user == g_me && !g_vloop) || vmuted(user)) continue;
        g_vrxMsgs++;
        uint32_t wr = 0; int r = V.Decomp(S.user, d + 3, (uint32_t)len - 3, pcm, sizeof(pcm), &wr, g_vrate);
        if (r != 0 || wr == 0) { if (g_vErrLog++ < 8) logf_("voice: DecompressVoice -> %d (%u bytes)", r, (unsigned)wr); continue; }
        g_vrxDec++;
        if (g_vvol != 100) { int n = (int)(wr / 2); for (int i = 0; i < n; i++) { int v = pcm[i] * g_vvol / 100; pcm[i] = (int16_t)(v > 32767 ? 32767 : v < -32768 ? -32768 : v); } }
        Spk* s = spk_for(user); if (s) spk_queue(s, pcm, wr);
    }
}
static void voice_poll(void) {
    if (!g_voiceOk) return;
    if (!g_lobby) { if (g_vrec || g_spk[0].open || g_spk[1].open) voice_reset(); return; }
    voice_transmit(); voice_receive();
    DWORD now = GetTickCount();
    for (int i = 0; i < VMAX_SPK; i++) {
        Spk* s = &g_spk[i]; if (!s->open) continue;
        spk_reclaim(s);
        if (!s->paused && s->nq <= 0) { waveOutPause(s->h); s->paused = 1; s->firstQ = 0; }
        else if (s->paused && s->nq > 0 && s->firstQ && now - s->firstQ > 250) { waveOutRestart(s->h); s->paused = 0; s->firstQ = 0; }
        if (s->nq <= 0 && now - s->lastRx > 20000) spk_close(s);          // free idle device
    }
    // speaking state -> JS
    char sp[200]; sp[0] = 0; size_t o = 0;
    for (int i = 0; i < VMAX_SPK; i++) if (g_spk[i].open && now - g_spk[i].lastRx < 450 && o < 150) o += (size_t)snprintf(sp + o, sizeof(sp) - o, "%s\"%llu\"", o ? "," : "", (unsigned long long)g_spk[i].id);
    if (g_vrec && now - g_vlastTx < 450 && o < 150) snprintf(sp + o, sizeof(sp) - o, "%s\"%llu\"", o ? "," : "", (unsigned long long)g_me);
    if (strcmp(sp, g_vlastSpeak) != 0 || g_vlastMic != g_vrec) {
        strcpy(g_vlastSpeak, sp); g_vlastMic = g_vrec;
        SB b; sb_init(&b); sb_fmt(&b, "{\"t\":\"voice\",\"mic\":%d,\"speak\":[%s]}", g_vrec, sp); emit_sb(&b); sb_free(&b);
    }
    if ((g_vrec || g_vrxMsgs) && now - g_vlastStat > 5000) {
        g_vlastStat = now; logf_("voice: tx %u msgs/%u B, rx %u msgs, decoded %u, polls %u (empty %u, last result %d)", g_vtxMsgs, g_vtxBytes, g_vrxMsgs, g_vrxDec, g_vPolls, g_vNoData, g_vLastR);
    }
}
static void voice_init(void) {
    HMODULE d = S.dll; int miss = 0;
#define VLD(f, n) do { V.f = (void*)GetProcAddress(d, n); if (!V.f) { logf_("voice: missing export %s", n); miss++; } } while (0)
    VLD(StartRec, "SteamAPI_ISteamUser_StartVoiceRecording"); VLD(StopRec, "SteamAPI_ISteamUser_StopVoiceRecording");
    VLD(GetAvail, "SteamAPI_ISteamUser_GetAvailableVoice"); VLD(GetVoice, "SteamAPI_ISteamUser_GetVoice");
    VLD(Decomp, "SteamAPI_ISteamUser_DecompressVoice"); VLD(OptRate, "SteamAPI_ISteamUser_GetVoiceOptimalSampleRate");
    VLD(SendChat, "SteamAPI_ISteamMatchmaking_SendLobbyChatMsg"); VLD(GetChat, "SteamAPI_ISteamMatchmaking_GetLobbyChatEntry");
    if (miss) { logf_("voice: disabled (%d exports missing)", miss); return; }
    uint32_t r = V.OptRate(S.user); if (r >= 8000 && r <= 48000) g_vrate = r;
    g_cbChat.vt = g_cbvt; g_cbChat.flags = 0; g_cbChat.icb = 0; g_cbChat.size = 24; g_cbChat.fn = on_lobby_chat;
    S.RegisterCallback(&g_cbChat, 507 /* LobbyChatMsg_t */);
    g_voiceOk = 1; logf_("voice: ready, sample rate %u", (unsigned)g_vrate);
}

// ================= Lobby snapshot =================
static const char* kMemberKeys[] = { "state", "ready", "role", "name", "chat", "stats", "tx", "ack", "clk", "mkt", NULL };
static char g_kbuf[300], g_vbuf[8300];

static void build_lobby(SB* b) {
    uint64_t owner = S.GetLobbyOwner(S.mm, g_lobby);
    sb_puts(b, "{\"t\":\"lobby\",\"id\":"); sb_id(b, g_lobby);
    sb_puts(b, ",\"owner\":"); sb_id(b, owner);
    sb_puts(b, ",\"me\":"); sb_id(b, g_me);
    sb_puts(b, ",\"data\":{");
    int dc = S.GetLobbyDataCount(S.mm, g_lobby);
    int first = 1;
    for (int i = 0; i < dc && i < 64; i++) {
        g_kbuf[0] = 0; g_vbuf[0] = 0;
        if (!S.GetLobbyDataByIndex(S.mm, g_lobby, i, g_kbuf, (int)sizeof(g_kbuf), g_vbuf, (int)sizeof(g_vbuf))) continue;
        if (!first) sb_putc(b, ',');
        first = 0; sb_str(b, g_kbuf); sb_putc(b, ':'); sb_str(b, g_vbuf);
    }
    sb_puts(b, "},\"members\":[");
    int nm = S.GetNumMembers(S.mm, g_lobby);
    for (int i = 0; i < nm && i < 16; i++) {
        uint64_t m = S.GetMemberByIndex(S.mm, g_lobby, i);
        if (i) sb_putc(b, ',');
        sb_puts(b, "{\"id\":"); sb_id(b, m);
        sb_puts(b, ",\"name\":"); sb_str(b, name_of(m));
        sb_puts(b, ",\"data\":{");
        int f2 = 1;
        for (int k = 0; kMemberKeys[k]; k++) {
            const char* v = S.GetMemberData(S.mm, g_lobby, m, kMemberKeys[k]);
            if (!v || !*v) continue;
            if (!f2) sb_putc(b, ',');
            f2 = 0; sb_str(b, kMemberKeys[k]); sb_putc(b, ':'); sb_str(b, v);
        }
        sb_puts(b, "}}");
    }
    sb_puts(b, "]}");
}

static void poll_lobby(void) {
    if (!S.ready || !g_lobby) return;
    int nm = S.GetNumMembers(S.mm, g_lobby);
    uint64_t owner = S.GetLobbyOwner(S.mm, g_lobby);
    if (nm <= 0 || owner == 0) {                       // lobby is gone / we were removed
        logf_("lobby %llu lost (members=%d owner=%llu)", (unsigned long long)g_lobby, nm, (unsigned long long)owner);
        g_lobby = 0; free(g_lastLobbyJson); g_lastLobbyJson = NULL;
        update_presence(0, 0);
        SB b; sb_init(&b); sb_puts(&b, "{\"t\":\"left\",\"reason\":\"lost\"}"); emit_sb(&b); sb_free(&b);
        return;
    }
    SB b; sb_init(&b); build_lobby(&b);
    if (b.p && (!g_lastLobbyJson || strcmp(g_lastLobbyJson, b.p) != 0)) {
        free(g_lastLobbyJson); g_lastLobbyJson = _strdup(b.p);
        const char* mx = S.GetLobbyData(S.mm, g_lobby, "max");
        update_presence(nm, mx && *mx ? atoi(mx) : nm);
        emit_sb(&b);
    }
    sb_free(&b);
}

// ================= Commands =================
static Pend* pend_find(int kind) { for (int i = 0; i < MAX_PEND; i++) if (g_pend[i].kind == kind) return &g_pend[i]; return NULL; }
static Pend* pend_add(int kind, uint64_t call) {
    for (int i = 0; i < MAX_PEND; i++) if (!g_pend[i].kind) {
        memset(&g_pend[i], 0, sizeof(Pend)); g_pend[i].kind = kind; g_pend[i].call = call; g_pend[i].t0 = GetTickCount(); return &g_pend[i];
    }
    return NULL;
}

static void do_leave(int silent) {
    if (!S.ready || !g_lobby) return;
    logf_("leaving lobby %llu", (unsigned long long)g_lobby);
    S.LeaveLobby(S.mm, g_lobby);
    g_lobby = 0; free(g_lastLobbyJson); g_lastLobbyJson = NULL;
    voice_reset();
    update_presence(0, 0);
    if (!silent) emit_t("left");
}

static void do_join(uint64_t id) {
    if (!S.ready || !id) return;
    if (g_lobby == id) return;
    if (pend_find(PK_JOIN)) { emit_err("join", "busy", 0); return; }
    if (g_lobby) do_leave(1);
    uint64_t call = S.JoinLobby(S.mm, id);
    Pend* p = pend_add(PK_JOIN, call);
    if (p) p->jid = id;
    logf_("JoinLobby %llu -> call %llu", (unsigned long long)id, (unsigned long long)call);
    SB b; sb_init(&b); sb_puts(&b, "{\"t\":\"joining\",\"id\":"); sb_id(&b, id); sb_putc(&b, '}'); emit_sb(&b); sb_free(&b);
}

static void do_create(int type, int maxm, const char* name) {
    if (!S.ready) return;
    if (pend_find(PK_CREATE)) { emit_err("create", "busy", 0); return; }
    if (g_lobby) do_leave(1);
    if (type < 0 || type > 2) type = 1;
    if (maxm < 2) maxm = 2; if (maxm > 4) maxm = 4;
    uint64_t call = S.CreateLobby(S.mm, type, maxm);
    Pend* p = pend_add(PK_CREATE, call);
    if (p) { p->type = type; p->max = maxm; snprintf(p->name, sizeof(p->name), "%.100s", cs(name)); }
    logf_("CreateLobby type=%d max=%d -> call %llu", type, maxm, (unsigned long long)call);
}

static void do_list(void) {
    if (!S.ready) return;
    if (pend_find(PK_LIST)) { emit_err("list", "busy", 0); return; }
    S.AddDistFilter(S.mm, 3 /* worldwide */);
    S.AddCountFilter(S.mm, 50);
    S.AddStrFilter(S.mm, "dtmod", "1", 0 /* equal */);
    uint64_t call = S.RequestLobbyList(S.mm);
    pend_add(PK_LIST, call);
    logf_("RequestLobbyList -> call %llu", (unsigned long long)call);
}

static void do_friends(void) {
    if (!S.ready) return;
    int n = S.GetFriendCount(S.fr, 4 /* immediate */);
    logf_("do_friends: %d friends", n);
    SB b; sb_init(&b); sb_puts(&b, "{\"t\":\"friends\",\"list\":[");
    int first = 1;
    for (int i = 0; i < n && i < 400; i++) {
        uint64_t id = S.GetFriendByIndex(S.fr, i, 4);
        unsigned char gi[64]; memset(gi, 0, sizeof(gi));
        int inGame = 0;
        if (S.GetFriendGame(S.fr, id, gi)) {
            uint64_t gid; memcpy(&gid, gi, 8);
            inGame = ((uint32_t)(gid & 0xFFFFFFu) == GAME_APPID);
        }
        if (!first) sb_putc(&b, ',');
        first = 0;
        sb_puts(&b, "{\"id\":"); sb_id(&b, id);
        sb_puts(&b, ",\"name\":"); sb_str(&b, name_of(id));
        sb_fmt(&b, ",\"state\":%d,\"inGame\":%d}", S.GetFriendState(S.fr, id), inGame);
    }
    sb_puts(&b, "]}");
    logf_("do_friends: built %u bytes, emitting", (unsigned)b.n);
    emit_sb(&b); sb_free(&b);
    logf_("do_friends: done");
}

// ================= Pending call results =================
static void complete(Pend* p) {
    uint8_t failed = 0;
    if (p->kind == PK_CREATE) {
        struct { int32_t res; uint64_t lobby; } r; memset(&r, 0, sizeof(r));
        uint8_t ok = S.GetCallResult(S.ut, p->call, &r, (int)sizeof(r), 513, &failed);
        logf_("LobbyCreated ok=%d failed=%d res=%d lobby=%llu", ok, failed, r.res, (unsigned long long)r.lobby);
        if (!ok || failed || r.res != 1) { emit_err("create", "CreateLobby failed", r.res); return; }
        g_lobby = r.lobby;
        char tmp[16];
        S.SetLobbyData(S.mm, g_lobby, "dtmod", "1");
        S.SetLobbyData(S.mm, g_lobby, "name", p->name[0] ? p->name : "Devices Tycoon co-op");
        snprintf(tmp, sizeof(tmp), "%d", p->max); S.SetLobbyData(S.mm, g_lobby, "max", tmp);
        S.SetLobbyData(S.mm, g_lobby, "host", g_myName);
        S.SetLobbyJoinable(S.mm, g_lobby, 1);
        update_presence(1, p->max);
        SB b; sb_init(&b); sb_puts(&b, "{\"t\":\"created\",\"id\":"); sb_id(&b, g_lobby); sb_putc(&b, '}'); emit_sb(&b); sb_free(&b);
        free(g_lastLobbyJson); g_lastLobbyJson = NULL;      // force first snapshot
    } else if (p->kind == PK_JOIN) {
        struct { uint64_t lobby; uint32_t perms; uint8_t locked; uint32_t resp; } r; memset(&r, 0, sizeof(r));
        uint8_t ok = S.GetCallResult(S.ut, p->call, &r, (int)sizeof(r), 504, &failed);
        logf_("LobbyEnter ok=%d failed=%d lobby=%llu response=%u", ok, failed, (unsigned long long)r.lobby, r.resp);
        if (!ok || failed || r.resp != 1) { emit_err("join", "JoinLobby failed", (int)r.resp); return; }
        g_lobby = r.lobby;
        SB b; sb_init(&b); sb_puts(&b, "{\"t\":\"joined\",\"id\":"); sb_id(&b, g_lobby); sb_putc(&b, '}'); emit_sb(&b); sb_free(&b);
        free(g_lastLobbyJson); g_lastLobbyJson = NULL;
    } else if (p->kind == PK_LIST) {
        struct { uint32_t n; } r; memset(&r, 0, sizeof(r));
        uint8_t ok = S.GetCallResult(S.ut, p->call, &r, (int)sizeof(r), 510, &failed);
        logf_("LobbyMatchList ok=%d failed=%d n=%u", ok, failed, r.n);
        if (!ok || failed) { emit_err("list", "RequestLobbyList failed", 0); return; }
        SB b; sb_init(&b); sb_puts(&b, "{\"t\":\"lobbies\",\"list\":[");
        int first = 1;
        for (uint32_t i = 0; i < r.n && i < 50; i++) {
            uint64_t id = S.GetLobbyByIndex(S.mm, (int)i);
            if (!first) sb_putc(&b, ',');
            first = 0;
            sb_puts(&b, "{\"id\":"); sb_id(&b, id);
            sb_puts(&b, ",\"name\":"); sb_str(&b, S.GetLobbyData(S.mm, id, "name"));
            sb_puts(&b, ",\"host\":"); sb_str(&b, S.GetLobbyData(S.mm, id, "host"));
            sb_puts(&b, ",\"max\":"); sb_str(&b, S.GetLobbyData(S.mm, id, "max"));
            sb_fmt(&b, ",\"n\":%d}", S.GetNumMembers(S.mm, id));
        }
        sb_puts(&b, "]}");
        emit_sb(&b); sb_free(&b);
    }
}
static void poll_pending(void) {
    for (int i = 0; i < MAX_PEND; i++) {
        Pend* p = &g_pend[i];
        if (!p->kind) continue;
        uint8_t failed = 0;
        if (S.IsCallDone(S.ut, p->call, &failed)) { complete(p); p->kind = PK_NONE; }
        else if (GetTickCount() - p->t0 > 30000) { emit_err("pending", "timeout", p->kind); p->kind = PK_NONE; }
    }
}

// ================= Steam callbacks (invitations accepted while the game is running) =================
static void on_game_lobby_join_requested(void* pv) {
    uint64_t lobby = *(uint64_t*)pv;
    logf_("callback GameLobbyJoinRequested lobby=%llu", (unsigned long long)lobby);
    g_reqJoin = lobby;
}
static void on_rich_presence_join(void* pv) {
    const char* connect = (const char*)pv + 8;            // after the friend SteamID
    char tmp[257]; memcpy(tmp, connect, 256); tmp[256] = 0;
    logf_("callback GameRichPresenceJoinRequested connect='%s'", tmp);
    const char* k = strstr(tmp, "+connect_lobby");
    if (k) { uint64_t id = parse_u64(k + 14); if (id) g_reqJoin = id; }
}

static uint64_t cmdline_lobby(void) {
    const wchar_t* cl = GetCommandLineW();
    if (!cl) return 0;
    const wchar_t* k = wcsstr(cl, L"+connect_lobby");
    if (!k) return 0;
    return (uint64_t)_wcstoui64(k + 14, NULL, 10);
}

// ================= Steam bring-up =================
#define LD(field, name) do { S.field = (void*)GetProcAddress(S.dll, name); if (!S.field) { logf_("missing export %s", name); missing++; } } while (0)
static int ensure_steam(void) {
    if (S.ready) return 1;
    HMODULE dll = GetModuleHandleA("steam_api64.dll");
    if (!dll) return 0;
    S.dll = dll;
    int (__cdecl *ghu)(void) = (int (__cdecl *)(void))GetProcAddress(dll, "SteamAPI_GetHSteamUser");
    if (!ghu || ghu() == 0) return 0;                       // official Steam ext has not initialised Steam yet
    int missing = 0;
    void* (__cdecl *uacc)(void) = (void* (__cdecl *)(void))GetProcAddress(dll, "SteamAPI_SteamUser_v023");
    void* (__cdecl *facc)(void) = (void* (__cdecl *)(void))GetProcAddress(dll, "SteamAPI_SteamFriends_v018");
    void* (__cdecl *macc)(void) = (void* (__cdecl *)(void))GetProcAddress(dll, "SteamAPI_SteamMatchmaking_v009");
    void* (__cdecl *tacc)(void) = (void* (__cdecl *)(void))GetProcAddress(dll, "SteamAPI_SteamUtils_v011");
    if (!uacc || !facc || !macc || !tacc) { logf_("missing interface accessors"); return 0; }
    LD(GetSteamID, "SteamAPI_ISteamUser_GetSteamID");
    LD(GetAppID, "SteamAPI_ISteamUtils_GetAppID");
    LD(IsCallDone, "SteamAPI_ISteamUtils_IsAPICallCompleted");
    LD(GetCallResult, "SteamAPI_ISteamUtils_GetAPICallResult");
    LD(CreateLobby, "SteamAPI_ISteamMatchmaking_CreateLobby");
    LD(JoinLobby, "SteamAPI_ISteamMatchmaking_JoinLobby");
    LD(LeaveLobby, "SteamAPI_ISteamMatchmaking_LeaveLobby");
    LD(RequestLobbyList, "SteamAPI_ISteamMatchmaking_RequestLobbyList");
    LD(AddStrFilter, "SteamAPI_ISteamMatchmaking_AddRequestLobbyListStringFilter");
    LD(AddDistFilter, "SteamAPI_ISteamMatchmaking_AddRequestLobbyListDistanceFilter");
    LD(AddCountFilter, "SteamAPI_ISteamMatchmaking_AddRequestLobbyListResultCountFilter");
    LD(GetLobbyByIndex, "SteamAPI_ISteamMatchmaking_GetLobbyByIndex");
    LD(GetLobbyData, "SteamAPI_ISteamMatchmaking_GetLobbyData");
    LD(SetLobbyData, "SteamAPI_ISteamMatchmaking_SetLobbyData");
    LD(GetLobbyDataCount, "SteamAPI_ISteamMatchmaking_GetLobbyDataCount");
    LD(GetLobbyDataByIndex, "SteamAPI_ISteamMatchmaking_GetLobbyDataByIndex");
    LD(GetNumMembers, "SteamAPI_ISteamMatchmaking_GetNumLobbyMembers");
    LD(GetMemberByIndex, "SteamAPI_ISteamMatchmaking_GetLobbyMemberByIndex");
    LD(GetMemberData, "SteamAPI_ISteamMatchmaking_GetLobbyMemberData");
    LD(SetMemberData, "SteamAPI_ISteamMatchmaking_SetLobbyMemberData");
    LD(GetLobbyOwner, "SteamAPI_ISteamMatchmaking_GetLobbyOwner");
    LD(SetLobbyJoinable, "SteamAPI_ISteamMatchmaking_SetLobbyJoinable");
    LD(InviteToLobby, "SteamAPI_ISteamMatchmaking_InviteUserToLobby");
    LD(GetFriendCount, "SteamAPI_ISteamFriends_GetFriendCount");
    LD(GetFriendByIndex, "SteamAPI_ISteamFriends_GetFriendByIndex");
    LD(GetFriendName, "SteamAPI_ISteamFriends_GetFriendPersonaName");
    LD(GetFriendState, "SteamAPI_ISteamFriends_GetFriendPersonaState");
    LD(GetFriendGame, "SteamAPI_ISteamFriends_GetFriendGamePlayed");
    LD(SetRichPresence, "SteamAPI_ISteamFriends_SetRichPresence");
    LD(InviteDialog, "SteamAPI_ISteamFriends_ActivateGameOverlayInviteDialog");
    LD(RequestUserInfo, "SteamAPI_ISteamFriends_RequestUserInformation");
    LD(RunCallbacks, "SteamAPI_RunCallbacks");
    LD(RegisterCallback, "SteamAPI_RegisterCallback");
    LD(UnregisterCallback, "SteamAPI_UnregisterCallback");
    if (missing) { logf_("ensure_steam: %d exports missing, module disabled", missing); return 0; }
    S.GetHSteamUser = ghu;
    S.user = uacc(); S.fr = facc(); S.mm = macc(); S.ut = tacc();
    g_me = S.GetSteamID(S.user);
    snprintf(g_myName, sizeof(g_myName), "%s", cs(S.GetFriendName(S.fr, g_me)));
    logf_("Steam ready: me=%llu name='%s' app=%u", (unsigned long long)g_me, g_myName, (unsigned)S.GetAppID(S.ut));

    g_cbJoinLobby.vt = g_cbvt; g_cbJoinLobby.flags = 0; g_cbJoinLobby.icb = 0; g_cbJoinLobby.size = 16;  g_cbJoinLobby.fn = on_game_lobby_join_requested;
    g_cbJoinRP.vt = g_cbvt;    g_cbJoinRP.flags = 0;    g_cbJoinRP.icb = 0;    g_cbJoinRP.size = 264; g_cbJoinRP.fn = on_rich_presence_join;
    S.RegisterCallback(&g_cbJoinLobby, 333 /* GameLobbyJoinRequested_t */);
    S.RegisterCallback(&g_cbJoinRP, 337 /* GameRichPresenceJoinRequested_t */);
    S.ready = 1;
    voice_init();

    SB b; sb_init(&b);
    sb_fmt(&b, "{\"t\":\"ready\",\"v\":\"%s\",\"app\":%u,\"me\":", DTMOD_VERSION, (unsigned)S.GetAppID(S.ut));
    sb_id(&b, g_me); sb_puts(&b, ",\"name\":"); sb_str(&b, g_myName); sb_putc(&b, '}');
    emit_sb(&b); sb_free(&b);

    uint64_t cl = cmdline_lobby();                           // game was launched from a Steam invite
    if (cl) { logf_("command line asks to join lobby %llu", (unsigned long long)cl); g_reqJoin = cl; }
    return 1;
}

// ================= crash diagnostics =================
static LONG CALLBACK veh(PEXCEPTION_POINTERS ep) {
    static volatile LONG cnt = 0;
    DWORD code = ep->ExceptionRecord->ExceptionCode;
    if (code == 0x406D1388 || code == 0x40010006 || code == 0x4001000A) return EXCEPTION_CONTINUE_SEARCH;
    if (InterlockedIncrement(&cnt) > 40) return EXCEPTION_CONTINUE_SEARCH;
    HMODULE m = NULL; char mn[MAX_PATH] = "?";
    if (GetModuleHandleExA(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS | GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT, (LPCSTR)ep->ExceptionRecord->ExceptionAddress, &m) && m) GetModuleFileNameA(m, mn, MAX_PATH);
    logf_("EXCEPTION code=%08lx addr=%p module=%s +0x%llx tid=%lu", (unsigned long)code, ep->ExceptionRecord->ExceptionAddress, mn,
          (unsigned long long)((char*)ep->ExceptionRecord->ExceptionAddress - (char*)m), (unsigned long)GetCurrentThreadId());
    return EXCEPTION_CONTINUE_SEARCH;
}

// ================= IExtension =================
static const char* pstr(const ParamPOD* p, size_t n, size_t i) { return (i < n && p[i].type == EPT_String && p[i].str) ? p[i].str : ""; }
static double pnum(const ParamPOD* p, size_t n, size_t i, double d) { return (i < n && p[i].type == EPT_Number) ? p[i].number : d; }

static void on_tick(void) {
    if (!ensure_steam()) return;
    static int ticks = 0; if (ticks < 3) logf_("tick #%d", ++ticks);
    /* RunCallbacks is intentionally NOT called: Steam_x64.ext.dll already pumps it every frame. */
    uint64_t rj = g_reqJoin; g_reqJoin = 0;
    if (rj) do_join(rj);
    poll_pending();
    poll_lobby();
    voice_poll();
}

static void ext_OnWebMessage(IExtension* self, LPCSTR id, size_t n, const ParamPOD* p, double asyncId) {
    (void)self; (void)asyncId;
    if (!id) return;
    { static int first = 1; if (first && strcmp(id, "tick") != 0) { first = 0; logf_("first non-tick msg on tid %lu", (unsigned long)GetCurrentThreadId()); } }
    if (strcmp(id, "tick") == 0) { on_tick(); return; }
    if (strcmp(id, "log") == 0) { logf_("JS: %s", pstr(p, n, 0)); return; }
    if (strcmp(id, "dump") == 0) {                       // dev helper: dtmod_dump_<name>.txt next to the DLL
        const char* nm = pstr(p, n, 0); const char* data = pstr(p, n, 1);
        if (!valid_key(nm)) return;
        char path[MAX_PATH + 64]; snprintf(path, sizeof(path), "%s", g_logPath);
        char* slash = strrchr(path, '\\'); if (!slash) slash = strrchr(path, '/');
        if (slash) *(slash + 1) = 0; else path[0] = 0;
        size_t l = strlen(path); snprintf(path + l, sizeof(path) - l, "dtmod_dump_%s.txt", nm);
        FILE* f = fopen(path, "wb"); if (f) { fwrite(data, 1, strlen(data), f); fclose(f); logf_("dump %s (%u bytes)", nm, (unsigned)strlen(data)); }
        return;
    }
    if (strcmp(id, "vtick") == 0) { if (S.ready) voice_poll(); return; }
    if (strncmp(id, "voice-", 6) == 0) {
        if (!S.ready || !g_voiceOk) return;
        if (strcmp(id, "voice-mic") == 0) {
            int on = pnum(p, n, 0, 0) != 0;
            if (on && !g_vrec && g_lobby) { V.StartRec(S.user); g_vrec = 1; logf_("voice: mic on"); }
            else if (!on && g_vrec) { voice_transmit(); voice_stop_mic(); }
        }
        else if (strcmp(id, "voice-cfg") == 0) { g_vvol = (int)pnum(p, n, 0, 100); if (g_vvol < 0) g_vvol = 0; if (g_vvol > 200) g_vvol = 200; g_vdeaf = pnum(p, n, 1, 0) != 0; logf_("voice: vol=%d deaf=%d", g_vvol, g_vdeaf); }
        else if (strcmp(id, "voice-mute") == 0) { uint64_t u = parse_u64(pstr(p, n, 0)); if (u) vset_muted(u, pnum(p, n, 1, 0) != 0); }
        else if (strcmp(id, "voice-loop") == 0) { g_vloop = pnum(p, n, 0, 0) != 0; logf_("voice: loopback=%d", g_vloop); }
        return;
    }
    logf_("cmd %s", id);
    if (strcmp(id, "hello") == 0) {
        if (!ensure_steam()) return;                         // JS keeps retrying; 'ready' is emitted on bring-up
        SB b; sb_init(&b);
        sb_fmt(&b, "{\"t\":\"ready\",\"v\":\"%s\",\"app\":%u,\"me\":", DTMOD_VERSION, (unsigned)S.GetAppID(S.ut));
        sb_id(&b, g_me); sb_puts(&b, ",\"name\":"); sb_str(&b, g_myName); sb_putc(&b, '}');
        emit_sb(&b); sb_free(&b);
        free(g_lastLobbyJson); g_lastLobbyJson = NULL;       // resend lobby snapshot if any
        return;
    }
    if (!S.ready) { emit_err(id, "steam not ready", 0); return; }
    if (strcmp(id, "create-lobby") == 0) do_create((int)pnum(p, n, 0, 1), (int)pnum(p, n, 1, 4), pstr(p, n, 2));
    else if (strcmp(id, "list-lobbies") == 0) do_list();
    else if (strcmp(id, "join-lobby") == 0) do_join(parse_u64(pstr(p, n, 0)));
    else if (strcmp(id, "leave-lobby") == 0) do_leave(0);
    else if (strcmp(id, "get-friends") == 0) do_friends();
    else if (strcmp(id, "invite-friend") == 0) {
        uint64_t f = parse_u64(pstr(p, n, 0));
        if (!g_lobby) emit_err("invite", "not in a lobby", 0);
        else if (f) { uint8_t ok = S.InviteToLobby(S.mm, g_lobby, f); logf_("InviteUserToLobby %llu -> %d", (unsigned long long)f, ok); if (!ok) emit_err("invite", "invite failed", 0); }
    }
    else if (strcmp(id, "invite-dialog") == 0) {
        if (!g_lobby) emit_err("invite", "not in a lobby", 0);
        else { S.InviteDialog(S.fr, g_lobby); logf_("ActivateGameOverlayInviteDialog"); }
    }
    else if (strcmp(id, "set-member-data") == 0 || strcmp(id, "set-lobby-data") == 0) {
        const char* k = pstr(p, n, 0); const char* v = pstr(p, n, 1);
        if (!g_lobby) { emit_err(id, "not in a lobby", 0); return; }
        if (!valid_key(k) || strlen(v) > MAX_VALUE_BYTES) { emit_err(id, "bad key or value too large", 0); return; }
        if (strcmp(id, "set-member-data") == 0) S.SetMemberData(S.mm, g_lobby, k, v);
        else {
            if (S.GetLobbyOwner(S.mm, g_lobby) != g_me) { emit_err(id, "only the host can change lobby data", 0); return; }
            if (strcmp(k, "dtmod") == 0) { emit_err(id, "reserved key", 0); return; }
            S.SetLobbyData(S.mm, g_lobby, k, v);
        }
    }
    else logf_("unknown command %s", id);
}

static void ext_Release(IExtension* self) {
    (void)self;
    logf_("EXT: Release");
    if (S.ready) {
        if (g_lobby) { S.LeaveLobby(S.mm, g_lobby); g_lobby = 0; }
        update_presence(0, 0);
        voice_reset(); if (g_voiceOk) S.UnregisterCallback(&g_cbChat);
        S.UnregisterCallback(&g_cbJoinLobby);
        S.UnregisterCallback(&g_cbJoinRP);
        S.ready = 0;
    }
}
static void ext_OnMainWindowCreated(IExtension* self, HWND h) { (void)self; logf_("EXT: OnMainWindowCreated hwnd=%p", (void*)h); }
static void ext_Init(IExtension* self) { (void)self; logf_("EXT: Init"); }

static const IExtensionVtbl g_vt = { ext_Release, ext_OnWebMessage, ext_OnMainWindowCreated, ext_Init };
static IExtension g_ext = { &g_vt };

__declspec(dllexport) IExtension* WrapperExtInit(IApplication* app) {
    g_app = app;
    char path[MAX_PATH];
    if (g_self && GetModuleFileNameA(g_self, path, MAX_PATH)) {
        char* slash = strrchr(path, '\\');
        if (slash) {
            *(slash + 1) = 0;
            snprintf(g_logPath, MAX_PATH, "%sdtmod.log", path);
            FILE* f = fopen(g_logPath, "rb");               // keep the log from growing without bound
            if (f) { fseek(f, 0, SEEK_END); long sz = ftell(f); fclose(f); if (sz > 512 * 1024) remove(g_logPath); }
        }
    }
    logf_("==== DTMod %s loaded (tid %lu) ====", DTMOD_VERSION, (unsigned long)GetCurrentThreadId());
    AddVectoredExceptionHandler(1, veh);
    app->vt->SetSdkVersion(app, 2);
    app->vt->RegisterComponentId(app, COMPONENT_ID);
    return &g_ext;
}

BOOL APIENTRY DllMain(HMODULE h, DWORD reason, LPVOID r) {
    (void)r;
    if (reason == DLL_PROCESS_ATTACH) { g_self = h; DisableThreadLibraryCalls(h); }
    return TRUE;
}
