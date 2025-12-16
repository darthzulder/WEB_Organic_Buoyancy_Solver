import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PhysicalProperties, ExternalWeight, SolverResult } from '../types';
import { calculateSubmergedProperties } from '../utils/geometryUtils';

interface SolverProps {
  meshGeometry: THREE.BufferGeometry | null;
  baseProperties: PhysicalProperties;
  weights: ExternalWeight[];
  waterDensity: number;
  onUpdate: (result: SolverResult) => void;
  targetRef: React.RefObject<THREE.Group>;
}

export const Solver: React.FC<SolverProps> = ({
  meshGeometry,
  baseProperties,
  weights,
  waterDensity,
  onUpdate,
  targetRef
}) => {
  // Solver State
  const positionZ = useRef(0);
  const rotationX = useRef(0);
  const rotationY = useRef(0);

  // Constants for solver stability
  const DAMPING_TRANSLATION = 0.1;
  const DAMPING_ROTATION = 0.05;
  const MAX_ITERATIONS = 5; // Iterations per frame for stability
  const GRAVITY = 9.81;

  useFrame(() => {
    if (!meshGeometry || !targetRef.current) return;

    // 1. Calculate Combined Center of Gravity (COG) and Total Mass
    // Start with base mesh
    let totalMass = baseProperties.mass;
    let momentSum = baseProperties.cog.clone().multiplyScalar(baseProperties.mass);

    // Add external weights
    weights.forEach(w => {
      totalMass += w.mass;
      // Weight position is relative to model origin
      momentSum.add(w.position.clone().multiplyScalar(w.mass));
    });

    const combinedCOG_Local = momentSum.divideScalar(totalMass);
    
    // Convert Local COG to World COG based on current transform
    const objectGroup = targetRef.current;
    
    // We update the physics model step by step
    for (let i = 0; i < MAX_ITERATIONS; i++) {
        // Apply current state to matrix
        objectGroup.position.z = positionZ.current;
        objectGroup.rotation.x = rotationX.current;
        objectGroup.rotation.y = rotationY.current;
        objectGroup.updateMatrixWorld(true);

        // Calculate Submerged Geometry
        const { volume: submergedVol, center: cobWorld } = calculateSubmergedProperties(
            meshGeometry,
            objectGroup.matrixWorld
        );

        // --- Physics Forces ---
        
        // 1. Vertical Buoyancy Force vs Gravity
        const buoyancyForce = submergedVol * waterDensity * GRAVITY;
        const weightForce = totalMass * GRAVITY;
        const netForceZ = buoyancyForce - weightForce;

        // Simple proportional control for height (Heave)
        // Adjust Z based on force difference.
        // We clamp the step to avoid "exploding" meshes if forces are massive (e.g. mm units vs m)
        let heaveStep = netForceZ * 0.00005; 
        
        // Safety clamp: Don't move more than 0.5 unit per iteration to prevent explosion
        heaveStep = Math.max(-0.5, Math.min(0.5, heaveStep));

        positionZ.current += heaveStep * DAMPING_TRANSLATION;

        // 2. Rotational Stability (Righting Moment)
        // We need COG in World Space
        const cogWorld = combinedCOG_Local.clone().applyMatrix4(objectGroup.matrixWorld);

        // Error vector from COB to COG (Horizontal plane)
        const dx = cogWorld.x - cobWorld.x;
        const dy = cogWorld.y - cobWorld.y;

        // Apply rotation to minimize this distance
        let pitchStep = dy * 0.02; 
        let rollStep = dx * 0.02;

        // Safety clamp rotation
        pitchStep = Math.max(-0.05, Math.min(0.05, pitchStep));
        rollStep = Math.max(-0.05, Math.min(0.05, rollStep));

        rotationX.current -= pitchStep * DAMPING_ROTATION;
        rotationY.current += rollStep * DAMPING_ROTATION;
        
        // Store results for visualization
        if (i === MAX_ITERATIONS - 1) {
             onUpdate({
                displacement: positionZ.current,
                rotationX: rotationX.current,
                rotationY: rotationY.current,
                submergedVolume: submergedVol,
                cob: cobWorld,
                totalMass: totalMass,
                combinedCOG: cogWorld
            });
        }
    }
  });

  return null;
};