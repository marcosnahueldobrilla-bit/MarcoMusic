// State + persistence (IndexedDB for tracks, localStorage for prefs/lists) + playback engine.
import { useSyncExternalStore } from "react";
import { get, set } from "idb-keyval";
import { MediaSession } from "@jofr/capacitor-media-session";
import type { Playlist, RepeatMode, Track } from "./types";
import { getPlayableUrl, readNativeMeta } from "./library";

export type State = {
  ready: boolean;
  tracks: Track[];
  favorites: string[];
  playlists: Playlist[];
  queue: string[];
  index: number;
  playing: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  position: number;
  duration: number;
  volume: number;
  error?: string | undefined;
};

let state: State = {
  ready: false, tracks: [], favorites: [], playlists: [], queue: [], index: -1,
  playing: false, shuffle: false, repeat: "off", position: 0, duration: 0, volume: 1,
};
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
function setState(p: Partial<State>, persist = true) {
  state = { ...state, ...p };
  emit();
  if (persist && state.ready) savePrefs();
}
export const getState = () => state;
export function useMusic<T>(sel: (s: State) => T): T {
  return useSyncExternalStore((cb) => (subs.add(cb), () => subs.delete(cb)), () => sel(state), () => sel(state));
}

const PREFS = "marcomusic:prefs";
function savePrefs() {
  const { favorites, playlists, queue, index, shuffle, repeat, volume } = state;
  localStorage.setItem(PREFS, JSON.stringify({ favorites, playlists, queue, index, shuffle, repeat, volume }));
}

let audio: HTMLAudioElement | null = null;
function el() {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = "auto";
  audio.addEventListener("timeupdate", () => {
    setState({ position: audio!.currentTime }, false);
  });
  audio.addEventListener("loadedmetadata", () => setState({ duration: audio!.duration || 0 }, false));
  audio.addEventListener("play", () => { setState({ playing: true }, false); MediaSession.setPlaybackState({ playbackState: "playing" }).catch(() => {}); });
  audio.addEventListener("pause", () => { setState({ playing: false }, false); MediaSession.setPlaybackState({ playbackState: "paused" }).catch(() => {}); });
  audio.addEventListener("ended", onEnded);
  audio.addEventListener("error", () => setState({ error: "No se pudo reproducir este archivo (formato no compatible o archivo movido).", playing: false }, false));
  setupMediaSession();
  return audio;
}

function setupMediaSession() {
  const h = (action: string, fn: (d: { seekTime?: number | null }) => void) =>
    MediaSession.setActionHandler({ action: action as never }, fn as never).catch(() => {});
  h("play", () => resume());
  h("pause", () => pause());
  h("previoustrack", () => prev());
  h("nexttrack", () => next());
  h("seekto", (d) => d.seekTime != null && seek(d.seekTime));
  h("stop", () => pause());
}

export async function init() {
  if (state.ready) return;
  const tracks = (await get<Track[]>("tracks")) || [];
  let prefs: Partial<State> = {};
  try { prefs = JSON.parse(localStorage.getItem(PREFS) || "{}"); } catch { /* ignore */ }
  const ids = new Set(tracks.map((t) => t.id));
  const queue = (prefs.queue || []).filter((id) => ids.has(id));
  setState({ ...prefs, tracks, queue, index: Math.min(prefs.index ?? -1, queue.length - 1), ready: true });
  loadMissingMeta();
}

async function saveTracks() { await set("tracks", state.tracks); }

export async function addTracks(newOnes: Track[]) {
  const map = new Map(state.tracks.map((t) => [t.id, t]));
  for (const t of newOnes) if (!map.has(t.id)) map.set(t.id, t);
  setState({ tracks: [...map.values()] });
  await saveTracks();
  loadMissingMeta();
}

export async function removeTrack(id: string) {
  setState({
    tracks: state.tracks.filter((t) => t.id !== id),
    favorites: state.favorites.filter((f) => f !== id),
    playlists: state.playlists.map((p) => ({ ...p, trackIds: p.trackIds.filter((x) => x !== id) })),
  });
  await saveTracks();
}

export async function clearLibrary() {
  pause();
  setState({ tracks: [], queue: [], index: -1, favorites: [], playlists: [] });
  await saveTracks();
}

let metaRunning = false;
async function loadMissingMeta() {
  if (metaRunning) return;
  metaRunning = true;
  try {
    for (const t of state.tracks) {
      if (t.metaLoaded || t.source !== "native") continue;
      const meta = await readNativeMeta(t).catch(() => ({ metaLoaded: true }));
      setState({ tracks: state.tracks.map((x) => (x.id === t.id ? { ...x, ...meta, metaLoaded: true } : x)) }, false);
    }
    await saveTracks();
  } finally { metaRunning = false; }
}

