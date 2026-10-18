import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Download, Film, KeyRound, Library, Loader2, Music2, Pause, Play, Search, Trash2, XCircle, Youtube } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import * as M from "@/lib/music/store";
import { getYtKey, loadIframeApi, searchYouTube, setYtKey, type YTPlayer, type YtVideo } from "@/lib/music/youtube";
import { audioToTracks, downloadFile, listVideos, removeVideo, saveVideo, videoFile, type DownloadKind, type VideoItem } from "@/lib/music/downloads";

export default function YouTubeScreen({ toLibrary }: { toLibrary: () => void }) {
  const [tab, setTab] = useState<"search" | "downloads">("search");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Youtube className="size-7 text-primary drop-shadow-[0_0_8px_var(--fuchsia-neon)]" />
        <h1 className="text-2xl font-bold">YouTube</h1>
      </div>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
        {(["search", "downloads"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg py-2 text-sm font-semibold ${tab === t ? "bg-neon text-primary-foreground" : "text-muted-foreground"}`}>
            {t === "search" ? "Buscar" : "Descargas"}
          </button>
        ))}
      </div>
      {tab === "search" ? <SearchTab toLibrary={toLibrary} /> : <DownloadsTab />}
    </div>
  );
}

/* ---------- search + official player ---------- */
function SearchTab({ toLibrary }: { toLibrary: () => void }) {
  const [hasKey, setHasKey] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [results, setResults] = useState<YtVideo[]>([]);
  const [open, setOpen] = useState<YtVideo | null>(null);
  useEffect(() => setHasKey(!!getYtKey()), []);

  if (!hasKey) return <KeySetup onSaved={() => setHasKey(true)} />;
  if (open) return <VideoPlayer v={open} back={() => setOpen(null)} toLibrary={toLibrary} />;

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true); setErr("");
    try { setResults(await searchYouTube(q.trim())); } catch (x) { setErr(x instanceof Error ? x.message : String(x)); setResults([]); }
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={run} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Canción, artista o videoclip" className="pl-9" aria-label="Buscar en YouTube" />
        </div>
        <Button type="submit" variant="neon" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : "Buscar"}</Button>
      </form>
      {err && <p className="rounded-lg bg-muted p-3 text-sm text-destructive">{err}</p>}
      {!busy && !err && results.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Buscá música y videoclips para verlos acá.</p>}
      <div className="flex flex-col gap-2">
        {results.map((v) => (
          <button key={v.id} onClick={() => setOpen(v)} className="flex gap-3 rounded-xl p-2 text-left hover:bg-secondary">
            <div className="relative shrink-0">
              <img src={v.thumb} alt="" width={128} height={72} loading="lazy" className="h-[72px] w-32 rounded-lg object-cover" />
              {v.duration && <span className="absolute bottom-1 right-1 rounded bg-background/85 px-1 text-[11px] font-semibold">{v.duration}</span>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="line-clamp-2 text-sm font-semibold">{v.title}</div>
              <div className="truncate text-xs text-muted-foreground">{v.channel}</div>
            </div>
          </button>
        ))}
      </div>
      {results.length > 0 && <p className="text-center text-xs text-muted-foreground">YouTube no permite descargar sus videos: acá solo se pueden reproducir.</p>}
      <button className="text-xs text-muted-foreground underline" onClick={() => { setYtKey(""); setHasKey(false); }}>Cambiar clave de YouTube</button>
    </div>
  );
}

function VideoPlayer({ v, back, toLibrary }: { v: YtVideo; back: () => void; toLibrary: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let dead = false;
    loadIframeApi().then(() => {
      if (dead || !box.current || !window.YT) return;
      player.current = new window.YT.Player(box.current, {
        videoId: v.id,
        playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onStateChange: (e: { data: number }) => {
            setPlaying(e.data === 1);
            if (e.data === 1 && M.getState().playing) M.pause(); // keep the song & position, just pause it
          },
          onError: (e: { data: number }) => setErr(e.data === 101 || e.data === 150 || e.data === 153
            ? "El dueño de este video no permite reproducirlo fuera de YouTube." : "No se pudo reproducir este video."),
        },
      });
    }, (x) => setErr(x.message));
    return () => { dead = true; player.current?.destroy(); player.current = null; };
  }, [v.id]);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-2xl border bg-card shadow-[0_0_30px_-10px_var(--fuchsia-neon)]">
        <div className="aspect-video w-full [&>iframe]:size-full"><div ref={box} /></div>
      </div>
      <div>
        <div className="font-semibold">{v.title}</div>
        <div className="text-sm text-muted-foreground">{v.channel}{v.duration ? ` · ${v.duration}` : ""}</div>
      </div>
      {err && <p className="rounded-lg bg-muted p-3 text-sm text-destructive">{err}</p>}
      <div className="grid grid-cols-3 gap-2">
        <Button variant="secondary" onClick={back}><ArrowLeft /> Resultados</Button>
        <Button variant="neon" onClick={() => (playing ? player.current?.pauseVideo() : player.current?.playVideo())}>
          {playing ? <><Pause /> Pausar</> : <><Play /> Reproducir</>}
        </Button>
        <Button variant="secondary" onClick={() => { player.current?.pauseVideo(); toLibrary(); }}><Library /> Biblioteca</Button>
      </div>
    </div>
  );
}

function KeySetup({ onSaved }: { onSaved: () => void }) {
  const [k, setK] = useState("");
  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2 font-semibold"><KeyRound className="size-5 text-primary" /> Activar búsqueda de YouTube</div>
      <p className="text-sm text-muted-foreground">YouTube pide una clave gratuita para buscar. Se guarda solo en este dispositivo.</p>
      <ol className="list-decimal pl-5 text-sm text-muted-foreground">
        <li>Entrá a console.cloud.google.com e iniciá sesión.</li>
        <li>Creá un proyecto y habilitá «YouTube Data API v3».</li>
        <li>En «Credenciales» tocá «Crear credenciales» → «Clave de API» y copiala.</li>
      </ol>
      <Input value={k} onChange={(e) => setK(e.target.value)} placeholder="Pegá tu clave de API" aria-label="Clave de YouTube" />
      <Button variant="neon" disabled={k.trim().length < 20} onClick={() => { setYtKey(k); onSaved(); }}>Guardar clave</Button>
    </div>
  );
}

/* ---------- authorized downloads ---------- */
type Status = { state: "idle" } | { state: "busy"; kind: DownloadKind; p: number | null } | { state: "done"; text: string } | { state: "error"; text: string };

function DownloadsTab() {
  const [url, setUrl] = useState("");
  const [st, setSt] = useState<Status>({ state: "idle" });
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [watching, setWatching] = useState<{ v: VideoItem; src: string } | null>(null);
  const refresh = () => listVideos().then(setVideos);
  useEffect(() => { refresh(); }, []);
  useEffect(() => () => { if (watching) URL.revokeObjectURL(watching.src); }, [watching]);

  const go = async (kind: DownloadKind) => {
    setSt({ state: "busy", kind, p: null });
    try {
      const file = await downloadFile(url, kind, (p) => setSt({ state: "busy", kind, p }));
      if (kind === "mp3") {
        const tracks = await audioToTracks(file);
        if (!tracks.length) throw new Error("El archivo no es un audio compatible.");
        await M.addTracks(tracks);
        setSt({ state: "done", text: `«${tracks[0]!.title}» se agregó a tu biblioteca y se puede escuchar sin conexión.` });
      } else {
        await saveVideo(file, new URL(url).hostname);
        await refresh();
        setSt({ state: "done", text: "El video se guardó en «Videos descargados»." });
      }
      setUrl("");
    } catch (e) { setSt({ state: "error", text: e instanceof Error ? e.message : String(e) }); }
  };

  const importAudio = async (v: VideoItem) => {
    const f = await videoFile(v);
    if (!f) { toast.error("El video ya no está disponible."); return; }
    const tracks = await audioToTracks(new File([f], v.fileName.replace(/\.mp4$/i, ".m4a"), { type: "audio/mp4", lastModified: 0 }));
    await M.addTracks(tracks);
    toast.success("Audio agregado a la biblioteca");
  };

  const watch = async (v: VideoItem) => {
    const f = await videoFile(v);
    if (!f) { toast.error("El video ya no está disponible."); return; }
    if (M.getState().playing) M.pause();
    setWatching({ v, src: URL.createObjectURL(f) });
  };

  const busy = st.state === "busy";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <div className="font-semibold">Descargar desde un enlace autorizado</div>
        <p className="text-xs text-muted-foreground">Pegá el enlace directo a un archivo propio o de una fuente que permita descargarlo (por ejemplo, música libre de Internet Archive). YouTube y las plataformas de streaming no lo permiten.</p>
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/cancion.mp3" aria-label="Enlace del archivo" disabled={busy} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="neon" disabled={busy || !url.trim()}>{busy ? <Loader2 className="animate-spin" /> : <Download />} Descargar</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            <DropdownMenuItem onClick={() => go("mp3")}><Music2 /> Descargar MP3</DropdownMenuItem>
            <DropdownMenuItem onClick={() => go("mp4")}><Film /> Descargar MP4</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {st.state === "busy" && (
          <div className="flex flex-col gap-1">
            {st.p != null ? <Progress value={st.p * 100} /> : <Progress className="animate-pulse" value={100} />}
            <span className="text-xs text-muted-foreground">Descargando {st.kind.toUpperCase()}{st.p != null ? ` · ${Math.round(st.p * 100)}%` : " · tamaño desconocido"}</span>
          </div>
        )}
        {st.state === "done" && <p className="flex gap-2 text-sm text-success"><CheckCircle2 className="size-4 shrink-0" /> {st.text}</p>}
        {st.state === "error" && <p className="flex gap-2 text-sm text-destructive"><XCircle className="size-4 shrink-0" /> {st.text}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-semibold">Videos descargados</h2>
        {watching && (
          <div className="flex flex-col gap-2">
            <video src={watching.src} controls autoPlay playsInline className="w-full rounded-2xl bg-card" />
            <Button variant="secondary" onClick={() => setWatching(null)}>Cerrar video</Button>
          </div>
        )}
        {videos.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Todavía no descargaste videos.</p>}
        {videos.map((v) => (
          <div key={v.id} className="flex items-center gap-3 rounded-xl bg-secondary/60 p-2">
            <button onClick={() => watch(v)} className="bg-neon flex size-12 shrink-0 items-center justify-center rounded-lg" aria-label="Ver video"><Play className="text-primary-foreground" /></button>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{v.title}</div>
              <div className="text-xs text-muted-foreground">{(v.size / 1048576).toFixed(1)} MB · {v.source}</div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => importAudio(v)} aria-label="Importar audio"><Music2 /></Button>
            <Button size="sm" variant="ghost" onClick={async () => { await removeVideo(v.id); refresh(); }} aria-label="Quitar video"><Trash2 /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}
