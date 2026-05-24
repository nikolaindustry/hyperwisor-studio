import * as React from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { prewarm } from "@/preview/container";

/**
 * App shell — fixed sidebar + scrolling main column.
 *
 * Pre-warms the WebContainer the moment the shell mounts (i.e. right
 * after sign-in). By the time the user picks a product, the ~3–5s
 * runtime download is already done in the background.
 */
export function StudioShell() {
  React.useEffect(() => {
    prewarm();
  }, []);

  return (
    <div className="min-h-screen bg-bg flex">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
