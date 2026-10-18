import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import MarcoApp from "@/components/marco/MarcoApp";
import BuildScreen from "@/components/marco/BuildScreen";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MARCOMUSIC — Tu música offline" },
      { name: "description", content: "Reproductor de música offline para Android: escuchá tus canciones descargadas, playlists y favoritos." },
      { property: "og:title", content: "MARCOMUSIC — Tu música offline" },
      { property: "og:description", content: "Reproductor de música offline para Android con playlists, favoritos y APK instalable." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ClientOnly fallback={<div className="bg-app min-h-screen" />}>
      <MarcoApp buildPanel={<BuildScreen />} />
    </ClientOnly>
  ),
});
