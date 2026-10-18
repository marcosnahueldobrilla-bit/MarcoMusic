import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Home, Library, ListMusic, Heart, Settings, Package, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1,
  ChevronDown, Search, Youtube, FolderSearch, FilePlus2, MoreVertical, Plus, Trash2, ListPlus, Music2, ArrowLeft, ListOrdered, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import * as M from "@/lib/music/store";
import { importFiles, isNative, scanDevice } from "@/lib/music/library";
import type { Track } from "@/lib/music/types";
import icon from "@/assets/icon.png";
import YouTubeScreen from "./YouTubeScreen";

type Screen = "home" | "library" | "playlists" | "favorites" | "settings" | "build" | "youtube" | `pl:${string}`;

export default function MarcoApp({ buildPanel }: { buildPanel: ReactNode }) {
  const [splash, setSplash] = useState(true);
  const [screen, setScreen] = useState<Screen>("home");
  const [full, setFull] = useState(false);
  const ready = M.useMusic((s) => s.ready);
  const err = M.useMusic((s) => s.error);

  useEffect(() => {
    M.init();
    const t = setTimeout(() => setSplash(false), 1400);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => { if (err) toast.error(err); }, [err]);

  if (splash || !ready) {
    return (
      <div className="bg-app flex min-h-screen flex-col items-center justify-center gap-6">
        <img src={icon} alt="MARCOMUSIC" width={140} height={140} className="animate-splash rounded-3xl" />
        <h1 className="text-neon text-3xl font-bold tracking-widest">MARCOMUSIC</h1>
      </div>
    );
  }

  const tabs: { id: Screen; label: string; Icon: typeof Home }[] = [
    { id: "home", label: "Inicio", Icon: Home },
    { id: "library", label: "Biblioteca", Icon: Library },
    { id: "youtube", label: "YouTube", Icon: Youtube },
    { id: "playlists", label: "Playlists", Icon: ListMusic },
    { id: "favorites", label: "Favoritos", Icon: Heart },
  ];

  return (
    <div className="bg-app mx-auto flex min-h-screen max-w-xl flex-col">
      <header className="glass sticky top-0 z-20 flex items-center gap-3 px-4 py-3" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <img src={icon} alt="" width={34} height={34} className="rounded-lg" />
        <span className="text-neon font-display text-lg font-bold tracking-wider">MARCOMUSIC</span>
        <div className="ml-auto flex gap-1">
          <Button size="icon" variant="ghost" aria-label="Generar APK" onClick={() => setScreen("build")}><Package /></Button>
          <Button size="icon" variant="ghost" aria-label="Configuración" onClick={() => setScreen("settings")}><Settings /></Button>
        </div>
      </header>

      <main className="flex-1 px-4 pb-44 pt-4">
        {screen === "home" && <HomeScreen go={setScreen} />}
        {screen === "library" && <LibraryScreen />}
        {screen === "playlists" && <PlaylistsScreen open={(id) => setScreen(`pl:${id}`)} />}
        {screen.startsWith("pl:") && <PlaylistDetail id={screen.slice(3)} back={() => setScreen("playlists")} />}
        {screen === "favorites" && <FavoritesScreen />}
        {screen === "settings" && <SettingsScreen go={setScreen} />}
        {screen === "build" && buildPanel}
        {screen === "youtube" && <YouTubeScreen toLibrary={() => setScreen("library")} />}
      </main>

      <MiniPlayer onOpen={() => setFull(true)} />
      <nav className="glass pb-safe fixed bottom-0 left-1/2 z-30 flex w-full max-w-xl -translate-x-1/2 border-t">
        {tabs.map(({ id, label, Icon }) => {
          const active = screen === id || (id === "playlists" && screen.startsWith("pl:"));
          return (
            <button key={id} onClick={() => setScreen(id)} className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs ${active ? "text-primary" : "text-muted-foreground"}`}>
              <Icon className={`size-5 ${active ? "drop-shadow-[0_0_8px_var(--fuchsia-neon)]" : ""}`} />
              {label}
            </button>
          );
        })}
      </nav>
      {full && <FullPlayer onClose={() => setFull(false)} />}
    </div>
  );
}

/* ---------- shared ---------- */
function Cover({ t, size = 48 }: { t?: Track; size?: number }) {
  return t?.cover ? (
    <img src={t.cover} alt="" width={size} height={size} className="shrink-0 rounded-lg object-cover" style={{ width: size, height: size }} />
  ) : (
    <div className="bg-neon flex shrink-0 items-center justify-center rounded-lg" style={{ width: size, height: size }}>
      <Music2 className="text-primary-foreground" style={{ width: size / 2.4, height: size / 2.4 }} />
    </div>
  );
}

function TrackRow({ t, list, playlistId }: { t: Track; list: string[]; playlistId?: string | undefined }) {
  const cur = M.useMusic((s) => s.queue[s.index]);
  const playing = M.useMusic((s) => s.playing);
  const fav = M.useMusic((s) => s.favorites.includes(t.id));
  const playlists = M.useMusic((s) => s.playlists);
  const active = cur === t.id;
  return (
    <div className={`flex items-center gap-3 rounded-xl p-2 ${active ? "bg-secondary" : ""}`}>
      <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => M.playList(list, t.id)}>
        <Cover t={t} />
        <div className="min-w-0 flex-1">
          <div className={`truncate font-semibold ${active ? "text-primary" : ""}`}>{t.title}</div>
          <div className="truncate text-sm text-muted-foreground">{t.artist}{t.album ? ` · ${t.album}` : ""}</div>
        </div>
        {active && playing && <Eq />}
      </button>
      <button aria-label="Favorito" onClick={() => M.toggleFavorite(t.id)} className="p-1.5">
        <Heart className={`size-5 ${fav ? "fill-primary text-primary" : "text-muted-foreground"}`} />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><button aria-label="Más opciones" className="p-1.5 text-muted-foreground"><MoreVertical className="size-5" /></button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => { M.addToQueue(t.id); toast("Agregada a la cola"); }}><ListOrdered /> Agregar a la cola</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Agregar a playlist</DropdownMenuLabel>
          {playlists.length === 0 && <DropdownMenuItem disabled>No hay playlists</DropdownMenuItem>}
          {playlists.map((p) => (
            <DropdownMenuItem key={p.id} onClick={() => { M.addToPlaylist(p.id, t.id); toast(`Agregada a ${p.name}`); }}><ListPlus /> {p.name}</DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {playlistId ? (
            <DropdownMenuItem onClick={() => M.removeFromPlaylist(playlistId, t.id)}><X /> Quitar de la playlist</DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => M.removeTrack(t.id)}><Trash2 /> Quitar de la biblioteca</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function Eq() {
  return (
    <div className="flex h-4 items-end gap-0.5">
      {[0, 0.2, 0.4].map((d) => <span key={d} className="bg-neon animate-eq h-4 w-1 rounded" style={{ animationDelay: `${d}s` }} />)}
    </div>
  );
}

function TrackList({ tracks, playlistId, empty }: { tracks: Track[]; playlistId?: string | undefined; empty: ReactNode }) {
  const ids = useMemo(() => tracks.map((t) => t.id), [tracks]);
  if (!tracks.length) return <div className="py-12 text-center text-muted-foreground">{empty}</div>;
  return <div className="flex flex-col gap-1">{tracks.map((t) => <TrackRow key={t.id} t={t} list={ids} playlistId={playlistId} />)}</div>;
}

function useImport() {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState("");
  const scan = async () => {
    setBusy("Buscando música…");
    try {
      const found = await scanDevice((n, dir) => setBusy(`${n} canciones · ${dir}`));
      await M.addTracks(found);
      toast.success(found.length ? `${found.length} canciones encontradas` : "No se encontraron canciones. Probá «Agregar archivos».");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo escanear");
    } finally { setBusy(""); }
  };
  const input = (
    <input ref={ref} type="file" accept="audio/*,.mp3,.m4a,.aac,.wav,.flac,.ogg,.opus" multiple hidden
      onChange={async (e) => {
        const files = [...(e.target.files || [])];
        e.target.value = "";
        if (!files.length) return;
        setBusy(`Importando ${files.length} archivos…`);
        const t = await importFiles(files);
        await M.addTracks(t);
        setBusy("");
        toast.success(`${t.length} canciones agregadas`);
      }} />
  );
  return { scan, pick: () => ref.current?.click(), busy, input };
}

function ImportButtons() {
  const { scan, pick, busy, input } = useImport();
  return (
    <div className="flex flex-col gap-2">
      {input}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="neon" onClick={scan} disabled={!!busy}><FolderSearch /> Escanear celular</Button>
        <Button variant="secondary" onClick={pick} disabled={!!busy}><FilePlus2 /> Agregar archivos</Button>
      </div>
      {busy && <p className="text-center text-sm text-muted-foreground">{busy}</p>}
      {!isNative() && <p className="text-center text-xs text-muted-foreground">En el navegador usá «Agregar archivos». El escaneo automático funciona en la app instalada.</p>}
    </div>
  );
}

/* ---------- screens ---------- */
function HomeScreen({ go }: { go: (s: Screen) => void }) {
  const tracks = M.useMusic((s) => s.tracks);
  const favs = M.useMusic((s) => s.favorites.length);
  const pls = M.useMusic((s) => s.playlists.length);
  const recent = useMemo(() => [...tracks].sort((a, b) => b.addedAt - a.addedAt).slice(0, 8), [tracks]);
  return (
    <div className="flex flex-col gap-6">
      <section className="bg-neon shadow-violet relative overflow-hidden rounded-2xl p-5">
        <p className="text-sm text-primary-foreground/80">Tu música, sin Internet</p>
        <h1 className="mt-1 text-2xl font-bold text-primary-foreground">Hola 👋</h1>
        <div className="mt-4 flex gap-6 text-primary-foreground">
          <Stat n={tracks.length} l="canciones" /><Stat n={favs} l="favoritos" /><Stat n={pls} l="playlists" />
        </div>
        {tracks.length > 0 && (
          <Button variant="secondary" className="mt-4" onClick={() => M.playList(tracks.map((t) => t.id))}><Play /> Reproducir todo</Button>
        )}
      </section>
      <ImportButtons />
      <button onClick={() => go("build")} className="flex items-center gap-3 rounded-2xl border bg-card p-4 text-left">
        <Package className="size-8 text-primary" />
        <div><div className="font-semibold">Generar APK</div><div className="text-sm text-muted-foreground">Compilá e instalá MARCOMUSIC en tu Android</div></div>
      </button>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Agregadas recientemente</h2>
        <TrackList tracks={recent} empty="Todavía no hay canciones. Escaneá tu celular o agregá archivos." />
      </section>
    </div>
  );
}
const Stat = ({ n, l }: { n: number; l: string }) => (<div><div className="font-display text-xl font-bold">{n}</div><div className="text-xs opacity-80">{l}</div></div>);

function LibraryScreen() {
  const tracks = M.useMusic((s) => s.tracks);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"title" | "artist" | "album" | "added">("title");
  const list = useMemo(() => {
    const r = M.searchTracks(tracks, q);
    return [...r].sort((a, b) => (sort === "added" ? b.addedAt - a.addedAt : a[sort].localeCompare(b[sort])));
  }, [tracks, q, sort]);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Biblioteca</h1>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar canción, artista o álbum" className="pl-9" />
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {(["title", "artist", "album", "added"] as const).map((s) => (
          <Button key={s} size="sm" variant={sort === s ? "neon" : "secondary"} onClick={() => setSort(s)}>
            {{ title: "Título", artist: "Artista", album: "Álbum", added: "Recientes" }[s]}
          </Button>
        ))}
      </div>
      <ImportButtons />
      <TrackList tracks={list} empty={q ? "Sin resultados" : "Biblioteca vacía"} />
    </div>
  );
}

function PlaylistsScreen({ open }: { open: (id: string) => void }) {
  const pls = M.useMusic((s) => s.playlists);
  const tracks = M.useMusic((s) => s.tracks);
  const [name, setName] = useState("");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Playlists</h1>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; M.createPlaylist(name); setName(""); }}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la nueva playlist" />
        <Button variant="neon" type="submit"><Plus /> Crear</Button>
      </form>
      {pls.length === 0 && <p className="py-10 text-center text-muted-foreground">Creá tu primera playlist.</p>}
      <div className="grid grid-cols-2 gap-3">
        {pls.map((p) => {
          const first = tracks.find((t) => t.id === p.trackIds[0]);
          return (
            <button key={p.id} onClick={() => open(p.id)} className="rounded-2xl border bg-card p-3 text-left">
              <div className="mb-2 aspect-square w-full overflow-hidden rounded-xl">
                {first?.cover ? <img src={first.cover} alt="" className="size-full object-cover" /> : <div className="bg-neon flex size-full items-center justify-center"><ListMusic className="size-10 text-primary-foreground" /></div>}
              </div>
              <div className="truncate font-semibold">{p.name}</div>
              <div className="text-sm text-muted-foreground">{p.trackIds.length} canciones</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PlaylistDetail({ id, back }: { id: string; back: () => void }) {
  const p = M.useMusic((s) => s.playlists.find((x) => x.id === id));
  const all = M.useMusic((s) => s.tracks);
  if (!p) return <Button variant="ghost" onClick={back}><ArrowLeft /> Volver</Button>;
  const tracks = p.trackIds.map((t) => all.find((x) => x.id === t)).filter(Boolean) as Track[];
  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" className="self-start" onClick={back}><ArrowLeft /> Playlists</Button>
      <Input defaultValue={p.name} onBlur={(e) => M.renamePlaylist(p.id, e.target.value || p.name)} className="font-display text-xl font-bold" />
      <div className="flex gap-2">
        <Button variant="neon" disabled={!tracks.length} onClick={() => M.playList(p.trackIds)}><Play /> Reproducir</Button>
        <Button variant="secondary" onClick={() => { M.deletePlaylist(p.id); back(); }}><Trash2 /> Eliminar</Button>
      </div>
      <TrackList tracks={tracks} playlistId={p.id} empty="Agregá canciones desde la Biblioteca con el menú ⋮" />
    </div>
  );
}

function FavoritesScreen() {
  const favs = M.useMusic((s) => s.favorites);
  const all = M.useMusic((s) => s.tracks);
  const tracks = useMemo(() => favs.map((f) => all.find((t) => t.id === f)).filter(Boolean) as Track[], [favs, all]);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Favoritos</h1>
      {tracks.length > 0 && <Button variant="neon" className="self-start" onClick={() => M.playList(favs)}><Play /> Reproducir favoritos</Button>}
      <TrackList tracks={tracks} empty="Tocá el corazón de una canción para guardarla acá." />
    </div>
  );
}

function SettingsScreen({ go }: { go: (s: Screen) => void }) {
  const shuffle = M.useMusic((s) => s.shuffle);
  const repeat = M.useMusic((s) => s.repeat);
  const volume = M.useMusic((s) => s.volume);
  const count = M.useMusic((s) => s.tracks.length);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Configuración</h1>
      <Button variant="neon" size="lg" onClick={() => go("build")}><Package /> Generar APK</Button>
      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-4">
        <label className="flex items-center justify-between">Aleatorio <Switch checked={shuffle} onCheckedChange={M.toggleShuffle} /></label>
        <div className="flex items-center justify-between">Repetición <Button size="sm" variant="secondary" onClick={M.cycleRepeat}>{{ off: "Desactivada", all: "Todas", one: "Una canción" }[repeat]}</Button></div>
        <div className="flex flex-col gap-2">Volumen <Slider value={[volume]} max={1} step={0.01} onValueChange={([v]) => M.setVolume(v ?? 1)} /></div>
      </div>
      <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
        {count} canciones indexadas. Todo se guarda en este dispositivo, sin cuenta.
        <Button variant="destructive" size="sm" className="mt-3 w-full" onClick={() => confirm("¿Vaciar biblioteca, favoritos y playlists?") && M.clearLibrary()}><Trash2 /> Vaciar biblioteca</Button>
      </div>
    </div>
  );
}

/* ---------- players ---------- */
function MiniPlayer({ onOpen }: { onOpen: () => void }) {
  const t = M.useMusic(M.currentTrack);
  const playing = M.useMusic((s) => s.playing);
  const pos = M.useMusic((s) => s.position);
  const dur = M.useMusic((s) => s.duration);
  if (!t) return null;
  return (
    <div className="fixed bottom-[68px] left-1/2 z-30 w-full max-w-xl -translate-x-1/2 px-2" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
      <div className="glass shadow-neon overflow-hidden rounded-2xl border">
        <div className="flex items-center gap-3 p-2">
          <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={onOpen}>
            <Cover t={t} size={44} />
            <div className="min-w-0"><div className="truncate text-sm font-semibold">{t.title}</div><div className="truncate text-xs text-muted-foreground">{t.artist}</div></div>
          </button>
          <Button size="icon" variant="ghost" onClick={() => M.prev()} aria-label="Anterior"><SkipBack /></Button>
          <Button size="icon" variant="neon" className="rounded-full" onClick={M.toggle} aria-label={playing ? "Pausa" : "Reproducir"}>{playing ? <Pause /> : <Play />}</Button>
          <Button size="icon" variant="ghost" onClick={() => M.next()} aria-label="Siguiente"><SkipForward /></Button>
        </div>
        <div className="h-0.5 bg-muted"><div className="bg-neon h-full" style={{ width: `${dur ? (pos / dur) * 100 : 0}%` }} /></div>
      </div>
    </div>
  );
}

function FullPlayer({ onClose }: { onClose: () => void }) {
  const s = M.useMusic((x) => x);
  const t = M.currentTrack(s);
  const [queueOpen, setQueueOpen] = useState(false);
  if (!t) return null;
  const fav = s.favorites.includes(t.id);
  return (
    <div className="bg-app fixed inset-0 z-50 flex flex-col overflow-y-auto px-6 pb-8" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="flex items-center justify-between py-2">
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Cerrar"><ChevronDown /></Button>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Reproduciendo</span>
          <Button size="icon" variant="ghost" onClick={() => setQueueOpen(!queueOpen)} aria-label="Cola"><ListOrdered className={queueOpen ? "text-primary" : ""} /></Button>
        </div>
        {queueOpen ? (
          <div className="flex flex-1 flex-col gap-1 py-4">
            <h2 className="mb-2 font-semibold">Cola de reproducción ({s.queue.length})</h2>
            {s.queue.map((id, i) => {
              const q = M.trackById(id);
              if (!q) return null;
              return (
                <div key={id + i} className={`flex items-center gap-3 rounded-xl p-2 ${i === s.index ? "bg-secondary" : ""}`}>
                  <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => M.playAt(i)}>
                    <Cover t={q} size={40} />
                    <div className="min-w-0"><div className={`truncate text-sm font-semibold ${i === s.index ? "text-primary" : ""}`}>{q.title}</div><div className="truncate text-xs text-muted-foreground">{q.artist}</div></div>
                  </button>
                  {i !== s.index && <button onClick={() => M.removeFromQueue(i)} aria-label="Quitar" className="p-1 text-muted-foreground"><X className="size-4" /></button>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center py-6">
            <div className="shadow-violet aspect-square w-full overflow-hidden rounded-3xl">
              {t.cover ? <img src={t.cover} alt="" className="size-full object-cover" /> : <div className="bg-neon flex size-full items-center justify-center"><Music2 className="size-28 text-primary-foreground" /></div>}
            </div>
          </div>
        )}
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-bold">{t.title}</h2>
            <p className="truncate text-muted-foreground">{t.artist}{t.album ? ` · ${t.album}` : ""}</p>
          </div>
          <button onClick={() => M.toggleFavorite(t.id)} aria-label="Favorito"><Heart className={`size-7 ${fav ? "fill-primary text-primary" : "text-muted-foreground"}`} /></button>
        </div>
        <div className="mt-5">
          <Slider value={[s.position]} max={s.duration || 1} step={0.5} onValueChange={([v]) => M.seek(v ?? 0)} />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>{M.fmtTime(s.position)}</span><span>{M.fmtTime(s.duration)}</span></div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <Button size="icon" variant="ghost" onClick={M.toggleShuffle} aria-label="Aleatorio"><Shuffle className={s.shuffle ? "text-primary" : ""} /></Button>
          <Button size="icon" variant="ghost" className="size-14" onClick={() => M.prev()} aria-label="Anterior"><SkipBack className="size-7" /></Button>
          <Button variant="neon" className="size-20 rounded-full" onClick={M.toggle} aria-label={s.playing ? "Pausa" : "Reproducir"}>{s.playing ? <Pause className="size-9" /> : <Play className="size-9" />}</Button>
          <Button size="icon" variant="ghost" className="size-14" onClick={() => M.next()} aria-label="Siguiente"><SkipForward className="size-7" /></Button>
          <Button size="icon" variant="ghost" onClick={M.cycleRepeat} aria-label="Repetir">{s.repeat === "one" ? <Repeat1 className="text-primary" /> : <Repeat className={s.repeat === "all" ? "text-primary" : ""} />}</Button>
        </div>
      </div>
    </div>
  );
}
