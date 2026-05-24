/**
 * Wraps the Claude Agent SDK for one generation run inside a scratch
 * project directory. Emits structured events to a single `onEvent`
 * callback — the route layer turns those into SSE frames.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { projectPath } from "./project.mjs";

/**
 * @param {object} opts
 * @param {string} opts.projectId  scratch project id (cwd for the agent)
 * @param {string} opts.productId  Hyperwisor product UUID
 * @param {string} opts.productName  pre-fetched for friendlier prompt
 * @param {string} opts.anthropicKey  the manufacturer's own Anthropic API key
 *                 (BYOK — the studio server never holds this key)
 * @param {(ev: { type: string, [k: string]: any }) => void} opts.onEvent
 * @param {AbortController} [opts.abortController]
 */
export async function generateScreen({
  projectId,
  productId,
  productName,
  anthropicKey,
  onEvent,
  abortController,
}) {
  const cwd = projectPath(projectId);

  const prompt = `
Build the bespoke device UI for product "${productName}" (id: ${productId}).

You are operating inside the Hyperwisor app starter kit. Read these files
in this order before writing any code:

  1. CLAUDE.md — the playbook you must follow exactly
  2. .hyperwisor/product-${productId}.json — the product spec
       Focus on:
         • capabilities.controls  → manufacturer-authored titles + widgetTypes
                                    (this is the truth source, not commandsApi)
         • capabilities.displays  → telemetry surfaces with titles + units
         • capabilities.commands  → raw vocabulary as cross-reference
  3. src/screens/device/examples/SmartThermostatScreen.tsx — quality reference
  4. src/screens/device/smart-bike/SmartBikeScreen.tsx — another example
  5. src/components/blocks/index.ts — the blocks you must compose with

Then:
  • Run \`npm run inspect ${productId}\` (Bash) to refresh the spec
  • Create src/screens/device/<product-slug>/<ProductName>Screen.tsx
  • Register it in src/screens/device/productScreenRegistry.ts
  • Run \`npx tsc --noEmit\` (Bash) and fix every error before reporting done

Hard rules (do not violate):
  • Compose from @/components/blocks; never hard-code colors or pixel values
  • Follow capabilities.controls verbatim — widget titles + widgetType drive
    label + affordance (switch → ToggleTile, button → HoldButton, etc.)
  • Send commands via sdk.sendCommand with the real shape:
      [{ command, actions: [{ action, params }] }]
  • Flag spec gaps in comments — never silently guess
  • Don't touch the foundation (src/auth/**, src/lib/**, onboarding/list/auth screens)

Report success only after \`npx tsc --noEmit\` passes cleanly.
`.trim();

  onEvent({ type: "agent.start", productId, productName });

  const result = query({
    prompt,
    options: {
      cwd,
      allowedTools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash"],
      permissionMode: "acceptEdits",
      maxTurns: 80,
      model: process.env.HYPERWISOR_AGENT_MODEL || "sonnet",
      abortController,
      // Per-call env REPLACES the subprocess env. Spread process.env so
      // PATH/HOME/etc. are inherited, then inject this user's key.
      env: { ...process.env, ANTHROPIC_API_KEY: anthropicKey },
    },
  });

  let turns = 0;
  for await (const msg of result) {
    if (msg.type === "assistant") {
      turns++;
      const blocks = msg.message?.content ?? [];
      for (const b of blocks) {
        if (b.type === "text" && b.text?.trim()) {
          onEvent({ type: "agent.thought", text: b.text.trim() });
        } else if (b.type === "tool_use") {
          onEvent({
            type: "agent.tool",
            name: b.name,
            args: compactArgs(b.input),
          });
        }
      }
    } else if (msg.type === "result") {
      if (msg.subtype === "success") {
        onEvent({
          type: "agent.done",
          turns: msg.num_turns,
          duration_ms: msg.duration_ms,
          cost_usd: msg.total_cost_usd,
        });
        return { ok: true, turns: msg.num_turns };
      } else {
        onEvent({ type: "agent.error", subtype: msg.subtype });
        return { ok: false, error: msg.subtype };
      }
    }
  }
  return { ok: false, error: "agent_no_result" };
}

function compactArgs(input) {
  if (!input || typeof input !== "object") return "";
  const interesting = ["file_path", "command", "path", "pattern"];
  for (const k of interesting) {
    if (input[k]) {
      const v = String(input[k]);
      return `${k}=${v.length > 80 ? v.slice(0, 80) + "…" : v}`;
    }
  }
  const s = JSON.stringify(input);
  return s.length > 80 ? s.slice(0, 80) + "…" : s;
}
