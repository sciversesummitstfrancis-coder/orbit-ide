import Editor, { type OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { useWorkspace } from "../store/workspace";

function languageFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript", json: "json",
    rs: "rust", py: "python", java: "java", c: "c", h: "c", cpp: "cpp", hpp: "cpp", cc: "cpp", cxx: "cpp",
    html: "html", htm: "html", css: "css", scss: "scss", less: "less", md: "markdown", mdx: "markdown",
    xml: "xml", svg: "xml", sql: "sql", sh: "shell", bash: "shell", zsh: "shell", fish: "shell",
    yml: "yaml", yaml: "yaml", toml: "ini", txt: "plaintext", go: "go", rb: "ruby", php: "php",
  };
  return map[ext] || "plaintext";
}

export default function OrbitEditor({ path, value, onChange, onSave }: {
  path: string; value: string; onChange: (v: string) => void; onSave: () => void;
}) {
  const setSelection = useWorkspace((s) => s.setSelection);
  const onMount: OnMount = (editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => onSave());
    const pushSelection = () => {
      const sel = editor.getSelection();
      const model = editor.getModel();
      if (!sel || !model || sel.isEmpty()) return setSelection(null);
      const text = model.getValueInRange(sel);
      setSelection(text.trim() ? { path, text } : null);
    };
    editor.onDidChangeCursorSelection(pushSelection);
    editor.onDidBlurEditorText(() => pushSelection());
    monaco.editor.defineTheme("orbit-dark", {
      base: "vs-dark", inherit: true,
      rules: [{ token: "", foreground: "dce7f1", background: "11161c" }, { token: "comment", foreground: "6b8094" }],
      colors: {
        "editor.background": "#11161c", "editor.foreground": "#dce7f1", "editorLineNumber.foreground": "#4f6478",
        "editorLineNumber.activeForeground": "#97aabc", "editor.selectionBackground": "#22d3ee2e",
        "editor.inactiveSelectionBackground": "#22d3ee18", "editor.lineHighlightBackground": "#171d25",
        "editorCursor.foreground": "#22d3ee", "editorIndentGuide.background": "#22303d", "editorIndentGuide.activeBackground": "#2d3b49",
        "editorWidget.background": "#171d25", "editorWidget.border": "#2d3b49", "minimap.background": "#11161c", "scrollbarSlider.background": "#34445566",
      },
    });
    monaco.editor.setTheme("orbit-dark");
    setSelection(null);
  };

  return (
    <Editor height="100%" path={path} language={languageFor(path)} value={value} onChange={(v) => onChange(v ?? "")} onMount={onMount} theme="orbit-dark"
      options={{ minimap: { enabled: true, scale: 1 }, fontFamily: '"JetBrains Mono","Cascadia Code","Fira Code",Consolas,monospace', fontSize: 13, lineHeight: 21, automaticLayout: true, scrollBeyondLastLine: false, tabSize: 2, renderWhitespace: "selection", bracketPairColorization: { enabled: true }, guides: { bracketPairs: true, indentation: true }, smoothScrolling: false, padding: { top: 12, bottom: 12 }, cursorBlinking: "smooth", roundedSelection: false, overviewRulerBorder: false }}
    />
  );
}
