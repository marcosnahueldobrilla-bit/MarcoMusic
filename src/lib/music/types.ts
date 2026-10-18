export type Track = {
  id: string;
  title: string;
  artist: string;
  album: string;
  fileName: string;
  duration?: number | undefined;
  cover?: string | undefined;
  /** native = file on the Android device; blob = file picked manually and stored in IndexedDB */
  source: "native" | "blob";
  path?: string | undefined;
  addedAt: number;
  metaLoaded?: boolean | undefined;
};

export type Playlist = { id: string; name: string; trackIds: string[]; createdAt: number };
export type RepeatMode = "off" | "all" | "one";
