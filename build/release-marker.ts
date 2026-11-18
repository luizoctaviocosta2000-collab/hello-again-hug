import { execFileSync } from "node:child_process";
import type { Plugin } from "vite";

export function createReleaseMarker(gitSha: string | null, dirty: boolean, suppliedSha?: string) {
  const valid = (value: unknown): value is string =>
    typeof value === "string" && /^[0-9a-f]{40}$/i.test(value);
  const conflict =
    valid(gitSha) && valid(suppliedSha) && gitSha.toLowerCase() !== suppliedSha.toLowerCase();
  const sha = valid(gitSha) ? gitSha : valid(suppliedSha) ? suppliedSha : null;
  const verifiable = !!sha && !dirty && !conflict;
  return {
    app: "imobfy",
    commit_sha: verifiable ? sha!.toLowerCase() : null,
    verification: verifiable ? "build-versioned" : "unverifiable",
    source: valid(gitSha) ? "git" : valid(suppliedSha) ? "build-environment" : "unavailable",
    scope: "build-identity-only-not-auth-or-provider-homologation",
  };
}

export function releaseMarkerPlugin(): Plugin {
  let gitSha: string | null = null;
  let dirty = false;
  try {
    gitSha = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    // Untracked app code also invalidates an assertion about the built source.
    dirty =
      execFileSync("git", ["status", "--porcelain"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim().length > 0;
  } catch {
    if (gitSha) dirty = true;
  }
  const marker = createReleaseMarker(gitSha, dirty, process.env.IMOBFY_BUILD_COMMIT_SHA);
  return {
    name: "imobfy-release-marker",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "imobfy-release.json",
        source: JSON.stringify(marker, null, 2) + "\n",
      });
    },
  };
}
