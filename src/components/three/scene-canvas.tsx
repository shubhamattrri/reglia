"use client";

import dynamic from "next/dynamic";
import { Suspense, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const Canvas = dynamic(
  () => import("@react-three/fiber").then((m) => m.Canvas),
  { ssr: false }
);

type SceneCanvasProps = {
  children: ReactNode;
  className?: string;
  camera?: {
    position?: [number, number, number];
    fov?: number;
  };
  dpr?: number | [number, number];
};

export function SceneCanvas({
  children,
  className,
  camera = { position: [0, 0, 5], fov: 42 },
  dpr = [1, 1.5],
}: SceneCanvasProps) {
  return (
    <div className={cn("absolute inset-0", className)}>
      <Suspense fallback={null}>
        <Canvas
          dpr={dpr}
          camera={camera}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
          }}
          style={{ background: "transparent" }}
        >
          {children}
        </Canvas>
      </Suspense>
    </div>
  );
}
