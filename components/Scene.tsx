import React, { Suspense, useRef, useState, useEffect } from 'react';
import { Canvas, useLoader, extend } from '@react-three/fiber';
import { OrbitControls, Grid, Html } from '@react-three/drei';
import * as THREE from 'three';
import { STLLoader } from 'three-stdlib';
import { Solver } from './Solver';
import { PhysicalProperties, ExternalWeight, SolverResult } from '../types';
import { calculateMeshProperties } from '../utils/geometryUtils';

// Register custom name for Line to avoid TypeScript conflict with SVG <line>
extend({ ThreeLine: THREE.Line });

// Explicitly declare the used intrinsic elements to satisfy TypeScript in strict environments
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      ambientLight: any;
      directionalLight: any;
      mesh: any;
      planeGeometry: any;
      meshStandardMaterial: any;
      group: any;
      boxGeometry: any;
      sphereGeometry: any;
      meshBasicMaterial: any;
      threeLine: any;
      bufferGeometry: any;
      float32BufferAttribute: any;
      lineBasicMaterial: any;
      orthographicCamera: any;
      color: any;
    }
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      ambientLight: any;
      directionalLight: any;
      mesh: any;
      planeGeometry: any;
      meshStandardMaterial: any;
      group: any;
      boxGeometry: any;
      sphereGeometry: any;
      meshBasicMaterial: any;
      threeLine: any;
      bufferGeometry: any;
      float32BufferAttribute: any;
      lineBasicMaterial: any;
      orthographicCamera: any;
      color: any;
    }
  }
}

// --- Assets ---
const PlaceholderIsland = ({ setGeometry }: { setGeometry: (g: THREE.BufferGeometry) => void }) => {
    useEffect(() => {
        const geom = new THREE.TorusKnotGeometry(1.5, 0.4, 100, 16);
        geom.rotateX(Math.PI / 2); 
        geom.computeVertexNormals();
        geom.center();
        setGeometry(geom);
    }, [setGeometry]);
    return null;
};

interface ModelProps {
    fileUrl: string;
    scaleFactor: number;
    onGeometryLoaded: (geo: THREE.BufferGeometry) => void;
}

const STLModel: React.FC<ModelProps> = ({ fileUrl, scaleFactor, onGeometryLoaded }) => {
    const geom = useLoader(STLLoader, fileUrl) as THREE.BufferGeometry;
    
    useEffect(() => {
        if(geom) {
            // Clone geometry to prevent issues with cached resources and apply new transforms
            const clonedGeom = geom.clone();
            
            // Apply User Scale
            clonedGeom.scale(scaleFactor, scaleFactor, scaleFactor);

            // Fix rotation if necessary and center
            clonedGeom.computeVertexNormals();
            clonedGeom.center(); 
            
            // Adjust position so the bottom of the mesh sits at Z=0 initially
            // This prevents it from spawning deep underwater which causes huge forces
            clonedGeom.computeBoundingBox();
            if (clonedGeom.boundingBox) {
                const heightOffset = -clonedGeom.boundingBox.min.z;
                clonedGeom.translate(0, 0, heightOffset * 0.5); // Lift it up a bit
            }
            
            onGeometryLoaded(clonedGeom);
        }
    }, [geom, scaleFactor, onGeometryLoaded]);

    return null;
}

// Component to render individual weight (either box or STL)
const WeightModel = ({ weight, isSelected, baseDensity }: { weight: ExternalWeight, isSelected: boolean, baseDensity: number }) => {
    const materialProps = {
        color: isSelected ? '#facc15' : weight.color,
        emissive: isSelected ? '#facc15' : '#000000',
        emissiveIntensity: isSelected ? 0.5 : 0
    };

    const rotationArray: [number, number, number] = weight.rotation 
        ? [weight.rotation.x, weight.rotation.y, weight.rotation.z] 
        : [0, 0, 0];

    // If it has an STL URL, load it
    if (weight.stlUrl) {
        return (
            <Suspense fallback={<mesh position={weight.position}><boxGeometry args={[0.5,0.5,0.5]} /><meshStandardMaterial color="gray" /></mesh>}>
                <WeightSTL weight={weight} rotation={rotationArray} materialProps={materialProps} />
            </Suspense>
        );
    }

    // Default Cube
    const size = Math.max(0.2, Math.cbrt(weight.mass/baseDensity)*0.5);
    return (
        <mesh 
            position={weight.position} 
            rotation={rotationArray}
            castShadow
        >
            <boxGeometry args={[size, size, size]} />
            <meshStandardMaterial {...materialProps} />
        </mesh>
    );
};

