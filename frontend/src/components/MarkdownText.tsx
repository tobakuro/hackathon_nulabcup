"use client";

import { Fragment } from "react";
import type { ReactNode } from "react";

interface MarkdownTextProps {
  content: string;
  className?: string;
}

function parseInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(
        <strong key={`b-${key++}`} className="font-semibold text-inherit">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      nodes.push(
        <em key={`i-${key++}`} className="italic text-inherit">
          {token.slice(1, -1)}
        </em>,
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(
        <code key={`c-${key++}`} className="rounded bg-zinc-200/70 dark:bg-zinc-700 px-1 py-0.5">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("[")) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (!linkMatch) {
        nodes.push(token);
      } else {
        const [, label, url] = linkMatch;
        const isSafeLink = /^https?:\/\//.test(url);
        nodes.push(
          <a
            key={`a-${key++}`}
            href={isSafeLink ? url : "#"}
            target="_blank"
            rel="noreferrer noopener"
            className="underline text-blue-600 dark:text-blue-400"
          >
            {label}
          </a>,
        );
      }
    } else {
      nodes.push(token);
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

export default function MarkdownText({ content, className }: MarkdownTextProps) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const fenceLang = line.slice(3).trim();
      i += 1;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push(
        <pre
          key={`pre-${key++}`}
          className="mt-2 overflow-x-auto rounded-md bg-zinc-900 text-zinc-100 p-3 text-xs font-mono"
        >
          {fenceLang ? <div className="text-[10px] text-zinc-400 mb-1">{fenceLang}</div> : null}
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const headingClass =
        level === 1
          ? "text-base font-bold text-inherit"
          : level === 2
            ? "text-sm font-semibold text-inherit"
            : "text-xs font-semibold text-inherit";
      blocks.push(
        <p key={`h-${key++}`} className={`${headingClass} mt-2`}>
          {parseInline(text)}
        </p>,
      );
      i += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${key++}`} className="mt-2 ml-4 list-disc space-y-1 text-inherit">
          {items.map((item, idx) => (
            <li key={`li-${idx}`}>{parseInline(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    const paragraphLines: string[] = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() !== "") {
      if (
        lines[i].startsWith("```") ||
        /^(#{1,3})\s+/.test(lines[i]) ||
        /^[-*]\s+/.test(lines[i])
      ) {
        break;
      }
      paragraphLines.push(lines[i]);
      i += 1;
    }

    blocks.push(
      <p key={`p-${key++}`} className="mt-1 leading-relaxed">
        {parseInline(paragraphLines.join(" "))}
      </p>,
    );
  }

  return (
    <div className={`text-inherit ${className ?? ""}`}>
      {blocks.map((block, idx) => (
        <Fragment key={idx}>{block}</Fragment>
      ))}
    </div>
  );
}
