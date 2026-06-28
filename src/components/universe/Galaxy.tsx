'use client';

import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Stars, PerspectiveCamera, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Memory } from '../../types';

interface MemoryStar {
  memory: Memory;
  position: [number, number, number];
}

// Category → color mapping for stars
const CATEGORY_COLORS: Record<string, string> = {
  Date: '#ec4899',     // Pink
  Travel: '#06b6d4',   // Cyan
  Movie: '#8b5cf6',    // Violet
  Game: '#22c55e',     // Green
  Food: '#f59e0b',     // Amber
  Call: '#3b82f6',     // Blue
  Gift: '#f43f5e',     // Rose
  Personal: '#d946ef', // Fuchsia
};

const CATEGORY_HOVER_COLORS: Record<string, string> = {
  Date: '#f9a8d4',
  Travel: '#67e8f9',
  Movie: '#c4b5fd',
  Game: '#86efac',
  Food: '#fcd34d',
  Call: '#93c5fd',
  Gift: '#fda4af',
  Personal: '#f0abfc',
};

interface GalaxySceneProps {
  memories: Memory[];
  onSelectStar: (memory: Memory) => void;
}

const GalaxyScene: React.FC<GalaxySceneProps> = ({ memories, onSelectStar }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const { camera } = useThree();

  // Spiral galaxy parameters
  const particleCount = 4000;
  const branches = 3;
  const spin = 1;
  const radius = 18;
  const randomness = 0.5;
  const power = 4;
  const insideColor = '#e879f9'; // Fuchsia
  const outsideColor = '#06b6d4'; // Cyan

  // Generate spiral particles
  const [positions, colors] = useMemo(() => {
    // Deterministic seeded random number generator to resolve purity checks
    let seed = 12345;
    const seededRandom = () => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    const pos = new Float32Array(particleCount * 3);
    const cols = new Float32Array(particleCount * 3);
    const colorInside = new THREE.Color(insideColor);
    const colorOutside = new THREE.Color(outsideColor);

    for (let i = 0; i < particleCount; i++) {
      const r = seededRandom() * radius;
      const branchAngle = ((i % branches) / branches) * Math.PI * 2;
      const spinAngle = r * spin;

      const randomX = Math.pow(seededRandom(), power) * (seededRandom() < 0.5 ? 1 : -1) * randomness * r;
      const randomY = Math.pow(seededRandom(), power) * (seededRandom() < 0.5 ? 1 : -1) * randomness * r;
      const randomZ = Math.pow(seededRandom(), power) * (seededRandom() < 0.5 ? 1 : -1) * randomness * r;

      const x = Math.cos(branchAngle + spinAngle) * r + randomX;
      const z = Math.sin(branchAngle + spinAngle) * r + randomZ;
      const y = randomY;

      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;

      // Color interpolation based on radius
      const mixedColor = colorInside.clone().lerp(colorOutside, r / radius);
      cols[i * 3] = mixedColor.r;
      cols[i * 3 + 1] = mixedColor.g;
      cols[i * 3 + 2] = mixedColor.b;
    }

    return [pos, cols];
  }, [branches, spin, radius, randomness, power]);

  // Map relationship memories to interactive stars
  const memoryStars = useMemo<MemoryStar[]>(() => {
    return memories.map((m, idx) => {
      // Position memory stars along a golden spiral inside the galaxy
      const angle = idx * 1.8;
      const r = 2.5 + (idx * 1.1) % (radius - 4);
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = (Math.sin(idx * 2) * 1.5);
      return {
        memory: m,
        position: [x, y, z]
      };
    });
  }, [memories]);

  // Frame animation to spin galaxy
  useFrame((state, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.04;
    }
  });

  return (
    <>
      <ambientLight intensity={0.15} />
      <pointLight position={[0, 0, 0]} intensity={1.5} color="#c084fc" />

      {/* Background stars */}
      <Stars radius={100} depth={50} count={3000} factor={4} saturation={0.5} fade speed={1.5} />

      {/* Galactic Dust Cloud */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[colors, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.06}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          vertexColors
          transparent
          opacity={0.7}
        />
      </points>

      {/* Interactive memory stars */}
      {memoryStars.map((ms) => (
        <InteractiveStar
          key={ms.memory.id}
          memoryStar={ms}
          onSelect={onSelectStar}
          camera={camera}
        />
      ))}
    </>
  );
};

interface InteractiveStarProps {
  memoryStar: MemoryStar;
  onSelect: (memory: Memory) => void;
  camera: THREE.Camera;
}

const InteractiveStar: React.FC<InteractiveStarProps> = ({ memoryStar, onSelect, camera }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  
  const starColor = CATEGORY_COLORS[memoryStar.memory.category] || '#f59e0b';
  const hoverColor = CATEGORY_HOVER_COLORS[memoryStar.memory.category] || '#fbbf24';

  useFrame((state) => {
    if (meshRef.current) {
      // Slow pulse animation with a safe offset derived from UUID characters
      const idOffset = Array.from(memoryStar.memory.id.substring(0, 5))
        .reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const scale = 1 + Math.sin(state.clock.getElapsedTime() * 3 + idOffset) * 0.15;
      meshRef.current.scale.set(scale, scale, scale);
      
      // Face camera
      meshRef.current.quaternion.copy(camera.quaternion);
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(memoryStar.memory);
  };

  return (
    <mesh
      ref={meshRef}
      position={memoryStar.position}
      onClick={handleClick}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
    >
      <sphereGeometry args={[0.22, 16, 16]} />
      <meshBasicMaterial
        color={hovered ? hoverColor : starColor}
        toneMapped={false}
      />
      {/* Halo effect */}
      <mesh scale={[1.8, 1.8, 1.8]}>
        <sphereGeometry args={[0.22, 8, 8]} />
        <meshBasicMaterial
          color={starColor}
          transparent
          opacity={hovered ? 0.35 : 0.15}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Tooltip on hover */}
      {hovered && (
        <Html center distanceFactor={10} style={{ pointerEvents: 'none' }}>
          <div className="glass-intense px-3 py-1.5 rounded-lg border border-white/20 text-center whitespace-nowrap" style={{ minWidth: '80px' }}>
            <p className="text-[10px] font-bold text-white">{memoryStar.memory.title}</p>
            <p className="text-[8px] text-slate-400">{memoryStar.memory.category} • {memoryStar.memory.date}</p>
          </div>
        </Html>
      )}
    </mesh>
  );
};

interface GalaxyProps {
  memories: Memory[];
  onSelectMemory: (memory: Memory) => void;
}

export default function Galaxy({ memories, onSelectMemory }: GalaxyProps) {
  return (
    <div className="w-full h-full relative bg-slate-950">
      <Canvas dpr={[1, 2]} className="w-full h-full">
        <PerspectiveCamera makeDefault position={[0, 10, 20]} fov={60} />
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          maxDistance={35}
          minDistance={3}
          maxPolarAngle={Math.PI / 1.8}
        />
        <GalaxyScene memories={memories} onSelectStar={onSelectMemory} />
      </Canvas>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 glass px-4 py-2 rounded-full text-xs text-slate-400 pointer-events-none select-none">
        Drag to rotate • Scroll to zoom • Click a star to inspect a memory
      </div>
    </div>
  );
}
