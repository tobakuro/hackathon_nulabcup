"use client";

import { useState, useMemo } from "react";

interface FileTreePanelProps {
  files: { filePath: string; content: string }[];
  currentFile: string | null;
  onFileSelect: (filePath: string) => void;
}

interface TreeNode {
  name: string;
  path: string;
  isFile: boolean;
  children: TreeNode[];
}

function buildTree(files: { filePath: string }[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of files) {
    const parts = file.filePath.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isFile = i === parts.length - 1;
      const path = parts.slice(0, i + 1).join("/");

      let existing = current.find((n) => n.name === name);
      if (!existing) {
        existing = { name, path, isFile, children: [] };
        current.push(existing);
      }
      current = existing.children;
    }
  }

  function sortTree(nodes: TreeNode[]): TreeNode[] {
    return nodes
      .sort((a, b) => {
        if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
        return a.name.localeCompare(b.name);
      })
      .map((n) => ({ ...n, children: sortTree(n.children) }));
  }

  return sortTree(root);
}

function TreeItem({
  node,
  currentFile,
  onFileSelect,
  depth,
}: {
  node: TreeNode;
  currentFile: string | null;
  onFileSelect: (path: string) => void;
  depth: number;
}) {
  const [isOpen, setIsOpen] = useState(depth < 1);
  const isActive = currentFile === node.path;

  if (node.isFile) {
    return (
      <button
        onClick={() => onFileSelect(node.path)}
        className={`w-full text-left px-2 py-1 text-xs font-mono truncate hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors ${
          isActive
            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
            : "text-zinc-700 dark:text-zinc-300"
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {node.name}
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left px-2 py-1 text-xs font-mono truncate text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <span className="mr-1">{isOpen ? "v" : ">"}</span>
        {node.name}/
      </button>
      {isOpen &&
        node.children.map((child) => (
          <TreeItem
            key={child.path}
            node={child}
            currentFile={currentFile}
            onFileSelect={onFileSelect}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}

export default function FileTreePanel({ files, currentFile, onFileSelect }: FileTreePanelProps) {
  const tree = useMemo(() => buildTree(files), [files]);

  return (
    <div className="py-2">
      <div className="px-3 py-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
        Files
      </div>
      {tree.map((node) => (
        <TreeItem
          key={node.path}
          node={node}
          currentFile={currentFile}
          onFileSelect={onFileSelect}
          depth={0}
        />
      ))}
    </div>
  );
}