export const trackById = (id?: string) => state.tracks.find((t) => t.id === id);
export const currentTrack = (s: State) => s.tracks.find((t) => t.id === s.queue[s.index]);

function shuffled(ids: string[], first?: string) {
  const a = ids.filter((x) => x !== first);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return first ? [first, ...a] : a;
}

export async function playList(ids: string[], startId?: string) {
  const start = startId ?? ids[0] ?? "";
  const queue = state.shuffle ? shuffled(ids, start) : ids;
  setState({ queue, index: Math.max(0, queue.indexOf(start)) });
  await loadCurrent(true);
}

async function loadCurrent(autoplay: boolean) {
  const t = currentTrack(state);
  if (!t) return;
  const a = el();
  setState({ error: undefined, position: 0 }, false);
  try {
    a.src = await getPlayableUrl(t);
    a.volume = state.volume;
    MediaSession.setMetadata({
      title: t.title, artist: t.artist, album: t.album,
      artwork: t.cover ? [{ src: t.cover, sizes: "300x300", type: "image/jpeg" }] : [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    }).catch(() => {});
    if (autoplay) await a.play();
  } catch (e) {
    setState({ error: e instanceof Error ? e.message : "Error al reproducir", playing: false }, false);
  }
}

export function pause() { audio?.pause(); }
export async function resume() {
  if (!audio?.src) return loadCurrent(true);
  await audio.play().catch(() => {});
}
export const toggle = () => (state.playing ? pause() : resume());
export function seek(t: number) {
  if (audio) audio.currentTime = t;
  MediaSession.setPositionState({ position: t, duration: state.duration || 0, playbackRate: 1 }).catch(() => {});
}
export function setVolume(v: number) { if (audio) audio.volume = v; setState({ volume: v }); }

export async function next(fromEnd = false) {
  if (!state.queue.length) return;
  let i = state.index + 1;
  if (i >= state.queue.length) {
    if (state.repeat === "all" || !fromEnd) i = 0;
    else { pause(); return; }
  }
  setState({ index: i });
  await loadCurrent(true);
}
export async function prev() {
  if (audio && audio.currentTime > 3) return seek(0);
  if (!state.queue.length) return;
  setState({ index: (state.index - 1 + state.queue.length) % state.queue.length });
  await loadCurrent(true);
}
function onEnded() {
  if (state.repeat === "one") { seek(0); audio?.play(); return; }
  next(true);
}
export async function playAt(i: number) { setState({ index: i }); await loadCurrent(true); }

export function toggleShuffle() {
  const cur = state.queue[state.index];
  const on = !state.shuffle;
  const queue = on ? shuffled(state.queue, cur) : [...state.queue].sort((a, b) => state.tracks.findIndex((t) => t.id === a) - state.tracks.findIndex((t) => t.id === b));
  setState({ shuffle: on, queue, index: Math.max(0, queue.indexOf(cur ?? "")) });
}
export function cycleRepeat() {
  setState({ repeat: state.repeat === "off" ? "all" : state.repeat === "all" ? "one" : "off" });
}
export function addToQueue(id: string) { setState({ queue: [...state.queue, id], index: state.index < 0 ? 0 : state.index }); }
export function removeFromQueue(i: number) {
  const queue = state.queue.filter((_, j) => j !== i);
  setState({ queue, index: i < state.index ? state.index - 1 : state.index });
}

export function toggleFavorite(id: string) {
  const f = state.favorites.includes(id) ? state.favorites.filter((x) => x !== id) : [...state.favorites, id];
  setState({ favorites: f });
}
export function createPlaylist(name: string) {
  const p: Playlist = { id: crypto.randomUUID(), name: name.trim() || "Nueva playlist", trackIds: [], createdAt: Date.now() };
  setState({ playlists: [...state.playlists, p] });
  return p;
}
export function deletePlaylist(id: string) { setState({ playlists: state.playlists.filter((p) => p.id !== id) }); }
export function renamePlaylist(id: string, name: string) { setState({ playlists: state.playlists.map((p) => (p.id === id ? { ...p, name } : p)) }); }
export function addToPlaylist(pid: string, tid: string) {
  setState({ playlists: state.playlists.map((p) => (p.id === pid && !p.trackIds.includes(tid) ? { ...p, trackIds: [...p.trackIds, tid] } : p)) });
}
export function removeFromPlaylist(pid: string, tid: string) {
  setState({ playlists: state.playlists.map((p) => (p.id === pid ? { ...p, trackIds: p.trackIds.filter((x) => x !== tid) } : p)) });
}

export function searchTracks(tracks: Track[], q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return tracks;
  return tracks.filter((t) => `${t.title} ${t.artist} ${t.album} ${t.fileName}`.toLowerCase().includes(s));
}

export const fmtTime = (s: number) => {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};
