"use client";

import { useRef, useState, useCallback, useEffect, useLayoutEffect } from "react";

interface ResizablePanesProps {
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
  defaultLeftWidth?: number;
  defaultRightRatio?: number;
  minWidth?: number;
}

export default function ResizablePanes({
  left,
  center,
  right,
  defaultLeftWidth = 256,
  defaultRightRatio = 1 / 3,
  minWidth = 120,
}: ResizablePanesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const [rightWidth, setRightWidth] = useState(0);

  useLayoutEffect(() => {
    if (rightWidth !== 0 || !containerRef.current) return;
    const containerWidth = containerRef.current.offsetWidth;
    setRightWidth(Math.round(containerWidth * defaultRightRatio));
  }, [defaultRightRatio, rightWidth]);
  const draggingRef = useRef<"left" | "right" | null>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const onMouseDown = useCallback(
    (side: "left" | "right") => (e: React.MouseEvent) => {
      e.preventDefault();
      draggingRef.current = side;
      startXRef.current = e.clientX;
      startWidthRef.current = side === "left" ? leftWidth : rightWidth;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [leftWidth, rightWidth],
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current || !containerRef.current) return;
      const containerWidth = containerRef.current.offsetWidth;
      const delta = e.clientX - startXRef.current;

      if (draggingRef.current === "left") {
        const newWidth = Math.max(
          minWidth,
          Math.min(startWidthRef.current + delta, containerWidth - rightWidth - minWidth),
        );
        setLeftWidth(newWidth);
      } else {
        const newWidth = Math.max(
          minWidth,
          Math.min(startWidthRef.current - delta, containerWidth - leftWidth - minWidth),
        );
        setRightWidth(newWidth);
      }
    };

    const onMouseUp = () => {
      draggingRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [leftWidth, rightWidth, minWidth]);

  return (
    <div ref={containerRef} className="flex flex-1 overflow-hidden">
      {/* Left pane */}
      <div
        className="overflow-y-auto bg-white/40 dark:bg-zinc-900/40 shrink-0"
        style={{ width: leftWidth }}
      >
        {left}
      </div>

      {/* Left divider */}
      <div
        role="separator"
        className="w-1 shrink-0 bg-zinc-200 dark:bg-zinc-800 hover:bg-blue-400 dark:hover:bg-blue-600 cursor-col-resize transition-colors active:bg-blue-500"
        onMouseDown={onMouseDown("left")}
      />

      {/* Center pane */}
      <div className="flex-1 overflow-hidden">{center}</div>

      {/* Right divider */}
      <div
        role="separator"
        className="w-1 shrink-0 bg-zinc-200 dark:bg-zinc-800 hover:bg-blue-400 dark:hover:bg-blue-600 cursor-col-resize transition-colors active:bg-blue-500"
        onMouseDown={onMouseDown("right")}
      />

      {/* Right pane */}
      <div
        className="overflow-y-auto bg-white/40 dark:bg-zinc-900/40 shrink-0"
        style={{ width: rightWidth }}
      >
        {right}
      </div>
    </div>
  );
}
