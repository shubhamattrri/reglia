"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Environment, Float } from "@react-three/drei";
import * as THREE from "three";
import { MembershipCardMesh } from "./membership-card-mesh";
import { membershipTiers } from "@/lib/site-config";

type TierCardsSceneProps = {
  progress?: number;
  mouse?: { x: number; y: number };
};

export function TierCardsScene({
  progress = 0,
  mouse = { x: 0, y: 0 },
}: TierCardsSceneProps) {
  const group = useRef<THREE.Group>(null);
  const active = Math.min(
    membershipTiers.length - 1,
    Math.floor(progress * membershipTiers.length)
  );

  const positions = useMemo(() => {
    return membershipTiers.map((_, i) => {
      const offset = i - 1.5;
      return new THREE.Vector3(offset * 2.1, 0, -Math.abs(offset) * 0.4);
    });
  }, []);

  useFrame(() => {
    if (!group.current) return;
    group.current.rotation.y = THREE.MathUtils.lerp(
      group.current.rotation.y,
      mouse.x * 0.15,
      0.06
    );
  });

  return (
    <>
      <color attach="background" args={["#05070b"]} />
      <Environment preset="city" environmentIntensity={0.55} />
      <ambientLight intensity={0.4} />
      <spotLight
        position={[0, 4, 6]}
        angle={0.5}
        intensity={2.2}
        penumbra={0.8}
        color="#fff4e8"
      />
      <group ref={group}>
        {membershipTiers.map((tier, i) => {
          const dist = Math.abs(i - active);
          const z = dist === 0 ? 1.2 : -dist * 0.85;
          const y = dist === 0 ? 0.1 : -0.15 * dist;
          const s = dist === 0 ? 1 : 0.78 - dist * 0.04;
          return (
            <Float
              key={tier.id}
              speed={1.2}
              floatIntensity={dist === 0 ? 0.35 : 0.1}
              rotationIntensity={0.08}
            >
              <MembershipCardMesh
                position={[positions[i].x, y, z]}
                scale={s}
                metalColor={i === 0 ? "#1a1d24" : "#10131a"}
                accentColor={tier.accent}
                label="LIMASU"
                sublabel={tier.metal.toUpperCase()}
                scrollProgress={dist === 0 ? 0.15 : 0}
                mouse={dist === 0 ? mouse : { x: 0, y: 0 }}
                withLights={false}
              />
            </Float>
          );
        })}
      </group>
    </>
  );
}
