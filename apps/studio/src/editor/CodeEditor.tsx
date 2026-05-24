/**
 * Thin CodeMirror 6 wrapper. Picks a language extension from the file
 * extension and surfaces text + onChange as a controlled component.
 */

import * as React from "react";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, historyKeymap, history } from "@codemirror/commands";
import { defaultHighlightStyle, syntaxHighlighting, bracketMatching, indentOnInput } from "@codemirror/language";
import { javascript } from "@codemirror/lang-javascript";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";

function langForPath(path: string) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".tsx") || lower.endsWith(".ts")) {
    return javascript({ jsx: lower.endsWith(".tsx"), typescript: true });
  }
  if (lower.endsWith(".jsx") || lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) {
    return javascript({ jsx: lower.endsWith(".jsx") });
  }
  if (lower.endsWith(".css")) return css();
  if (lower.endsWith(".json")) return json();
  if (lower.endsWith(".md") || lower.endsWith(".mdx")) return markdown();
  return [];
}

export function CodeEditor({
  path,
  value,
  onChange,
  readOnly,
}: {
  path: string;
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
}) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const viewRef = React.useRef<EditorView | null>(null);
  const langCompartment = React.useRef(new Compartment());
  const readOnlyCompartment = React.useRef(new Compartment());

  // Mount once
  React.useEffect(() => {
    if (!hostRef.current) return;
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          indentOnInput(),
          bracketMatching(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          langCompartment.current.of(langForPath(path)),
          readOnlyCompartment.current.of(EditorState.readOnly.of(!!readOnly)),
          EditorView.theme({
            "&": {
              height: "100%",
              fontSize: "12.5px",
              fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
              background: "#ffffff",
              color: "#0f1419",
            },
            ".cm-scroller": { fontFamily: "inherit" },
            ".cm-gutters": {
              background: "#fafbfc",
              borderRight: "1px solid #e4e6eb",
              color: "#9aa5b1",
            },
            ".cm-activeLine": { background: "#f8f9fa" },
            ".cm-activeLineGutter": { background: "#f1f3f5" },
            ".cm-content": { padding: "8px 0" },
            ".cm-line": { padding: "0 12px" },
          }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged && onChange) {
              onChange(u.state.doc.toString());
            }
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // We intentionally mount once and update via effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the path changes (different file opened): swap language + content
  React.useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
      effects: langCompartment.current.reconfigure(langForPath(path)),
    });
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps

  // When external `value` changes (e.g. file reloaded from FS): sync without
  // creating a loop with our own onChange.
  React.useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    });
  }, [value]);

  // Toggle readOnly on prop change
  React.useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: readOnlyCompartment.current.reconfigure(
        EditorState.readOnly.of(!!readOnly),
      ),
    });
  }, [readOnly]);

  return <div ref={hostRef} className="w-full h-full overflow-hidden bg-white" />;
}
