import React, { useEffect, useRef } from "react";
import { createPong, PongApi, PongOptions } from "./pong";

interface PongGameProps {
  options?: PongOptions;
  onScoresChange?: (scores: { player: number; ai: number }) => void;
  className?: string;
}

export const PongGame: React.FC<PongGameProps> = ({
  options = { responsive: true, maxWidth: 600, shadow: false },
  onScoresChange,
  className,
}) => {
  const gameOptions = { ...options, className };
  const containerRef = useRef<HTMLDivElement>(null);
  const pongRef = useRef<PongApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    pongRef.current = createPong(containerRef.current, gameOptions);

    return () => {
      if (pongRef.current) {
        pongRef.current.destroy();
        pongRef.current = null;
      }
    };
  }, []);

  // Separate effect for score monitoring to avoid recreating the game
  useEffect(() => {
    if (!onScoresChange || !pongRef.current) return;

    const interval = setInterval(() => {
      if (pongRef.current) {
        onScoresChange(pongRef.current.getScores());
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [onScoresChange]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100vw",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        maxWidth: options.maxWidth || 400,
      }}
    />
  );
};
