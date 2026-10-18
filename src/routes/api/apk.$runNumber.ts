import { createFileRoute } from "@tanstack/react-router";

// Streams the APK from the GitHub release created by the workflow. The token stays on the server.
export const Route = createFileRoute("/api/apk/$runNumber")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!/^\d{1,7}$/.test(params.runNumber)) return new Response("Bad request", { status: 400 });
        const { gh } = await import("@/lib/build/github.server");
        const rel = await gh(`/releases/tags/apk-${params.runNumber}`);
        if (!rel.ok) return new Response("APK no encontrado", { status: 404 });
        const data = (await rel.json()) as { assets: { url: string; name: string; size: number }[] };
        const asset = data.assets.find((a) => a.name.endsWith(".apk"));
        if (!asset) return new Response("APK no encontrado", { status: 404 });
        let file = await gh(asset.url, { headers: { Accept: "application/octet-stream" }, redirect: "manual" });
        const loc = file.headers.get("location");
        if (file.status >= 300 && file.status < 400 && loc) file = await fetch(loc); // signed download URL, no auth needed
        if (!file.ok || !file.body) {
          console.error(`APK download failed [${file.status}]`);
          return new Response("No se pudo descargar el APK", { status: 502 });
        }
        return new Response(file.body, {
          headers: {
            "Content-Type": "application/vnd.android.package-archive",
            "Content-Disposition": `attachment; filename="${asset.name}"`,
            "Content-Length": String(asset.size),
          },
        });
      },
    },
  },
});
