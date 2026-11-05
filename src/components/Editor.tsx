import Editor, { type OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";

function languageFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript", json: "json",
    rs: "rust", py: "python", java: "java", c: "c", h: "c", cpp: "cpp", hpp: "cpp", cc: "cpp",
    html: "html", htm: "html", css: "css", scss: "scss", md: "markdown", xml: "xml", svg: "xml",
    sql: "sql", sh: "shell", bash: "shell", yml: "yaml", yaml: "yaml", toml: "ini", txt: "plaintext",
  };
  return map[ext] || "plaintext";
}

export default function OrbitEditor({ path, value, onChange, onSave }: {
  path: string; value: string; onChange: (v: string) => void; onSave: () => void;
}) {
  const onMount: OnMount = (editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => onSave());
    monaco.editor.defineTheme("orbit-dark", {
      base: "vs-dark", inherit: true,
      rules: [{ token: "", foreground: "d7e2ec", background: "14181d" }],
      colors: {
        "editor.background": "#14181d",
        "editor.foreground": "#d7e2ec",
        "editorLineNumber.foreground": "#66798a",
        "editorLineNumber.activeForeground": "#93a4b5",
        "editor.selectionBackground": "#22d3ee33",
        "editor.lineHighlightBackground": "#1b2128",
        "editorCursor.foreground": "#22d3ee",
        "editorIndentGuide.background": "#26303b",
        "editorIndentGuide.activeBackground": "#334050",
      },
    });
    monaco.editor.setTheme("orbit-dark");
  };

  return (
    <Editor
      height="100%"
      path={path}
      language={languageFor(path)}
      value={value}
      onChange={(v) => onChange(v ?? "")}
      onMount={onMount}
      theme="orbit-dark"
      options={{
        minimap: { enabled: true },
        fontFamily: '"JetBrains Mono","Cascadia Code",Consolas,monospace',
        fontSize: 13,
        automaticLayout: true,
        scrollBeyondLastLine: false,
        tabSize: 2,
        renderWhitespace: "selection",
        bracketPairColorization: { enabled: true },
        smoothScrolling: false,
        padding: { top: 10 },
      }}
    />
  );
}
