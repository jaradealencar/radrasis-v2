import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FULL_COMMIT_SHA = /^[a-f0-9]{40}$/i;

function readCurrentCommitSha(): string | undefined {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
}

function readCurrentGitStatus(): string | undefined {
  try {
    return execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return undefined;
  }
}

export type BuildTreeState = "clean" | "dirty" | "unknown";

export function resolveBuildTreeState(
  readGitStatus: () => string | undefined = readCurrentGitStatus,
): BuildTreeState {
  const status = readGitStatus();
  if (status === undefined) return "unknown";

  const sourceChanges = status
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => line.slice(3).replace(/\\/g, "/"))
    .filter(path => path !== "api/index.js" && !path.startsWith("dist/"));

  return sourceChanges.length > 0 ? "dirty" : "clean";
}

export function resolveBuildCommitSha(
  environment: NodeJS.ProcessEnv = process.env,
  readGitSha: () => string | undefined = readCurrentCommitSha,
): string {
  const configuredSha = [
    environment.VERCEL_GIT_COMMIT_SHA,
    environment.GITHUB_SHA,
    environment.GIT_COMMIT_SHA,
  ].find(value => value?.trim());
  const commitSha = (configuredSha ?? readGitSha())?.trim();

  if (!commitSha || !FULL_COMMIT_SHA.test(commitSha)) {
    throw new Error("Build metadata requires a full 40-character Git commit SHA.");
  }

  return commitSha.toLowerCase();
}

export function writeBuildMetadata(
  outputDirectory: string,
  commitSha: string,
  sourceTreeState: BuildTreeState = "unknown",
): string {
  if (!FULL_COMMIT_SHA.test(commitSha)) {
    throw new Error("Build metadata requires a full 40-character Git commit SHA.");
  }

  mkdirSync(outputDirectory, { recursive: true });
  const metadataPath = resolve(outputDirectory, "build-info.json");
  writeFileSync(
    metadataPath,
    `${JSON.stringify(
      { sourceCommit: commitSha.toLowerCase(), sourceTreeState },
      null,
      2,
    )}\n`,
    { encoding: "utf8" },
  );
  return metadataPath;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const commitSha = resolveBuildCommitSha();
  const sourceTreeState = resolveBuildTreeState();
  writeBuildMetadata(resolve("dist/public"), commitSha, sourceTreeState);
  console.info(`[BUILD] Artifact source commit: ${commitSha} (${sourceTreeState} source tree)`);
}