// Sub-component for loading weight STL to isolate suspense
const WeightSTL = ({ weight, rotation, materialProps }: { weight: ExternalWeight, rotation: [number, number, number], materialProps: any }) => {
    const geom = useLoader(STLLoader, weight.stlUrl!) as THREE.BufferGeometry;
    const meshRef = useRef<THREE.Mesh>(null);

    // Process geometry once loaded
    const processedGeom = React.useMemo(() => {
        const clone = geom.clone();
        const scale = weight.scale || 1.0;
        clone.scale(scale, scale, scale);
        clone.center(); // Center geometry so position prop works as COG
        clone.computeVertexNormals();
        return clone;
    }, [geom, weight.scale]);

    return (
        <mesh 
            ref={meshRef}
            position={weight.position} 
            rotation={rotation}
            geometry={processedGeom} 
            castShadow
        >
            <meshStandardMaterial {...materialProps} />
        </mesh>
    );
};

const LoaderFallback = () => (
    <Html center>
        <div className="text-white bg-black/50 px-4 py-2 rounded animate-pulse">
            Loading Mesh...
        </div>
    </Html>
);


interface SceneContentProps {
    stlFile: File | null;
    importScale: number;
    weights: ExternalWeight[];
    baseDensity: number;
    waterDensity: number;
    onStatsUpdate: (stats: SolverResult) => void;
    selectedWeightId?: string | null;
}

