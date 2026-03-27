"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ResizableDividerProps {
  onResize: (leftWidth: number) => void;
  minLeft?: number;
  maxLeft?: number;
}

export function ResizableDivider({
  onResize,
  minLeft = 20,
  maxLeft = 80,
}: ResizableDividerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dividerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const newLeftWidth =
      ((e.clientX - containerRect.left) / containerRect.width) * 100;

    if (newLeftWidth >= minLeft && newLeftWidth <= maxLeft) {
      onResize(newLeftWidth);
    }
  };

  if (typeof window !== "undefined") {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove as EventListener);
      document.addEventListener("mouseup", handleMouseUp);
    } else {
      document.removeEventListener(
        "mousemove",
        handleMouseMove as EventListener
      );
      document.removeEventListener("mouseup", handleMouseUp);
    }
  }

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full"
      onMouseUp={handleMouseUp}
    >
      <div ref={dividerRef} />
      <div
        onMouseDown={handleMouseDown}
        className={cn(
          "w-1 bg-border hover:bg-primary/50 transition-colors cursor-col-resize select-none",
          isDragging ? "bg-primary" : ""
        )}
      />
    </div>
  );
}