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
      bladesRef.current.rotation.z += rotationSpeed * delta;
      
      const teeterAmplitude = THREE.MathUtils.degToRad(5); 
      const azim = bladesRef.current.rotation.z;
      bladesRef.current.rotation.x = Math.sin(azim) * teeterAmplitude;
    }
  });

  const bladeGeo = useMemo(() => new THREE.BoxGeometry(params.bladeLength, params.bladeChord, 0.02), [params.bladeLength, params.bladeChord]);
  const hubGeo = useMemo(() => new THREE.CylinderGeometry(0.1, 0.1, 0.2, 32), []);
  const sphereBearingGeo = useMemo(() => new THREE.SphereGeometry(0.15, 32, 32), []);

  const arrowLength = Math.min(results.totalRotorThrust / 10, 4);

  return (
    <group ref={rotorRef} rotation={[0, 0, 0]}>
       
      {/* Align entire system to Line Angle */}
      <group rotation={[THREE.MathUtils.degToRad(90 - params.lineAngle), 0, 0]}>
        
        {/* The Kite Line (Static Reference) */}
        <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 20, 16]} />
          <meshStandardMaterial color="#fbbf24" /> {/* Amber line */}
        </mesh>
        
        {/* Static Line Label */}
        <Text 
          position={[0.3, 2, 0]} 
          fontSize={0.2} 
          color="#fbbf24"
          anchorX="left"
        >
          Static Line Tension
        </Text>

        {/* Spherical Bearing (Pivot Point) */}
        <mesh geometry={sphereBearingGeo} position={[0,0,0]}>
           <meshStandardMaterial color="#94a3b8" metalness={1.0} roughness={0.1} />
        </mesh>

        {/* The Tilted Rotor Assembly (Controlled by Spherical Bearing) */}
        <group rotation={[THREE.MathUtils.degToRad(params.rotorTilt || 0), 0, 0]}>
          
          <group ref={bladesRef}>
            {/* Hub */}
            <mesh geometry={hubGeo} rotation={[Math.PI / 2, 0, 0]}>
              <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.2} />
            </mesh>

            {/* Blade 1 */}
            <mesh 
              geometry={bladeGeo} 
              position={[params.bladeLength / 2 + 0.1, 0, 0]} 
              rotation={[THREE.MathUtils.degToRad(params.bladePitch), 0, 0]}
            >
               <meshStandardMaterial color="#38bdf8" />
            </mesh>

            {/* Blade 2 */}
            <mesh 
              geometry={bladeGeo} 
              position={[-params.bladeLength / 2 - 0.1, 0, 0]} 
              rotation={[THREE.MathUtils.degToRad(params.bladePitch), 0, 0]} 
            >
               <meshStandardMaterial color="#38bdf8" />
            </mesh>
            
            {/* Teeter Pin Visual */}
            <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI/2]}>
               <cylinderGeometry args={[0.02, 0.02, 0.25, 16]} />
               <meshStandardMaterial color="red" />
            </mesh>
          </group>

          {/* Thrust Vector - Green - Attached to Rotor Axis */}
          <arrowHelper args={[new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0.2), arrowLength, 0x10b981]} />
          
          <Text 
            position={[0.3, 0, 0.2 + arrowLength / 2]} 
            fontSize={0.25} 
            color="#10b981"
            anchorX="left"
            anchorY="middle"
          >
            {`Total Rotor Thrust\n${results.totalRotorThrust} N`}
          </Text>

        </group>
        
        {/* Optional: Show Effective Tension projection if significantly tilted */}
        {Math.abs(params.rotorTilt || 0) > 2 && (
             <group>
                 <arrowHelper args={[new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0.2), Math.min(results.generatedThrust/10, 4), 0xfbbf24]} />
                  <Text 
                  position={[-0.3, 0, 1]} 
                  fontSize={0.2} 
                  color="#fbbf24"
                  anchorX="right"
                  anchorY="middle"
                >
                  {`Effective Axial Pull\n${results.generatedThrust} N`}
                </Text>
             </group>
        )}

      </group>

      {/* Wind Vector (Global Horizontal) */}
      <arrowHelper args={[new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, 5), 3, 0xffffff]} />
      <Text position={[0, 0.5, 4]} fontSize={0.3} color="white">Wind Direction</Text>

    </group>
  );
};

export const ThreeScene: React.FC<SceneProps> = (props) => {
  return (
    <div className="w-full h-full bg-slate-900 rounded-lg overflow-hidden shadow-inner">
      <Canvas>
        <PerspectiveCamera makeDefault position={[5, 2, 5]} fov={50} />
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