import * as React from "react";
import { ChevronDown, ChevronRight, File, Folder } from "lucide-react";
import type { Node } from "./walkFs";
import { cn } from "@/lib/cn";

const OPEN_BY_DEFAULT = new Set(["src", "screens", "device", "components", "lib", "hooks"]);

export function FileTree({
  nodes,
  activePath,
  onSelect,
}: {
  nodes: Node[];
  activePath: string | null;
  onSelect: (path: string) => void;
}) {
  return (
    <div className="text-[12.5px] py-1 select-none">
      {nodes.map((n) => (
        <NodeRow key={n.path} node={n} depth={0} activePath={activePath} onSelect={onSelect} />
      ))}
    </div>
  );
}

function NodeRow({
  node,
  depth,
  activePath,
  onSelect,
}: {
  node: Node;
  depth: number;
  activePath: string | null;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = React.useState(
    OPEN_BY_DEFAULT.has(node.name) || depth === 0,
  );

  if (node.type === "dir") {
    return (
      <>
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-1 px-2 py-1 hover:bg-surface-2 text-text rounded-sm"
          style={{ paddingLeft: 8 + depth * 12 }}
        >
          {open ? (
            <ChevronDown size={12} className="text-muted" />
          ) : (
            <ChevronRight size={12} className="text-muted" />
          )}
          <Folder size={13} className="text-muted" />
          <span className="truncate">{node.name}</span>
        </button>
        {open
          ? node.children.map((c) => (
              <NodeRow
                key={c.path}
                node={c}
                depth={depth + 1}
                activePath={activePath}
                onSelect={onSelect}
              />
            ))
          : null}
      </>
    );
  }

  const active = activePath === node.path;
  return (
    <button
      onClick={() => onSelect(node.path)}
      className={cn(
        "w-full flex items-center gap-1.5 py-1 text-text rounded-sm",
        active ? "bg-primary/10 text-accent" : "hover:bg-surface-2",
      )}
      style={{ paddingLeft: 8 + depth * 12 + 13 /* align past chevron */ }}
    >
      <File size={13} className={cn(active ? "text-accent" : "text-muted")} />
      <span className="truncate">{node.name}</span>
    </button>
  );
}
