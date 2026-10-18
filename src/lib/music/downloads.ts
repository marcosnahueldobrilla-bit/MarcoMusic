// Authorized downloads: only direct file links (own content, Creative Commons, sources that offer a download).
// Never extracts streams from YouTube or other platforms.
import { del, get, set } from "idb-keyval";
import { importFiles } from "./library";

export type DownloadKind = "mp3" | "mp4";
export type VideoItem = { id: string; title: string; fileName: string; size: number; source: string; addedAt: number };

const BLOCKED_HOSTS = /(^|\.)(youtube\.com|youtu\.be|googlevideo\.com|youtube-nocookie\.com|spotify\.com|music\.apple\.com|tiktok\.com|instagram\.com|soundcloud\.com)$/i;

export class DownloadError extends Error {}

export function validateSource(raw: string): URL {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { throw new DownloadError("El enlace no es válido."); }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new DownloadError("Solo se aceptan enlaces web (https).");
  if (BLOCKED_HOSTS.test(u.hostname)) throw new DownloadError("Esta fuente no permite descargar su contenido. Podés reproducirlo, pero no guardarlo.");
  return u;
}

function fileNameFrom(u: URL, res: Response, kind: DownloadKind) {
  const cd = res.headers.get("content-disposition") || "";
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  let name = decodeURIComponent((m?.[1] || u.pathname.split("/").pop() || "descarga").trim());
  if (!new RegExp(`\\.${kind}$`, "i").test(name)) name = name.replace(/\.[a-z0-9]{2,4}$/i, "") + "." + kind;
  return name;
}

/** Downloads a direct file link, reporting real progress (null when the server doesn't send a size). */
export async function downloadFile(raw: string, kind: DownloadKind, onProgress: (p: number | null) => void): Promise<File> {
  const u = validateSource(raw);
  let res: Response;
  try { res = await fetch(u.href); } catch {
    throw new DownloadError("No se pudo conectar con la fuente. Puede que no permita descargas desde apps o que no tengas Internet.");
  }
  if (!res.ok) throw new DownloadError(`La fuente respondió con error ${res.status}.`);
  const type = (res.headers.get("content-type") || "").split(";")[0]!.trim().toLowerCase();
  const okType = kind === "mp3" ? type.startsWith("audio/") || type === "application/octet-stream" : type.startsWith("video/") || type === "application/octet-stream";
  if (!okType) throw new DownloadError(kind === "mp3" ? "El enlace no es un archivo de audio descargable." : "El enlace no es un archivo de video descargable.");
  const total = Number(res.headers.get("content-length")) || 0;
  const chunks: BlobPart[] = [];
  let got = 0;
  onProgress(total ? 0 : null);
  if (res.body) {
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      got += value.length;
      onProgress(total ? Math.min(1, got / total) : null);
    }
  } else chunks.push(await res.blob());
  const blob = new Blob(chunks, { type: type || (kind === "mp3" ? "audio/mpeg" : "video/mp4") });
  if (!blob.size) throw new DownloadError("El archivo descargado está vacío.");
  // lastModified fixed so the same file always gets the same library id (no duplicates).
  return new File([blob], fileNameFrom(u, res, kind), { type: blob.type, lastModified: 0 });
}

/** Stores an audio file in the app's private storage and returns library tracks. */
export const audioToTracks = (file: File) => importFiles([file]);

const VIDEOS = "videos:index";
export const listVideos = async () => ((await get<VideoItem[]>(VIDEOS)) || []).sort((a, b) => b.addedAt - a.addedAt);

export async function saveVideo(file: File, source: string): Promise<VideoItem> {
  const id = `v:${file.name}:${file.size}`;
  const list = await listVideos();
  const existing = list.find((v) => v.id === id);
  if (existing) return existing;
  await set("blob:" + id, file);
  const item: VideoItem = { id, title: file.name.replace(/\.mp4$/i, "").replace(/[_]+/g, " "), fileName: file.name, size: file.size, source, addedAt: Date.now() };
  await set(VIDEOS, [item, ...list]);
  return item;
}

export async function videoFile(v: VideoItem): Promise<File | undefined> {
  const b = await get<Blob>("blob:" + v.id);
  return b ? new File([b], v.fileName, { type: "video/mp4", lastModified: 0 }) : undefined;
}

/** Removes MARCOMUSIC's own copy only; never touches the user's files. */
export async function removeVideo(id: string) {
  await del("blob:" + id);
  await set(VIDEOS, (await listVideos()).filter((v) => v.id !== id));
}
