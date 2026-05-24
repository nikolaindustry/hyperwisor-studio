/**
 * Project lifecycle — clones the boilerplate, manages temp dirs, zips output.
 *
 * Each studio session owns a scratch project under /tmp-projects/<id>/.
 * The agent writes the generated screen there; we zip + return when done.
 */

import { mkdirSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import archiver from "archiver";

const TEMPLATE_REPO = "https://github.com/nikolaindustry/hyperwisor-app-starter.git";
const TEMPLATE_BRANCH = "main";

export const PROJECTS_ROOT = process.env.HYPERWISOR_STUDIO_PROJECTS_ROOT
  || resolve(process.cwd(), "tmp-projects");

mkdirSync(PROJECTS_ROOT, { recursive: true });

export function newProjectId() {
  return randomUUID();
}

export function projectPath(projectId) {
  return resolve(PROJECTS_ROOT, projectId);
}

/**
 * Clone the boilerplate into a fresh scratch dir.
 * Returns the absolute path. Throws on failure.
 */
export async function cloneTemplate(projectId, { onLog } = {}) {
  const dir = projectPath(projectId);
  if (existsSync(dir)) {
    throw new Error(`Project ${projectId} already exists`);
  }
  onLog?.("Cloning boilerplate…");
  await run("git", [
    "clone",
    "--depth", "1",
    "--branch", TEMPLATE_BRANCH,
    TEMPLATE_REPO,
    dir,
  ]);
  rmSync(resolve(dir, ".git"), { recursive: true, force: true });
  onLog?.("Boilerplate ready");
  return dir;
}

/** Write the .env.local that the agent + dev server will use. */
export function writeEnv(projectId, { apiKey, secretKey, anthropicKey }) {
  const dir = projectPath(projectId);
  const lines = [
    `VITE_HW_API_KEY=${apiKey || ""}`,
    `VITE_HW_SECRET_KEY=${secretKey || ""}`,
    `ANTHROPIC_API_KEY=${anthropicKey || ""}`,
    "",
  ];
  writeFileSync(resolve(dir, ".env.local"), lines.join("\n"));
}

/** Install dependencies in the scratch project. */
export async function installDeps(projectId, { onLog } = {}) {
  const dir = projectPath(projectId);
  onLog?.("Installing dependencies (this takes ~30s)…");
  await run("npm", ["install", "--legacy-peer-deps"], { cwd: dir });
  onLog?.("Dependencies installed");
}

/**
 * Stream a zip of the project to `dest` (a writable stream — typically a
 * Fastify reply). Excludes node_modules / dist / .git.
 */
export function zipTo(projectId, dest) {
  const dir = projectPath(projectId);
  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (err) => dest.destroy(err));
  archive.pipe(dest);
  archive.glob("**/*", {
    cwd: dir,
    dot: true,
    ignore: [
      "node_modules/**",
      "dist/**",
      ".git/**",
      "*.tsbuildinfo",
      ".hyperwisor/**",
    ],
  });
  return archive.finalize();
}

/** Remove the scratch dir. Safe to call repeatedly. */
export function removeProject(projectId) {
  const dir = projectPath(projectId);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

// ─── helpers ──────────────────────────────────────────────────────────
function run(cmd, args, opts = {}) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
      ...opts,
    });
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", (e) => rej(e));
    p.on("exit", (c) =>
      c === 0 ? res() : rej(new Error(err.trim() || `${cmd} exited ${c}`)),
    );
  });
}
