import * as THREE from 'three';

export interface PhysicalProperties {
  mass: number;
  density: number; // kg/m^3
  volume: number; // m^3
  cog: THREE.Vector3; // Center of Gravity (Local space)
}

export interface SimulationState {
  waterDensity: number; // kg/m^3
  gravity: number; // m/s^2
  isSolving: boolean;
  iterations: number;
}

export interface ExternalWeight {
  id: string;
  mass: number;
  position: THREE.Vector3; // Relative to the main object center
  rotation?: THREE.Vector3; // Euler angles in Radians
  color: string;
  stlUrl?: string | null; // Optional: Custom mesh URL
  scale?: number; // Optional: Scale for the custom mesh
}

export interface SolverResult {
  displacement: number; // Z position
  rotationX: number; // Pitch
  rotationY: number; // Roll (using Y as second axis for calculation simplicity in 3D lib, though physics calls it Z rotation usually)
  submergedVolume: number;
  cob: THREE.Vector3; // Center of Buoyancy (World Space)
  totalMass: number;
  combinedCOG: THREE.Vector3; // Combined Center of Gravity (World Space)
}