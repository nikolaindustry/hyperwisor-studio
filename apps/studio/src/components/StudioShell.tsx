import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

/** App shell — fixed sidebar + scrolling main column. */
export function StudioShell() {
  return (
    <div className="min-h-screen bg-bg flex">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
