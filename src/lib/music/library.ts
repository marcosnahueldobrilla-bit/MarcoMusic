// File access layer: native Android scan (Capacitor Filesystem), manual picker, metadata.
import { Capacitor } from "@capacitor/core";
import { get, set } from "idb-keyval";
import type { Track } from "./types";

export const AUDIO_EXT = /\.(mp3|m4a|aac|wav|flac|ogg|oga|opus|weba|webm|wma|amr|3gp|mp4|m4b)$/i;
export const isNative = () => Capacitor.isNativePlatform();

// Common folders, including Snaptube's defaults (snaptube/download/SnapTube Audio).
const SCAN_ROOTS = ["Music", "Download", "Downloads", "snaptube", "Snaptube", "Audiobooks", "Podcasts", "Recordings", "Documents", "Ringtones"];

function cleanName(file: string) {
  return file.replace(AUDIO_EXT, "").replace(/[_]+/g, " ").trim();
}

function guessFromName(file: string) {
  const base = cleanName(file);
  const m = base.split(" - ");
  if (m.length >= 2) return { artist: m[0]!.trim(), title: m.slice(1).join(" - ").trim() };
  return { artist: "Artista desconocido", title: base };
}

export async function scanDevice(onProgress?: (n: number, dir: string) => void): Promise<Track[]> {
  if (!isNative()) throw new Error("El escaneo automático solo funciona en la app Android. En el navegador usá «Agregar archivos».");
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  try {
    await Filesystem.requestPermissions();
  } catch {
    /* Android 13+ uses READ_MEDIA_AUDIO, requested at app start */
  }
  const found: Track[] = [];
  const seen = new Set<string>();
  const walk = async (path: string, depth: number) => {
    if (depth > 7) return;
    let res;
    try {
      res = await Filesystem.readdir({ path, directory: Directory.ExternalStorage });
    } catch {
      return;
    }
    onProgress?.(found.length, path);
    for (const f of res.files) {
      if (f.name.startsWith(".")) continue;
      const p = `${path}/${f.name}`;
      if (f.type === "directory") await walk(p, depth + 1);
      else if (AUDIO_EXT.test(f.name) && !seen.has(f.uri)) {
        seen.add(f.uri);
        const g = guessFromName(f.name);
        found.push({
          id: "n:" + f.uri,
          title: g.title,
          artist: g.artist,
          album: path.split("/").pop() || "",
          fileName: f.name,
          source: "native",
          path: f.uri,
          addedAt: Math.round(f.mtime || Date.now()),
        });
      }
    }
  };
  for (const root of SCAN_ROOTS) await walk(root, 0);
  return found;
}

export async function importFiles(files: File[]): Promise<Track[]> {
  const out: Track[] = [];
  for (const file of files) {
    if (!AUDIO_EXT.test(file.name) && !file.type.startsWith("audio/")) continue;
    const id = `b:${file.name}:${file.size}:${file.lastModified}`;
    await set("blob:" + id, file);
    const g = guessFromName(file.name);
    const t: Track = { id, title: g.title, artist: g.artist, album: "", fileName: file.name, source: "blob", addedAt: Date.now() };
    Object.assign(t, await readMeta(file).catch(() => ({ metaLoaded: true })));
    out.push(t);
  }
  return out;
}

const urlCache = new Map<string, string>();
export async function getPlayableUrl(t: Track): Promise<string> {
  if (t.source === "native" && t.path) return Capacitor.convertFileSrc(t.path);
  const cached = urlCache.get(t.id);
  if (cached) return cached;
  const blob = await get<Blob>("blob:" + t.id);
  if (!blob) throw new Error("El archivo ya no está disponible. Volvé a agregarlo.");
  const url = URL.createObjectURL(blob);
  urlCache.set(t.id, url);
  return url;
}

async function shrinkCover(blob: Blob): Promise<string | undefined> {
  try {
    const bmp = await createImageBitmap(blob);
    const size = 300;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d")!;
    const s = Math.min(bmp.width, bmp.height);
    ctx.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size);
    return c.toDataURL("image/jpeg", 0.8);
  } catch {
    return undefined;
  }
}

export async function readMeta(blob: Blob): Promise<Partial<Track>> {
  const mm = await import("music-metadata");
  const m = await mm.parseBlob(blob, { duration: false });
  const pic = m.common.picture?.[0];
  const cover = pic ? await shrinkCover(new Blob([pic.data as BlobPart], { type: pic.format })) : undefined;
  const r: Partial<Track> = { metaLoaded: true, duration: m.format.duration };
  if (m.common.title) r.title = m.common.title;
  if (m.common.artist) r.artist = m.common.artist;
  if (m.common.album) r.album = m.common.album;
  if (cover) r.cover = cover;
  return r;
}

export async function readNativeMeta(t: Track): Promise<Partial<Track>> {
  const res = await fetch(await getPlayableUrl(t));
  return readMeta(await res.blob());
}
