
import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Grid, Environment, Text } from '@react-three/drei';
import * as THREE from 'three';
import { DesignParams, SimulationResult } from '../types';

interface SceneProps {
  params: DesignParams;
  results: SimulationResult;
}

const RotorAssembly: React.FC<SceneProps> = ({ params, results }) => {
  const rotorRef = useRef<THREE.Group>(null);
  const bladesRef = useRef<THREE.Group>(null);
  
  const rotationSpeed = (results.rpm * 2 * Math.PI) / 60;

  useFrame((state, delta) => {
    if (bladesRef.current) {
      // Spin around Y axis (Rotor Axis)
      bladesRef.current.rotation.y += rotationSpeed * delta;
      
      // Teetering simulation (Rocking around X axis - Blade Span)
      // Teeter roughly 5 degrees max, synchronized with rotation
      const teeterAmplitude = THREE.MathUtils.degToRad(5); 
      const azim = bladesRef.current.rotation.y;
      bladesRef.current.rotation.x = Math.sin(azim) * teeterAmplitude;
    }
  });

  // Re-orient blade geometry for Y-Axis spin
  // Length along X, Thickness along Y, Chord along Z
  const bladeGeo = useMemo(() => new THREE.BoxGeometry(params.bladeLength, 0.02, params.bladeChord), [params.bladeLength, params.bladeChord]);
  const hubGeo = useMemo(() => new THREE.CylinderGeometry(0.1, 0.1, 0.2, 32), []);
  const sphereBearingGeo = useMemo(() => new THREE.SphereGeometry(0.15, 32, 32), []);

  const scaleFactor = 0.1; // Scale N to visual units
  const thrustLength = Math.min(results.totalRotorThrust * scaleFactor, 5);
  const generatedThrustLength = Math.min(results.generatedThrust * scaleFactor, 5);
  const weightLength = Math.min(results.gravity * scaleFactor, 5);
  const liftLength = Math.min(results.lift * scaleFactor, 5);
  const dragLength = Math.min(results.drag * scaleFactor, 5);

  return (
    <group ref={rotorRef} position={[0, 0, 0]}>
       
      {/* WORLD SPACE FORCES (Fixed at Origin) */}
      <group>
        {/* Gravity / Weight - Purple - Always Down (-Y) */}
        <arrowHelper args={[new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 0), weightLength, 0xa855f7]} />
        <Text position={[0.2, -weightLength/2, 0]} fontSize={0.2} color="#a855f7" anchorX="left">
          {`Weight\n${results.gravity} N`}
        </Text>

        {/* Global Lift - Cyan - Up (+Y) */}
        <arrowHelper args={[new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), liftLength, 0x06b6d4]} />
        <Text position={[-0.2, liftLength, 0]} fontSize={0.2} color="#06b6d4" anchorX="right">
          {`Lift\n${results.lift} N`}
        </Text>

        {/* Drag - Red - Downwind (-Z) */}
        <arrowHelper args={[new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, 0), dragLength, 0xef4444]} />
         <Text position={[0, 0.2, -dragLength]} fontSize={0.2} color="#ef4444" anchorX="center">
          {`Drag\n${results.drag} N`}
        </Text>
      </group>

      {/* LINE GROUP: Rotates Y-Axis (Up) to match Elevation */}
      {/* Elevation 90 (Vert) -> Rot 0. Elevation 0 (Horiz/Downwind) -> Rot -90 X */}
      <group rotation={[THREE.MathUtils.degToRad(params.lineAngle - 90), 0, 0]}>
        
        {/* Lower Kite Line (To Ground Anchor) */}
        <mesh position={[0, -10, 0]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 20, 16]} />
          <meshStandardMaterial color="#fbbf24" /> {/* Amber line */}
        </mesh>
        
        {/* Upper Kite Line (To Kite) */}
        <mesh position={[0, 10, 0]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 20, 16]} />
          <meshStandardMaterial color="#fbbf24" /> {/* Amber line */}
        </mesh>

        {/* Static Line Label (Lower Section) */}
        <Text 
          position={[0.2, -3, 0]} 
          fontSize={0.2} 
          color="#fbbf24"
          anchorX="left"
        >
          To Anchor
        </Text>
        
        {/* Kite Label (Upper Section) */}
        <Text 
          position={[0.2, 5, 0]} 
          fontSize={0.2} 
          color="#fbbf24"
          anchorX="left"
        >
          To Kite
        </Text>

        {/* Added Tension Vector - Orange - Along Line Axis (+Y) */}
        {results.generatedThrust > 0 && (
          <>
            <arrowHelper args={[new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0.2, 0), generatedThrustLength, 0xf97316]} />
            <Text 
              position={[-0.3, 1.5, 0]} 
              fontSize={0.25} 
              color="#f97316"
              anchorX="right"
              anchorY="middle"
            >
              {`Added Tension\n${results.generatedThrust} N`}
            </Text>
          </>
        )}

        {/* Spherical Bearing (Pivot Point) */}
        <mesh geometry={sphereBearingGeo} position={[0,0,0]}>
           <meshStandardMaterial color="#94a3b8" metalness={1.0} roughness={0.1} />
        </mesh>

        {/* ROTOR GROUP: Tilts Rotor Axis relative to Line */}
        {/* Positive Tilt = Tilt Back (Top moves -Z) = Negative X Rotation */}
        <group rotation={[THREE.MathUtils.degToRad(-params.rotorTilt || 0), 0, 0]}>
          
          <group ref={bladesRef}>
            {/* Hub - Default Cylinder is Y-aligned */}
            <mesh geometry={hubGeo}>
              <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.2} />
            </mesh>

            {/* Blade 1 - Extends +X */}
            <mesh 
              geometry={bladeGeo} 
              position={[params.bladeLength / 2 + 0.1, 0, 0]} 
              // Pitch rotates around Blade Span (X)
              rotation={[THREE.MathUtils.degToRad(params.bladePitch), 0, 0]}
            >
               <meshStandardMaterial color="#38bdf8" />
            </mesh>

            {/* Blade 2 - Extends -X */}
            <mesh 
              geometry={bladeGeo} 
              position={[-params.bladeLength / 2 - 0.1, 0, 0]} 
              // Pitch rotates around Blade Span (X).
              rotation={[THREE.MathUtils.degToRad(params.bladePitch), 0, 0]} 
            >
               <meshStandardMaterial color="#38bdf8" />
            </mesh>
            
            {/* Teeter Pin Visual (X-axis pin) */}
            <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI/2]}>
               <cylinderGeometry args={[0.02, 0.02, 0.25, 16]} />
               <meshStandardMaterial color="red" />
            </mesh>
          </group>

          {/* Total Rotor Thrust Vector - Green - Along Rotor Axis (+Y) */}
          {results.totalRotorThrust > 0 && (
            <>
              {/* Offset slightly in X to distinguish from Line Tension vector if angles are small */}
              <arrowHelper args={[new THREE.Vector3(0, 1, 0), new THREE.Vector3(0.05, 0.2, 0), thrustLength, 0x10b981]} />
              <Text 
                position={[0.3, 0.2 + thrustLength / 2, 0]} 
                fontSize={0.25} 
                color="#10b981"
                anchorX="left"
                anchorY="middle"
              >
                {`Total Rotor Thrust\n${results.totalRotorThrust} N`}
              </Text>
            </>
          )}

        </group>
      </group>

      {/* Wind Vector (Global Horizontal) */}
      <arrowHelper args={[new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, 5), 3, 0xffffff]} />
      <Text position={[0, 0.5, 4]} fontSize={0.3} color="white">Wind Direction</Text>

      {/* AoA Visual Guide */}
      <Text position={[2, 2, 0]} fontSize={0.25} color="white" anchorX="left">
           {`Angle of Attack: ${results.angleOfAttack}°`}
      </Text>

    </group>
  );
};

export const ThreeScene: React.FC<SceneProps> = (props) => {
  return (
    <div className="w-full h-full bg-slate-900 rounded-lg overflow-hidden shadow-inner">
      <Canvas>
        <PerspectiveCamera makeDefault position={[4, 2, 4]} fov={50} />
        <OrbitControls target={[0, 0, 0]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
        <pointLight position={[-10, -10, -5]} intensity={0.5} color="blue" />
        
        <Environment preset="city" />
        
        <RotorAssembly {...props} />
        
        <Grid 
          position={[0, -2, 0]} 
          args={[20, 20]} 
          cellSize={1} 
          cellThickness={0.5} 
          cellColor="#334155" 
          sectionSize={5} 
          sectionThickness={1}
          sectionColor="#475569"
          fadeDistance={30}
        />
      </Canvas>
      <div className="absolute bottom-4 left-4 text-xs text-slate-400 pointer-events-none">
        <p>Left Click: Rotate • Right Click: Pan • Scroll: Zoom</p>
      </div>
    </div>
  );
};
