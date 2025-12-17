import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrthographicCamera, Bounds, Center } from '@react-three/drei';
import * as THREE from 'three';

interface ShadowPreviewProps {
    geometry: THREE.BufferGeometry;
    scale: number;
}

export const ShadowPreview: React.FC<ShadowPreviewProps> = ({ geometry, scale }) => {
    return (
        <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 100], up: [0, 1, 0], fov: 40 }}>
            {/* Light background for the preview to show the "shadow" (black object) clearly */}
            {/* @ts-ignore */}
            <color attach="background" args={['#ffffff']} />

            <OrthographicCamera makeDefault position={[0, 0, 100]} up={[0, 1, 0]} near={-1000} far={1000} />

            {/* Bounds ensures the object fits perfectly in the small view */}
            <Bounds fit clip observe margin={1.1}>
                <Center>
                    {/* @ts-ignore */}
                    <mesh geometry={geometry} scale={[scale, scale, scale]} rotation={[0, 0, 0]}>
                        {/* Flat black material to represent the shadow/projection */}
                        {/* @ts-ignore */}
                        <meshBasicMaterial color="black" />
                        {/* @ts-ignore */}
                    </mesh>
                </Center>
            </Bounds>
        </Canvas>
    );
};
