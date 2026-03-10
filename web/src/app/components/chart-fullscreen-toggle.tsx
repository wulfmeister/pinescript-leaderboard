"use client";

import { useState, useEffect, useCallback, type RefObject } from "react";

interface Props {
  containerRef: RefObject<HTMLDivElement | null>;
}

export function ChartFullscreenToggle({ containerRef }: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(document.fullscreenElement !== null);
    };
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  const handleToggle = useCallback(() => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch((e) => {
        if (process.env.NODE_ENV !== "production") console.warn("exitFullscreen failed", e);
      });
    } else {
      containerRef.current.requestFullscreen().catch((e) => {
        if (process.env.NODE_ENV !== "production") console.warn("requestFullscreen failed", e);
      });
    }
  }, [containerRef]);

  return (
    <button
      onClick={handleToggle}
      className="btn btn-ghost text-xs"
      title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
    >
      {isFullscreen ? "⊡" : "⊞"}
    </button>
  );
}
