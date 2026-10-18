// YouTube Data API v3 (official) for search + official IFrame player for playback. No downloads.
export type YtVideo = { id: string; title: string; channel: string; thumb: string; duration?: string | undefined };

const KEY = "marcomusic:ytkey";
export const getYtKey = () => (typeof localStorage === "undefined" ? "" : localStorage.getItem(KEY) || "");
export const setYtKey = (k: string) => localStorage.setItem(KEY, k.trim());

export function isoDuration(iso: string) {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return undefined;
  const [h, mi, s] = [Number(m[1] || 0), Number(m[2] || 0), Number(m[3] || 0)];
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${String(mi).padStart(2, "0")}:${ss}` : `${mi}:${ss}`;
}

const decode = (s: string) => { const t = document.createElement("textarea"); t.innerHTML = s; return t.value; };

async function api<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = getYtKey();
  if (!key) throw new Error("NO_KEY");
  const qs = new URLSearchParams({ ...params, key });
  let r: Response;
  try { r = await fetch(`https://www.googleapis.com/youtube/v3/${path}?${qs}`); } catch { throw new Error("Sin conexión a Internet."); }
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    const reason = body?.error?.errors?.[0]?.reason || "";
    if (reason === "quotaExceeded") throw new Error("Se agotó la cuota diaria de búsquedas de YouTube. Probá mañana.");
    if (r.status === 400 || r.status === 403) throw new Error("YouTube rechazó la clave. Revisá que sea correcta y que «YouTube Data API v3» esté habilitada.");
    throw new Error(`YouTube respondió con error ${r.status}.`);
  }
  return r.json();
}

export async function searchYouTube(q: string): Promise<YtVideo[]> {
  const s = await api<{ items: { id: { videoId: string }; snippet: { title: string; channelTitle: string; thumbnails: { medium?: { url: string }; default?: { url: string } } } }[] }>(
    "search", { part: "snippet", type: "video", videoEmbeddable: "true", maxResults: "20", q },
  );
  const ids = s.items.map((i) => i.id.videoId).filter(Boolean);
  const durations = new Map<string, string | undefined>();
  if (ids.length) {
    const v = await api<{ items: { id: string; contentDetails: { duration: string } }[] }>("videos", { part: "contentDetails", id: ids.join(",") }).catch(() => ({ items: [] }));
    for (const it of v.items) durations.set(it.id, isoDuration(it.contentDetails.duration));
  }
  return s.items.filter((i) => i.id.videoId).map((i) => ({
    id: i.id.videoId,
    title: decode(i.snippet.title),
    channel: decode(i.snippet.channelTitle),
    thumb: i.snippet.thumbnails.medium?.url || i.snippet.thumbnails.default?.url || "",
    duration: durations.get(i.id.videoId),
  }));
}

/* ---- official IFrame Player API ---- */
type YTPlayer = { playVideo(): void; pauseVideo(): void; destroy(): void; getPlayerState(): number };
declare global { interface Window { YT?: { Player: new (el: HTMLElement, o: unknown) => YTPlayer }; onYouTubeIframeAPIReady?: () => void } }
let apiPromise: Promise<void> | undefined;
export function loadIframeApi() {
  if (window.YT?.Player) return Promise.resolve();
  apiPromise ??= new Promise<void>((res, rej) => {
    window.onYouTubeIframeAPIReady = () => res();
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.onerror = () => { apiPromise = undefined; rej(new Error("No se pudo cargar el reproductor de YouTube.")); };
    document.head.appendChild(s);
  });
  return apiPromise;
}
export type { YTPlayer };
