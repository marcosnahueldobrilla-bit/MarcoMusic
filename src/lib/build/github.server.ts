// Server-only GitHub client. Credentials never leave the server.
export const WORKFLOW_FILE = "android-apk.yml";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/github";

export function ghConfig() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GITHUB_API_KEY"];
  const gateway = !!(lovableKey && connectionKey);
  const pat = process.env["GITHUB_FINE_GRAINED_PERSONAL_ACCESS_TOKEN"] || process.env["GITHUB_BUILD_TOKEN"];
  const token = gateway ? connectionKey : pat;
  const repo = (process.env["GITHUB_REPO"] || "").trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/$/, "");
  return { token, repo, gateway, lovableKey };
}

/** path: "/..." relative to the repo, or a full https://api.github.com URL. */
export async function gh(path: string, init: RequestInit = {}) {
  const { token, repo, gateway, lovableKey } = ghConfig();
  if (!token || !repo) throw new Error("CONFIG_MISSING");
  const apiPath = path.startsWith("http") ? path.replace(/^https:\/\/api\.github\.com/, "") : `/repos/${repo}${path}`;
  const auth: Record<string, string> = gateway
    ? { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": token }
    : { Authorization: `Bearer ${token}` };
  return fetch(`${gateway ? GATEWAY_URL : "https://api.github.com"}${apiPath}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "marcomusic-builder",
      ...auth,
      ...((init.headers as Record<string, string>) || {}),
    },
  });
}

export async function ghJson<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await gh(path, init);
  if (!r.ok) {
    const body = await r.text();
    console.error(`GitHub request failed [${r.status}]: ${body.slice(0, 500)}`);
    throw new Error(`GitHub ${r.status}: ${humanize(r.status, body)}`);
  }
  return r.status === 204 ? (undefined as T) : r.json();
}

function humanize(status: number, body: string) {
  if (status === 401) return "la conexión con GitHub expiró; reconectá GitHub en Conectores.";
  if (status === 403) return "GitHub no dio permiso para esta acción.";
  if (status === 404) return "no se encontró el repositorio o el workflow de compilación.";
  try { return JSON.parse(body).message; } catch { return body.slice(0, 200); }
}
