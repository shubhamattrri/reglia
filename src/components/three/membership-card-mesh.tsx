"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox, Text } from "@react-three/drei";
import * as THREE from "three";

export type MembershipCardProps = {
  metalColor?: string;
  accentColor?: string;
  label?: string;
  sublabel?: string;
  scrollProgress?: number;
  mouse?: { x: number; y: number };
  position?: [number, number, number];
  scale?: number;
  withLights?: boolean;
};

export function MembershipCardMesh({
  metalColor = "#12151c",
  accentColor = "#c4a574",
  label = "LIMASU",
  sublabel = "REGALIA",
  scrollProgress = 0,
  mouse = { x: 0, y: 0 },
  position = [0, 0, 0],
  scale = 1,
  withLights = true,
}: MembershipCardProps) {
  const group = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.SpotLight>(null);

  useFrame(() => {
    if (!group.current) return;
    const targetRotX = mouse.y * 0.28 + scrollProgress * 0.35;
    const targetRotY = mouse.x * 0.45 + scrollProgress * Math.PI * 0.55;
    group.current.rotation.x = THREE.MathUtils.lerp(
      group.current.rotation.x,
      targetRotX,
      0.08
    );
    group.current.rotation.y = THREE.MathUtils.lerp(
      group.current.rotation.y,
      targetRotY,
      0.08
    );
    group.current.position.z = THREE.MathUtils.lerp(
      group.current.position.z,
      position[2] + scrollProgress * 1.4,
      0.08
    );
    if (lightRef.current) {
      lightRef.current.position.x = mouse.x * 3;
      lightRef.current.position.y = 2 + mouse.y * 1.5;
    }
  });

  return (
    <group ref={group} position={position} scale={scale}>
      {withLights && (
        <>
          <spotLight
            ref={lightRef}
            intensity={2.4}
            angle={0.55}
            penumbra={0.7}
            position={[2, 3, 4]}
            color="#fff4e5"
          />
          <ambientLight intensity={0.35} />
          <directionalLight
            position={[-3, 2, 2]}
            intensity={0.55}
            color="#9eb6ff"
          />
        </>
      )}

      <RoundedBox args={[3.2, 2, 0.08]} radius={0.08} smoothness={8} castShadow>
        <meshStandardMaterial
          color={metalColor}
          metalness={0.92}
          roughness={0.28}
          envMapIntensity={1.2}
        />
      </RoundedBox>

      <mesh position={[0, 0.72, 0.045]}>
        <planeGeometry args={[2.4, 0.02]} />
        <meshStandardMaterial
          color={accentColor}
          metalness={1}
          roughness={0.18}
          emissive={accentColor}
          emissiveIntensity={0.12}
        />
      </mesh>

      <Text
        position={[-1.15, 0.35, 0.05]}
        fontSize={0.22}
        letterSpacing={0.18}
        color={accentColor}
        anchorX="left"
        anchorY="middle"
      >
        {label}
      </Text>
      <Text
        position={[-1.15, 0.05, 0.05]}
        fontSize={0.12}
        letterSpacing={0.28}
        color="#f5f0e8"
        anchorX="left"
        anchorY="middle"
      >
        {sublabel}
      </Text>
      <Text
        position={[-1.15, -0.55, 0.05]}
        fontSize={0.08}
        letterSpacing={0.22}
        color={accentColor}
        anchorX="left"
        anchorY="middle"
      >
        MEMBERSHIP
      </Text>

      <mesh position={[1.05, -0.55, 0.05]}>
        <circleGeometry args={[0.18, 32]} />
        <meshStandardMaterial
          color={accentColor}
          metalness={1}
          roughness={0.2}
          emissive={accentColor}
          emissiveIntensity={0.15}
        />
      </mesh>
    </group>
  );
}
