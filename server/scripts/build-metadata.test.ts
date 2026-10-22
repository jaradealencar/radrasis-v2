import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  resolveBuildCommitSha,
  resolveBuildTreeState,
  writeBuildMetadata,
} from "./write-build-metadata";

const temporaryDirectories: string[] = [];
const validSha = "a".repeat(40);

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("build artifact metadata", () => {
  it("prefers the Vercel commit SHA and emits it without environment values", () => {
    const sha = resolveBuildCommitSha(
      { VERCEL_GIT_COMMIT_SHA: validSha, GITHUB_SHA: "b".repeat(40) },
      () => "c".repeat(40),
    );
    const directory = mkdtempSync(join(tmpdir(), "radrasis-build-info-"));
    temporaryDirectories.push(directory);

    const metadataPath = writeBuildMetadata(directory, sha);
    const metadata = JSON.parse(readFileSync(metadataPath, "utf8")) as {
      sourceCommit: string;
      sourceTreeState: string;
    };

    expect(resolve(metadataPath)).toBe(resolve(directory, "build-info.json"));
    expect(metadata).toEqual({ sourceCommit: validSha, sourceTreeState: "unknown" });
  });

  it("uses the GitHub SHA in CI and rejects a malformed configured SHA", () => {
    expect(resolveBuildCommitSha({ GITHUB_SHA: "b".repeat(40) }, () => undefined)).toBe("b".repeat(40));
    expect(() => resolveBuildCommitSha({ VERCEL_GIT_COMMIT_SHA: "short" }, () => validSha)).toThrow(
      "full 40-character Git commit SHA",
    );
  });

  it("falls back to the current Git revision for local builds and rejects a missing revision", () => {
    expect(resolveBuildCommitSha({}, () => validSha)).toBe(validSha);
    expect(() => resolveBuildCommitSha({}, () => undefined)).toThrow(
      "full 40-character Git commit SHA",
    );
  });

  it("marks generated outputs separately from uncommitted source changes", () => {
    expect(
      resolveBuildTreeState(() => " M api/index.js\n?? dist/public/build-info.json\n"),
    ).toBe("clean");
    expect(resolveBuildTreeState(() => " M server/db/db-connection.ts\n")).toBe("dirty");
    expect(resolveBuildTreeState(() => undefined)).toBe("unknown");
  });
});
