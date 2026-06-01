import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { CALC_PATH, SVC_PATH, CALCULATOR_V1, CALCULATOR_V2_BUG, MATH_SERVICE } from "../fixtures/java-sources.js";

export interface ScenarioRepo {
  repoUrl: string;
  cleanup: () => void;
}

/**
 * Builds a throwaway SVN repository reproducing the scenario:
 *   r1 (alice): import Calculator (with add()) + MathService (calls add())
 *   r2 (bob):   rename Calculator.add -> addUp   ⇒ breaks MathService
 *
 * Authors are pinned deterministically via a pre-revprop-change hook + revprop
 * override, so `svn blame` attributes the breaking line to bob regardless of
 * the OS user running the test.
 */
export function createScenarioRepo(): ScenarioRepo {
  const root = join(tmpdir(), `ear-svn-${process.pid}-${Date.now()}`);
  const repoPath = join(root, "repo");
  const wc = join(root, "wc");
  const repoUrl = `file://${repoPath}`;
  const svn = (args: string[]) => execFileSync("svn", args, { env: process.env, stdio: "pipe" });

  mkdirSync(root, { recursive: true });
  execFileSync("svnadmin", ["create", repoPath], { env: process.env });

  // Allow svn:author overrides.
  const hook = join(repoPath, "hooks", "pre-revprop-change");
  writeFileSync(hook, "#!/bin/sh\nexit 0\n");
  chmodSync(hook, 0o755);

  svn(["checkout", repoUrl, wc, "--non-interactive"]);

  // ── r1: alice imports both files ──────────────────────────────────────────
  writeFile(wc, CALC_PATH, CALCULATOR_V1);
  writeFile(wc, SVC_PATH, MATH_SERVICE);
  svn(["add", join(wc, "src"), "--non-interactive"]);
  svn(["commit", wc, "-m", "initial import", "--non-interactive"]);
  svn(["propset", "--revprop", "-r", "1", "svn:author", "alice", repoUrl, "--non-interactive"]);

  // ── r2: bob renames add -> addUp (the breaking change) ──────────────────────
  writeFile(wc, CALC_PATH, CALCULATOR_V2_BUG);
  svn(["commit", wc, "-m", "rename Calculator.add to addUp", "--non-interactive"]);
  svn(["propset", "--revprop", "-r", "2", "svn:author", "bob", repoUrl, "--non-interactive"]);

  return { repoUrl, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function writeFile(wc: string, relPath: string, content: string): void {
  const full = join(wc, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}
