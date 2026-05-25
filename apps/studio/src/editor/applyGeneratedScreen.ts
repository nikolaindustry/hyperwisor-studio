/**
 * Apply a quick-generated screen into the running WebContainer:
 *   1. Wait for the boilerplate to be mounted (poll for package.json)
 *   2. mkdir -p the parent directory
 *   3. Write the TSX file
 *   4. Patch productScreenRegistry.ts — add the import + the
 *      productId → component map entry (idempotent)
 *
 * Vite HMR inside WebContainer picks up both file changes and refreshes
 * the live preview iframe in-place.
 */

import { getContainer } from "@/preview/container";

export type GeneratedScreen = {
  suggestedPath: string;
  componentName: string;
  content: string;
};

const REGISTRY_PATH = "src/screens/device/productScreenRegistry.ts";
const SENTINEL_PATH = "/package.json";

export async function applyGeneratedScreen(
  productId: string,
  screen: GeneratedScreen,
  onProgress?: (message: string) => void,
): Promise<void> {
  const log = (m: string) => onProgress?.(m);

  log("Connecting to sandbox…");
  const wc = await getContainer();

  // Wait for the boilerplate mount to complete (Preview owns this; we just wait).
  log("Waiting for the boilerplate to finish mounting…");
  await waitForFile(wc, SENTINEL_PATH);

  // 1. mkdir -p
  const parent = screen.suggestedPath.replace(/\/[^/]+$/, "");
  if (parent && parent !== screen.suggestedPath) {
    try {
      // recursive mkdir; WebContainer fs supports it
      await wc.fs.mkdir(parent, { recursive: true });
    } catch {
      /* already exists — fine */
    }
  }

  // 2. write the screen file
  log(`Writing ${screen.suggestedPath}…`);
  await wc.fs.writeFile(screen.suggestedPath, screen.content);

  // 3. patch the registry
  log("Registering the screen…");
  const current = await wc.fs.readFile(REGISTRY_PATH, "utf-8");
  const patched = patchRegistry(current, productId, screen);
  if (patched !== current) {
    await wc.fs.writeFile(REGISTRY_PATH, patched);
  }

  log("Done — Vite is refreshing the live preview.");
}

// ─── pure string transforms (easy to test) ─────────────────────────────

/**
 * Adds an import + map entry for a generated screen. Idempotent — if the
 * import or productId is already present, leaves them alone.
 */
export function patchRegistry(
  registry: string,
  productId: string,
  screen: GeneratedScreen,
): string {
  const { suggestedPath, componentName } = screen;

  // Relative import from the registry → screen file
  // e.g. src/screens/device/foo/FooScreen.tsx  →  ./foo/FooScreen
  const rel =
    "./" +
    suggestedPath
      .replace(/^src\/screens\/device\//, "")
      .replace(/\.tsx?$/, "");

  const importLine = `import { ${componentName} } from "${rel}";`;
  const mapEntry = `  // ${productId}\n  "${productId}": ${componentName},`;

  let out = registry;

  // Insert the import after the last existing `import` line.
  if (!out.includes(importLine)) {
    const lines = out.split("\n");
    let lastImportIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*import\s/.test(lines[i])) lastImportIdx = i;
    }
    if (lastImportIdx >= 0) {
      lines.splice(lastImportIdx + 1, 0, importLine);
      out = lines.join("\n");
    } else {
      out = importLine + "\n" + out;
    }
  }

  // Insert the map entry before the closing `};` of productScreens, if the
  // productId isn't already in the map.
  const productIdRegex = new RegExp(`"${escapeRegex(productId)}"\\s*:`);
  if (!productIdRegex.test(out)) {
    // Match: export const productScreens: ... = {  ...  };
    out = out.replace(
      /(export const productScreens[\s\S]*?\{)([\s\S]*?)(\n\};)/,
      (_m, head, body, tail) => `${head}${body}\n${mapEntry}${tail}`,
    );
  }

  return out;
}

// ─── helpers ───────────────────────────────────────────────────────────

async function waitForFile(
  wc: Awaited<ReturnType<typeof getContainer>>,
  path: string,
  timeoutMs = 120_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await wc.fs.readFile(path);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw new Error(`Timed out waiting for ${path} in the sandbox`);
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
