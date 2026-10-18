import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type Platform = "android" | "ios";
export const PLATFORMS: Record<Platform, { workflow: string; tag: string; ext: string; files: string[] }> = {
  android: { workflow: "android-apk.yml", tag: "apk", ext: ".apk", files: ["capacitor.config.ts"] },
  ios: { workflow: "ios-ipa.yml", tag: "ipa", ext: ".ipa", files: ["capacitor.config.ts"] },
};

export type BuildStep = { name: string; status: string; conclusion: string | null };
export type BuildInfo = {
  platform: Platform;
  runId: number;
  runNumber: number;
  status: "queued" | "in_progress" | "completed" | string;
  conclusion: string | null;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
  version: string;
  steps: BuildStep[];
  /** completed steps / total steps — only when GitHub reports steps */
  progress: number | null;
  /** true only when the release asset file really exists */
  apkReady: boolean;
  apkName?: string | undefined;
  apkSize?: number | undefined;
};

export type ConfigCheck = {
  ok: boolean;
  checks: { label: string; ok: boolean; detail?: string | undefined }[];
};

const platformSchema = z.enum(["android", "ios"]);

export const checkBuildConfig = createServerFn({ method: "GET" })
  .inputValidator((d: { platform: Platform }) => z.object({ platform: platformSchema }).parse(d))
  .handler(async ({ data }): Promise<ConfigCheck> => {
    const { ghConfig, ghJson } = await import("./github.server");
    const P = PLATFORMS[data.platform];
    const { token, repo } = ghConfig();
    const checks: ConfigCheck["checks"] = [
      { label: "Conexión con GitHub", ok: !!token },
      { label: "Repositorio configurado (GITHUB_REPO)", ok: !!repo, detail: repo || undefined },
    ];
    if (token && repo) {
      try {
        await ghJson(`/actions/workflows/${P.workflow}`);
        checks.push({ label: `Workflow de compilación ${data.platform === "ios" ? "iOS" : "Android"} en el repositorio`, ok: true });
        const cap = await ghJson<unknown>(`/contents/capacitor.config.ts`).then(() => true, () => false);
        checks.push({ label: "Capacitor configurado en el repositorio", ok: cap });
      } catch (e) {
        checks.push({ label: "Acceso al repositorio y workflow", ok: false, detail: e instanceof Error ? e.message : String(e) });
      }
    }
    return { ok: checks.every((c) => c.ok), checks };
  });

type Run = { id: number; run_number: number; status: string; conclusion: string | null; created_at: string; updated_at: string; html_url: string; display_title: string };

async function toInfo(platform: Platform, run: Run): Promise<BuildInfo> {
  const { ghJson } = await import("./github.server");
  const P = PLATFORMS[platform];
  const jobs = await ghJson<{ jobs: { steps?: { name: string; status: string; conclusion: string | null }[] }[] }>(`/actions/runs/${run.id}/jobs`);
  const steps = (jobs.jobs[0]?.steps || []).map((s) => ({ name: s.name, status: s.status, conclusion: s.conclusion }));
  const done = steps.filter((s) => s.status === "completed").length;
  let apkReady = false, apkName: string | undefined, apkSize: number | undefined;
  if (run.status === "completed" && run.conclusion === "success") {
    try {
      const rel = await ghJson<{ assets: { name: string; size: number }[] }>(`/releases/tags/${P.tag}-${run.run_number}`);
      const a = rel.assets.find((x) => x.name.endsWith(P.ext) && x.size > 0);
      if (a) { apkReady = true; apkName = a.name; apkSize = a.size; }
    } catch { /* release not present → not downloadable */ }
  }
  return {
    platform, runId: run.id, runNumber: run.run_number, status: run.status, conclusion: run.conclusion,
    createdAt: run.created_at, updatedAt: run.updated_at, htmlUrl: run.html_url,
    version: `1.0.${run.run_number}`, steps, progress: steps.length ? done / steps.length : null,
    apkReady, apkName, apkSize,
  };
}

export const startBuild = createServerFn({ method: "POST" })
  .inputValidator((d: { platform: Platform }) => z.object({ platform: platformSchema }).parse(d))
  .handler(async ({ data }) => {
    const { ghJson } = await import("./github.server");
    const repoInfo = await ghJson<{ default_branch: string }>("");
    const buildId = `MARCOMUSIC-${data.platform}-${Date.now()}`;
    await ghJson(`/actions/workflows/${PLATFORMS[data.platform].workflow}/dispatches`, {
      method: "POST",
      body: JSON.stringify({ ref: repoInfo.default_branch, inputs: { build_id: buildId } }),
    });
    return { buildId };
  });

export const findBuild = createServerFn({ method: "GET" })
  .inputValidator((d: { platform: Platform; buildId: string }) => z.object({ platform: platformSchema, buildId: z.string().max(80) }).parse(d))
  .handler(async ({ data }): Promise<BuildInfo | null> => {
    const { ghJson } = await import("./github.server");
    const r = await ghJson<{ workflow_runs: Run[] }>(`/actions/workflows/${PLATFORMS[data.platform].workflow}/runs?event=workflow_dispatch&per_page=10`);
    const run = r.workflow_runs.find((x) => x.display_title === data.buildId);
    return run ? toInfo(data.platform, run) : null;
  });

export const getBuild = createServerFn({ method: "GET" })
  .inputValidator((d: { platform: Platform; runId: number }) => z.object({ platform: platformSchema, runId: z.number().int().positive() }).parse(d))
  .handler(async ({ data }) => {
    const { ghJson } = await import("./github.server");
    return toInfo(data.platform, await ghJson<Run>(`/actions/runs/${data.runId}`));
  });

export const latestBuild = createServerFn({ method: "GET" })
  .inputValidator((d: { platform: Platform }) => z.object({ platform: platformSchema }).parse(d))
  .handler(async ({ data }): Promise<BuildInfo | null> => {
    const { ghConfig, ghJson } = await import("./github.server");
    if (!ghConfig().token || !ghConfig().repo) return null;
    try {
      const r = await ghJson<{ workflow_runs: Run[] }>(`/actions/workflows/${PLATFORMS[data.platform].workflow}/runs?per_page=1`);
      return r.workflow_runs[0] ? toInfo(data.platform, r.workflow_runs[0]) : null;
    } catch { return null; }
  });
