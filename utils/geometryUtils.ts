import * as THREE from 'three';

// Constants
const EPSILON = 1e-5;

/**
 * Calculates the total volume and center of mass (centroid) of a closed geometry.
 * Assumes uniform density for the geometry itself.
 */
export const calculateMeshProperties = (geometry: THREE.BufferGeometry) => {
  let volume = 0;
  let cx = 0, cy = 0, cz = 0;

  const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
  const index = geometry.getIndex();
  const faces = index ? index.count / 3 : posAttr.count / 3;

  const p1 = new THREE.Vector3();
  const p2 = new THREE.Vector3();
  const p3 = new THREE.Vector3();

  for (let i = 0; i < faces; i++) {
    let i1, i2, i3;
    if (index) {
      i1 = index.getX(i * 3);
      i2 = index.getX(i * 3 + 1);
      i3 = index.getX(i * 3 + 2);
    } else {
      i1 = i * 3;
      i2 = i * 3 + 1;
      i3 = i * 3 + 2;
    }

    p1.fromBufferAttribute(posAttr, i1);
    p2.fromBufferAttribute(posAttr, i2);
    p3.fromBufferAttribute(posAttr, i3);

    // Signed volume of tetrahedron formed by origin and triangle
    const v321 = p3.x * p2.y * p1.z;
    const v231 = p2.x * p3.y * p1.z;
    const v312 = p3.x * p1.y * p2.z;
    const v132 = p1.x * p3.y * p2.z;
    const v213 = p2.x * p1.y * p3.z;
    const v123 = p1.x * p2.y * p3.z;

    const term = (1.0 / 6.0) * (-v321 + v231 + v312 - v132 - v213 + v123);
    volume += term;

    // Centroid contribution
    cx += term * (p1.x + p2.x + p3.x) / 4.0;
    cy += term * (p1.y + p2.y + p3.y) / 4.0;
    cz += term * (p1.z + p2.z + p3.z) / 4.0;
  }

  const cog = new THREE.Vector3(cx / volume, cy / volume, cz / volume);
  return { volume: Math.abs(volume), cog };
};

/**
 * Clips a triangle against the plane Z=0 and returns the submerged properties.
 * This effectively slices the mesh in real-time to find the underwater volume.
 */
export const calculateSubmergedProperties = (
  geometry: THREE.BufferGeometry,
  matrixWorld: THREE.Matrix4
): { volume: number; center: THREE.Vector3 } => {
  
  let totalVolume = 0;
  let momentX = 0;
  let momentY = 0;
  let momentZ = 0;

  const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
  const index = geometry.getIndex();
  const count = index ? index.count : posAttr.count;

  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();

  // Helper to process a submerged triangle
  const addTriangleContribution = (p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3) => {
    // Signed volume of tetrahedron relative to origin (World 0,0,0)
    // Formula: (1/6) * dot(p1, cross(p2, p3))
    const vol = (p1.dot(p2.clone().cross(p3))) / 6.0;
    
    totalVolume += vol;
    
    // Geometric center of the tetrahedron (Origin + p1 + p2 + p3) / 4
    // Since origin is 0,0,0 it's just (p1+p2+p3)/4
    momentX += vol * (p1.x + p2.x + p3.x) / 4.0;
    momentY += vol * (p1.y + p2.y + p3.y) / 4.0;
    momentZ += vol * (p1.z + p2.z + p3.z) / 4.0;
  };

  // Helper to find intersection between two points and Plane Z=0
  const intersectPlane = (p1: THREE.Vector3, p2: THREE.Vector3): THREE.Vector3 => {
    const t = -p1.z / (p2.z - p1.z);
    return new THREE.Vector3(
      p1.x + t * (p2.x - p1.x),
      p1.y + t * (p2.y - p1.y),
      0
    );
  };

  for (let i = 0; i < count; i += 3) {
    // 1. Get vertices in Local Space
    if (index) {
      vA.fromBufferAttribute(posAttr, index.getX(i));
      vB.fromBufferAttribute(posAttr, index.getX(i + 1));
      vC.fromBufferAttribute(posAttr, index.getX(i + 2));
    } else {
      vA.fromBufferAttribute(posAttr, i);
      vB.fromBufferAttribute(posAttr, i + 1);
      vC.fromBufferAttribute(posAttr, i + 2);
    }

    // 2. Transform to World Space
    vA.applyMatrix4(matrixWorld);
    vB.applyMatrix4(matrixWorld);
    vC.applyMatrix4(matrixWorld);

    // 3. Classify vertices relative to water (Z=0)
    // Note: In our simulation Z is UP. Water is at Z=0.
    // Submerged means z < 0.
    const aUnder = vA.z < 0;
    const bUnder = vB.z < 0;
    const cUnder = vC.z < 0;
    const countUnder = (aUnder ? 1 : 0) + (bUnder ? 1 : 0) + (cUnder ? 1 : 0);

    if (countUnder === 0) continue; // Fully above water

    if (countUnder === 3) {
      // Fully submerged
      addTriangleContribution(vA, vB, vC);
    } else if (countUnder === 1) {
      // 1 vertex under, 2 above. Result is 1 small triangle below.
      // We need to identify which one is under.
      let pUnder, pOver1, pOver2;
      if (aUnder) { pUnder = vA; pOver1 = vB; pOver2 = vC; }
      else if (bUnder) { pUnder = vB; pOver1 = vC; pOver2 = vA; }
      else { pUnder = vC; pOver1 = vA; pOver2 = vB; }

      const i1 = intersectPlane(pUnder, pOver1);
      const i2 = intersectPlane(pUnder, pOver2);

      // Important: Preserve winding order relative to original triangle
      if (aUnder) addTriangleContribution(pUnder, i1, i2); // A is first
      else if (bUnder) addTriangleContribution(i2, pUnder, i1); // B is second
      else addTriangleContribution(i1, i2, pUnder); // C is third
    } else if (countUnder === 2) {
      // 2 vertices under, 1 above. Result is a quad (split into 2 triangles).
      let pOver, pUnder1, pUnder2;
      if (!aUnder) { pOver = vA; pUnder1 = vB; pUnder2 = vC; }
      else if (!bUnder) { pOver = vB; pUnder1 = vC; pUnder2 = vA; }
      else { pOver = vC; pUnder1 = vA; pUnder2 = vB; }

      const i1 = intersectPlane(pOver, pUnder1);
      const i2 = intersectPlane(pOver, pUnder2);

      // Form two triangles. 
      // Original winding: Over -> Under1 -> Under2
      // Quad is i1 -> Under1 -> Under2 -> i2
      
      if (!aUnder) {
        // A is Over. Sequence: A, B, C -> i1, B, C, i2
        addTriangleContribution(i1, pUnder1, pUnder2);
        addTriangleContribution(i1, pUnder2, i2);
      } else if (!bUnder) {
        // B is Over. Sequence: A, B, C -> A, i1, i2, C
        addTriangleContribution(pUnder2, i2, i1);
        addTriangleContribution(pUnder2, i1, pUnder1);
      } else {
        // C is Over. Sequence: A, B, C -> A, B, i1, i2
        addTriangleContribution(pUnder1, pUnder2, i2);
        addTriangleContribution(pUnder1, i2, i1);
      }
    }
  }

  // Final check for division by zero
  if (Math.abs(totalVolume) < EPSILON) {
    return { volume: 0, center: new THREE.Vector3(0, 0, 0) };
  }

  return {
    volume: Math.abs(totalVolume), // Volume should be positive
    center: new THREE.Vector3(momentX / totalVolume, momentY / totalVolume, momentZ / totalVolume)
  };
};