/**
 * Walks the WebContainer file system into a nested tree we can render
 * (and re-render on demand). Excludes noise like node_modules.
 */

import type { WebContainer } from "@webcontainer/api";

export type Node =
  | { type: "dir"; name: string; path: string; children: Node[] }
  | { type: "file"; name: string; path: string };

const SKIP = new Set([
  "node_modules",
  ".git",
  "dist",
  ".hyperwisor",
  ".turbo",
]);

export async function walkFs(wc: WebContainer, root = "/"): Promise<Node[]> {
  return walk(wc, root);
}

async function walk(wc: WebContainer, dir: string): Promise<Node[]> {
  // wc.fs.readdir supports withFileTypes:true which returns entries with isDirectory()
  // typing is loose so we narrow here.
  let entries: Array<{ name: string; isDirectory(): boolean }>;
  try {
    entries = (await wc.fs.readdir(dir, {
      withFileTypes: true,
    })) as unknown as Array<{ name: string; isDirectory(): boolean }>;
  } catch {
    return [];
  }

  const result: Node[] = [];
  for (const e of entries) {
    if (SKIP.has(e.name)) continue;
    const path = dir.endsWith("/") ? dir + e.name : `${dir}/${e.name}`;
    if (e.isDirectory()) {
      result.push({
        type: "dir",
        name: e.name,
        path,
        children: await walk(wc, path),
      });
    } else {
      result.push({ type: "file", name: e.name, path });
    }
  }
  // dirs first, then files, both alphabetical
  result.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return result;
}

/** Read a file as text. */
export async function readFile(wc: WebContainer, path: string): Promise<string> {
  return wc.fs.readFile(path, "utf-8");
}

/** Write a file as text (creates intermediate dirs if needed). */
export async function writeFile(
  wc: WebContainer,
  path: string,
  content: string,
): Promise<void> {
  await wc.fs.writeFile(path, content);
}
