"use client";

import { useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import type { OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

interface CodeViewerPanelProps {
  filePath: string | null;
  content: string | null;
  selectedLine: number | null;
  onLineSelect: (lineNumber: number) => void;
  correctLine: { filePath: string; lineNumber: number } | null;
  currentViewingFile: string | null;
}

function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const langMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescriptreact",
    js: "javascript",
    jsx: "javascriptreact",
    go: "go",
    py: "python",
    php: "php",
    dart: "dart",
    cs: "csharp",
    rb: "ruby",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    md: "markdown",
    css: "css",
    html: "html",
  };
  return langMap[ext] ?? "plaintext";
}

export default function CodeViewerPanel({
  filePath,
  content,
  selectedLine,
  onLineSelect,
  correctLine,
  currentViewingFile,
}: CodeViewerPanelProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null);

  const handleEditorMount: OnMount = useCallback(
    (editorInstance, monaco) => {
      editorRef.current = editorInstance;
      decorationsRef.current = editorInstance.createDecorationsCollection([]);

      editorInstance.onMouseDown((e) => {
        const lineNumber = e.target?.position?.lineNumber;
        if (lineNumber) {
          onLineSelect(lineNumber);
        }
      });

      void monaco;
    },
    [onLineSelect],
  );

  useEffect(() => {
    const editorInstance = editorRef.current;
    if (!editorInstance || !decorationsRef.current) return;

    // @ts-expect-error window.monaco is available at runtime
    const monaco = window.monaco;
    if (!monaco) return;

    const newDecorations: editor.IModelDeltaDecoration[] = [];

    if (selectedLine) {
      newDecorations.push({
        range: new monaco.Range(selectedLine, 1, selectedLine, 1),
        options: {
          isWholeLine: true,
          className: "code-quiz-selected-line",
          glyphMarginClassName: "code-quiz-selected-glyph",
        },
      });
    }

    if (correctLine && currentViewingFile === correctLine.filePath) {
      newDecorations.push({
        range: new monaco.Range(correctLine.lineNumber, 1, correctLine.lineNumber, 1),
        options: {
          isWholeLine: true,
          className: "code-quiz-correct-line",
          glyphMarginClassName: "code-quiz-correct-glyph",
        },
      });
    }

    decorationsRef.current.set(newDecorations);
  }, [selectedLine, correctLine, currentViewingFile]);

  const editorContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = editorContainerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      // 水平スクロールがある場合はブラウザの戻る/進むジェスチャーを抑制
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
      }
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  if (!filePath || !content) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-400 dark:text-zinc-500">
        <div className="text-center">
          <p className="text-lg mb-1">左のファイルツリーからファイルを選択</p>
          <p className="text-sm">コードを読んで、お題の行を探してください</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <style>{`
        .code-quiz-selected-line { background: rgba(59, 130, 246, 0.2) !important; }
        .code-quiz-selected-glyph { background: #3b82f6 !important; }
        .code-quiz-correct-line { background: rgba(16, 185, 129, 0.2) !important; }
        .code-quiz-correct-glyph { background: #10b981 !important; }
      `}</style>
      <div className="px-3 py-1.5 border-b border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 shrink-0">
        <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">{filePath}</span>
      </div>
      <div ref={editorContainerRef} className="flex-1" style={{ overscrollBehaviorX: "contain" }}>
        <MonacoEditor
          height="100%"
          language={getLanguageFromPath(filePath)}
          value={content}
          theme="vs-dark"
          onMount={handleEditorMount}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            fontSize: 13,
            glyphMargin: true,
            folding: true,
            wordWrap: "off",
            renderLineHighlight: "none",
            cursorStyle: "line",
          }}
        />
      </div>
    </div>
  );
}
