import { createRoot } from "react-dom/client";
import { SplashScreen } from "@capacitor/splash-screen";
import "@/styles.css";
import MarcoApp from "@/components/marco/MarcoApp";
import { Toaster } from "@/components/ui/sonner";

function MobileBuildInfo() {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-2xl font-bold">Generar APK</h1>
      <p className="text-muted-foreground">
        Las nuevas versiones se compilan desde la versión web de MARCOMUSIC (botón «GENERAR Y DESCARGAR APK»). Descargá el APK nuevo e instalalo encima de esta versión.
      </p>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <>
    <MarcoApp buildPanel={<MobileBuildInfo />} />
    <Toaster theme="dark" position="top-center" />
  </>,
);
SplashScreen.hide().catch(() => {});
