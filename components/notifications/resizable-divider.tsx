"use client";

import { useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ResizableDividerProps {
  left: React.ReactNode;
  right: React.ReactNode;
  onResize: (leftWidth: number) => void;
  minLeft?: number;
  maxLeft?: number;
  initialLeftWidth?: number;
}

export function ResizableDivider({
  left,
  right,
  onResize,
  minLeft = 20,
  maxLeft = 80,
  initialLeftWidth = 35,
}: ResizableDividerProps) {
  const [leftWidth, setLeftWidth] = useState(initialLeftWidth);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newLeftPercent = ((e.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.min(maxLeft, Math.max(minLeft, newLeftPercent));
      setLeftWidth(clamped);
      onResize(clamped);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    } else {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, minLeft, maxLeft, onResize]);

  return (
    <div ref={containerRef} className="flex h-full w-full overflow-hidden">
      <div
        style={{ width: `${leftWidth}%` }}
        className="flex-shrink-0 min-w-0 min-h-0 h-full"
      >
        {left}
      </div>
      <div
        onMouseDown={() => setIsDragging(true)}
        className={cn(
          "w-1 bg-border hover:bg-primary/50 transition-colors cursor-col-resize select-none shrink-0",
          isDragging && "bg-primary"
        )}
      />
      <div className="flex-1 min-w-0 min-h-0 h-full">{right}</div>
    </div>
  );
}