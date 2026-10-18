// Static SPA build used only for the Android APK (Capacitor webDir). No server code.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: "mobile",
  base: "./",
  publicDir: "../public",
  plugins: [react(), tailwindcss(), ],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: { outDir: "../dist-mobile", emptyOutDir: true },
});
