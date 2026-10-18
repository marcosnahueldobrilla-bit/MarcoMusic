import { afterEach, describe, expect, it, vi } from "vitest";
import { ghConfig } from "./github.server";

afterEach(() => vi.unstubAllEnvs());

describe("GitHub build credential selection", () => {
  it("prefers the connected GitHub account when available", () => {
    vi.stubEnv("LOVABLE_API_KEY", "test-lovable");
    vi.stubEnv("GITHUB_API_KEY", "test-connection");
    vi.stubEnv("GITHUB_FINE_GRAINED_PERSONAL_ACCESS_TOKEN", "test-pat");
    const c = ghConfig();
    expect(c.gateway).toBe(true);
    expect(c.token).toBe("test-connection");
  });
  it("falls back to the fine-grained token without a connection", () => {
    vi.stubEnv("LOVABLE_API_KEY", "");
    vi.stubEnv("GITHUB_API_KEY", "");
    vi.stubEnv("GITHUB_FINE_GRAINED_PERSONAL_ACCESS_TOKEN", "test-new-credential");
    vi.stubEnv("GITHUB_BUILD_TOKEN", "test-legacy-credential");
    expect(ghConfig().token).toBe("test-new-credential");
  });
  it("normalizes a full repository URL", () => {
    vi.stubEnv("GITHUB_REPO", " https://github.com/marcosnahueldobrilla-bit/MarcoMusic.git ");
    expect(ghConfig().repo).toBe("marcosnahueldobrilla-bit/MarcoMusic");
  });
});
