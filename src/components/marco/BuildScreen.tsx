import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Circle, Download, ExternalLink, Loader2, RefreshCw, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { checkBuildConfig, findBuild, getBuild, latestBuild, startBuild, type BuildInfo, type ConfigCheck, type Platform } from "@/lib/build/build.functions";

type Phase = "pending" | "starting" | "building" | "done" | "error";

const UI: Record<Platform, { title: string; button: string; icon: string; file: string; dl: string; note: string }> = {
  android: {
    title: "Android", button: "GENERAR Y DESCARGAR APK", icon: "📦", file: "APK", dl: "apk",
    note: "Se genera un APK de depuración para instalar manualmente. Al abrirlo, Android pedirá permitir «instalar apps desconocidas».",
  },
};

export default function BuildScreen() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Generar APK</h1>
        <p className="text-sm text-muted-foreground">Compila MARCOMUSIC para Android en GitHub Actions y descargá el instalable.</p>
      </div>
      <PlatformBuild platform="android" />
    </div>
  );
}

function PlatformBuild({ platform }: { platform: Platform }) {
  const u = UI[platform];
  const [config, setConfig] = useState<ConfigCheck | null>(null);
  const [build, setBuild] = useState<BuildInfo | null>(null);
  const [phase, setPhase] = useState<Phase>("pending");
  const [msg, setMsg] = useState<string>("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const apply = useCallback((b: BuildInfo) => {
    setBuild(b);
    if (b.status !== "completed") setPhase("building");
    else if (b.conclusion === "success" && b.apkReady) setPhase("done");
    else if (b.conclusion === "success") { setPhase("error"); setMsg(`La compilación terminó pero no se encontró el ${u.file} publicado.`); }
    else { setPhase("error"); setMsg(failMsg(b)); }
  }, [u.file]);

  const poll = useCallback(async (runId: number) => {
    try {
      const b = await getBuild({ data: { platform, runId } });
      apply(b);
      if (b.status !== "completed") timer.current = setTimeout(() => poll(runId), 6000);
    } catch (e) { setPhase("error"); setMsg(errText(e)); }
  }, [apply, platform]);

  useEffect(() => {
    (async () => {
      try {
        const c = await checkBuildConfig({ data: { platform } });
        setConfig(c);
        if (!c.ok) return;
        const last = await latestBuild({ data: { platform } });
        if (last) { apply(last); if (last.status !== "completed") poll(last.runId); }
      } catch (e) { setMsg(errText(e)); }
    })();
    return () => clearTimeout(timer.current);
  }, [apply, poll, platform]);

  const start = async () => {
    clearTimeout(timer.current);
    setPhase("starting"); setMsg(""); setBuild(null);
    try {
      const { buildId } = await startBuild({ data: { platform } });
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const b = await findBuild({ data: { platform, buildId } });
        if (b) { apply(b); if (b.status !== "completed") poll(b.runId); return; }
      }
      setPhase("error"); setMsg("GitHub aceptó la orden pero la compilación no apareció. Revisá que Actions esté habilitado en el repositorio.");
    } catch (e) { setPhase("error"); setMsg(errText(e)); }
  };

  const busy = phase === "starting" || phase === "building";
  const label = { pending: "Pendiente", starting: "Iniciando…", building: build?.status === "queued" ? "En cola" : "Compilando", done: "Completado", error: "Error" }[phase];

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{u.title}</h2>
      {config && !config.ok && (
        <div className="rounded-2xl border border-destructive/60 bg-card p-4">
          <div className="mb-2 flex items-center gap-2 font-semibold"><AlertTriangle className="size-5 text-destructive" /> Falta configuración</div>
          <ul className="flex flex-col gap-1.5 text-sm">
            {config.checks.map((c) => (
              <li key={c.label} className="flex gap-2">
                {c.ok ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : <XCircle className="size-4 shrink-0 text-destructive" />}
                <span>{c.label}{c.detail ? <span className="block text-muted-foreground">{c.detail}</span> : null}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Button variant="mega" size="xl" disabled={!config?.ok || busy} onClick={start}>
        {busy ? <Loader2 className="size-5 animate-spin" /> : u.icon} {u.button}
      </Button>

      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Estado</span>
          <span className={`font-semibold ${phase === "done" ? "text-success" : phase === "error" ? "text-destructive" : "text-primary"}`}>{label}</span>
        </div>
        {build?.progress != null && phase === "building" && (
          <div className="flex flex-col gap-1">
            <Progress value={build.progress * 100} />
            <span className="text-xs text-muted-foreground">{build.steps.filter((s) => s.status === "completed").length} de {build.steps.length} pasos</span>
          </div>
        )}
        {build && (
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Versión</dt><dd>{build.version}</dd>
            <dt className="text-muted-foreground">Última compilación</dt><dd>{new Date(build.createdAt).toLocaleString("es-AR")}</dd>
          </dl>
        )}
        {msg && <p className="rounded-lg bg-muted p-3 text-sm text-destructive">{msg}</p>}

        {phase === "done" && build?.apkReady && (
          <Button asChild variant="neon" size="lg">
            <a href={`/api/${u.dl}/${build.runNumber}`} download={build.apkName}><Download /> DESCARGAR {u.file} {build.apkSize ? `(${(build.apkSize / 1048576).toFixed(1)} MB)` : ""}</a>
          </Button>
        )}
        {phase === "error" && config?.ok && <Button variant="secondary" onClick={start}><RefreshCw /> Volver a intentar</Button>}
        {build && <a href={build.htmlUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground underline"><ExternalLink className="size-3" /> Ver registro completo en GitHub</a>}
      </div>

      {build && build.steps.length > 0 && (
        <details className="rounded-2xl border bg-card p-4">
          <summary className="cursor-pointer text-sm font-semibold">Registro del proceso</summary>
          <ol className="mt-3 flex flex-col gap-1.5 text-sm">
            {build.steps.map((s, i) => (
              <li key={i} className="flex items-center gap-2">
                {s.status !== "completed" ? (s.status === "in_progress" ? <Loader2 className="size-4 animate-spin text-primary" /> : <Circle className="size-4 text-muted-foreground" />)
                  : s.conclusion === "success" ? <CheckCircle2 className="size-4 text-success" />
                  : s.conclusion === "skipped" ? <Circle className="size-4 text-muted-foreground" /> : <XCircle className="size-4 text-destructive" />}
                <span className={s.status === "completed" ? "" : "text-muted-foreground"}>{s.name}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
      <p className="text-xs text-muted-foreground">{u.note}</p>
    </section>
  );
}

function failMsg(b: BuildInfo) {
  const failed = b.steps.find((s) => s.conclusion === "failure");
  if (b.conclusion === "cancelled") return "La compilación fue cancelada.";
  return failed ? `Falló el paso «${failed.name}». Abrí el registro completo para ver el detalle.` : `La compilación terminó con estado: ${b.conclusion}.`;
}
function errText(e: unknown) {
  const m = e instanceof Error ? e.message : String(e);
  return m.includes("CONFIG_MISSING") ? "Falta la conexión con GitHub o el repositorio." : m;
}
