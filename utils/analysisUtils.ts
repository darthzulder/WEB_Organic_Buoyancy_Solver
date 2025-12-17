import * as THREE from 'three';

/**
 * Calculates the projected area of a geometry by rendering it top-down
 * into an offscreen WebGLRenderTarget and counting the occupied pixels.
 * This method handles complex organic shapes, holes, and overlaps correctly.
 */
export const calculateProjectedAreaGPU = (
    geometry: THREE.BufferGeometry,
    renderer: THREE.WebGLRenderer,
    resolution = 2048 // High resolution for precision
): number => {
    if (!geometry) return 0;

    // 1. Setup Geometry and Material
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry.clone(), material);

    // Orient geometry: We want to project onto the XY plane (looking down Z axis).
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox as THREE.Box3;
    const center = new THREE.Vector3();
    box.getCenter(center);

    // Center mesh at 0,0,0
    mesh.position.sub(center);
    mesh.updateMatrixWorld();

    const size = new THREE.Vector3();
    box.getSize(size);

    const worldWidth = size.x;
    const worldHeight = size.y;

    if (worldWidth === 0 || worldHeight === 0) return 0;

    // 2. Setup Orthographic Camera
    // Add padding to ensure no edge clipping
    const paddingRatio = 0.1;
    const viewWidth = worldWidth * (1 + paddingRatio);
    const viewHeight = worldHeight * (1 + paddingRatio);

    const camHalfWidth = viewWidth / 2;
    const camHalfHeight = viewHeight / 2;

    const camera = new THREE.OrthographicCamera(
        -camHalfWidth,
        camHalfWidth,
        camHalfHeight,
        -camHalfHeight,
        -1000,
        1000
    );

    // Look down Z axis (Project on XY)
    camera.position.set(0, 0, 100);
    camera.lookAt(0, 0, 0);
    camera.up.set(0, 1, 0); // Y is Up in 2D projection
    camera.updateProjectionMatrix();

    // 3. Setup Render Target
    // Removed RedFormat to ensure standard RGBA (4 bytes per pixel) consistency with readRenderTargetPixels
    const renderTarget = new THREE.WebGLRenderTarget(resolution, resolution, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        type: THREE.UnsignedByteType,
    });

    // 4. Render
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); // Black background
    scene.add(mesh);

    const originalRenderTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(renderTarget);
    renderer.clear();
    renderer.render(scene, camera);

    // 5. Read Pixels
    // Standard RGBA buffer (4 bytes per pixel)
    const buffer = new Uint8Array(resolution * resolution * 4);
    renderer.readRenderTargetPixels(renderTarget, 0, 0, resolution, resolution, buffer);

    // 6. Count Pixels
    let hitCount = 0;

    // Stride is 4 because we have R, G, B, A for each pixel
    const stride = 4;

    for (let i = 0; i < buffer.length; i += stride) {
        // Check Red channel. Since we render white (255,255,255), checking R > 128 is sufficient.
        if (buffer[i] > 128) {
            hitCount++;
        }
    }

    // 7. Cleanup
    renderer.setRenderTarget(originalRenderTarget);
    renderTarget.dispose();
    material.dispose();
    mesh.geometry.dispose(); // Dispose the clone

    // 8. Calculate Area
    const totalPixels = resolution * resolution;
    const ratio = hitCount / totalPixels;
    const totalViewArea = viewWidth * viewHeight;

    return ratio * totalViewArea;
};
