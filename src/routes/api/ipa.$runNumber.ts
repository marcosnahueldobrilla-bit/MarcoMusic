import { createFileRoute } from "@tanstack/react-router";

// Streams the IPA from the GitHub release created by the iOS workflow. Credentials stay on the server.
export const Route = createFileRoute("/api/ipa/$runNumber")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!/^\d{1,7}$/.test(params.runNumber)) return new Response("Bad request", { status: 400 });
        const { gh } = await import("@/lib/build/github.server");
        const rel = await gh(`/releases/tags/ipa-${params.runNumber}`);
        if (!rel.ok) return new Response("IPA no encontrado", { status: 404 });
        const data = (await rel.json()) as { assets: { url: string; name: string; size: number }[] };
        const asset = data.assets.find((a) => a.name.endsWith(".ipa"));
        if (!asset) return new Response("IPA no encontrado", { status: 404 });
        let file = await gh(asset.url, { headers: { Accept: "application/octet-stream" }, redirect: "manual" });
        const loc = file.headers.get("location");
        if (file.status >= 300 && file.status < 400 && loc) file = await fetch(loc);
        if (!file.ok || !file.body) {
          console.error(`IPA download failed [${file.status}]`);
          return new Response("No se pudo descargar el IPA", { status: 502 });
        }
        return new Response(file.body, {
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename="${asset.name}"`,
            "Content-Length": String(asset.size),
          },
        });
      },
    },
  },
});