const SceneContent: React.FC<SceneContentProps> = ({ 
    stlFile, 
    importScale, 
    weights, 
    baseDensity, 
    waterDensity, 
    onStatsUpdate, 
    selectedWeightId 
}) => {
    const groupRef = useRef<THREE.Group>(null);
    const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
    const [baseProps, setBaseProps] = useState<PhysicalProperties>({
        mass: 1000,
        density: baseDensity,
        volume: 1,
        cog: new THREE.Vector3(0,0,0)
    });
    const [visualStats, setVisualStats] = useState<SolverResult | null>(null);

    // Handle File Loading
    const [fileUrl, setFileUrl] = useState<string | undefined>(undefined);

    useEffect(() => {
        if (stlFile) {
            const url = URL.createObjectURL(stlFile);
            setFileUrl(url);
            
            // IMPORTANT: Clear previous geometry immediately to prevent ghosting
            setGeometry(null);
            
            return () => URL.revokeObjectURL(url);
        } else {
            setFileUrl(undefined);
            setGeometry(null); 
        }
    }, [stlFile]);

    // Recalculate physical properties when geometry or density changes
    useEffect(() => {
        if (!geometry) return;

        const { volume, cog } = calculateMeshProperties(geometry);
        const mass = volume * baseDensity;
        
        setBaseProps({ mass, density: baseDensity, volume, cog });
    }, [geometry, baseDensity]);

    // Handle updates from Solver
    const handleSolverUpdate = (res: SolverResult) => {
        setVisualStats(res);
        onStatsUpdate(res);
    };

    return (
        <>
            <color attach="background" args={['#0f172a']} />
            <ambientLight intensity={0.6} />
            <directionalLight 
                position={[10, 10, 10]} 
                intensity={1} 
                castShadow
                shadow-mapSize={[2048, 2048]}
                shadow-bias={-0.0001} // Helps with self-shadowing artifacts
                shadow-normalBias={0.05} // Critical for smooth curved surfaces to avoid acne
            >
                <orthographicCamera attach="shadow-camera" args={[-20, 20, 20, -20]} />
            </directionalLight>
            
            {/* Water Plane (Z=0) */}
            <mesh position={[0, 0, 0]} receiveShadow>
                <planeGeometry args={[500, 500]} />
                <meshStandardMaterial 
                    color="#3b82f6" 
                    transparent 
                    opacity={0.6} 
                    roughness={0.1} 
                    metalness={0.1} 
                    side={THREE.DoubleSide}
                    depthWrite={false} // IMPORTANT: Fixes z-fighting with grid and underwater objects
                />
            </mesh>
            
            {/* Grid Helper - Lifted slightly above water to prevent z-fighting */}
            <Grid 
                position={[0, 0, 0.02]} 
                rotation={[Math.PI / 2, 0, 0]} 
                args={[500, 500]} 
                cellSize={1} 
                sectionSize={10} 
                cellColor="#ffffff"
                sectionColor="#ffffff"
                cellThickness={0.5}
                sectionThickness={1}
                fadeDistance={100}
                fadeStrength={1}
                infiniteGrid 
            />

            {/* Simulation Object Group */}
            <group ref={groupRef}>
                {/* Main Mesh */}
                {geometry && (
                    <mesh geometry={geometry} castShadow receiveShadow>
                        <meshStandardMaterial 
                            color="#fca5a5" 
                            roughness={0.6} 
                            side={THREE.DoubleSide} 
                        />
                    </mesh>
                )}
                
                {/* External Weights */}
                {weights.map(w => (
                    <WeightModel 
                        key={w.id} 
                        weight={w} 
                        isSelected={w.id === selectedWeightId} 
                        baseDensity={baseDensity} 
                    />
                ))}
            </group>

            {/* Loaders */}
            <Suspense fallback={<LoaderFallback />}>
                {fileUrl ? (
                    <STLModel 
                        key={`${fileUrl}-${importScale}`} 
                        fileUrl={fileUrl} 
                        scaleFactor={importScale}
                        onGeometryLoaded={setGeometry} 
                    />
                ) : (
                    <PlaceholderIsland setGeometry={setGeometry} />
                )}
            </Suspense>

            {/* Logic - Key forces remount/reset when geometry changes */}
            <Solver 
                key={geometry?.uuid || 'no-geo'}
                meshGeometry={geometry}
                baseProperties={baseProps}
                weights={weights}
                waterDensity={waterDensity}
                onUpdate={handleSolverUpdate}
                targetRef={groupRef}
            />

            {/* Visual Debug Markers (World Space) */}
            {visualStats && (
                <>
                    {/* Center of Gravity (Combined) - Green */}
                    <mesh position={visualStats.combinedCOG}>
                        <sphereGeometry args={[0.2, 16, 16]} />
                        <meshBasicMaterial color="#22c55e" depthTest={false} transparent opacity={0.8} />
                    </mesh>
                    
                    {/* Center of Buoyancy - Blue */}
                    <mesh position={visualStats.cob}>
                        <sphereGeometry args={[0.2, 16, 16]} />
                        <meshBasicMaterial color="#3b82f6" depthTest={false} transparent opacity={0.8} />
                    </mesh>

                    {/* Connection Line */}
                    <threeLine>
                         <bufferGeometry>
                            <float32BufferAttribute 
                                attach="attributes-position" 
                                args={[[
                                    visualStats.combinedCOG.x, visualStats.combinedCOG.y, visualStats.combinedCOG.z,
                                    visualStats.cob.x, visualStats.cob.y, visualStats.cob.z
                                ], 3]} 
                                count={2}
                                itemSize={3}
                            />
                         </bufferGeometry>
                         <lineBasicMaterial color="white" />
                    </threeLine>
                </>
            )}

            <OrbitControls makeDefault />
        </>
    );
};

export const Scene: React.FC<SceneContentProps> = (props) => {
    return (
        <div className="w-full h-full relative">
            <Canvas shadows camera={{ position: [8, 8, 8], fov: 45, up: [0, 0, 1] }}>
                <SceneContent {...props} />
            </Canvas>
            
            <div className="absolute bottom-4 left-4 text-xs text-white/50 pointer-events-none">
                <p>Z-Axis is Up.</p>
                <p>Green Dot: Center of Gravity (COG)</p>
                <p>Blue Dot: Center of Buoyancy (COB)</p>
            </div>
        </div>
    );
};