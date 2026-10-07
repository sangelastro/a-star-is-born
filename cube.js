import * as THREE from 'three';
import { COLORS } from './cubeLogic.js';

// Geometry for a single cubie
const geometry = new THREE.BoxGeometry(0.95, 0.95, 0.95);

// Material map
const materialMap = {
    'U': new THREE.MeshStandardMaterial({ color: COLORS.U }),
    'D': new THREE.MeshStandardMaterial({ color: COLORS.D }),
    'F': new THREE.MeshStandardMaterial({ color: COLORS.F }),
    'B': new THREE.MeshStandardMaterial({ color: COLORS.B }),
    'L': new THREE.MeshStandardMaterial({ color: COLORS.L }),
    'R': new THREE.MeshStandardMaterial({ color: COLORS.R }),
    'CORE': new THREE.MeshStandardMaterial({ color: 0x000000 }) // Internal black
};

export function createCube(group) {
    group.clear();

    // Create 27 cubies
    for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
            for (let z = -1; z <= 1; z++) {
                const materials = [
                    materialMap['CORE'], // Right (placeholder)
                    materialMap['CORE'], // Left
                    materialMap['CORE'], // Top
                    materialMap['CORE'], // Bottom
                    materialMap['CORE'], // Front
                    materialMap['CORE']  // Back
                ];

                const mesh = new THREE.Mesh(geometry, materials);
                mesh.position.set(x, y, z);
                mesh.userData = { x, y, z }; // Store initial position
                group.add(mesh);
            }
        }
    }
}

export function updateCubeVisuals(group, cubeState) {
    // Map the 54 stickers from cubeState to the 3D meshes
    // This is tricky because we need to know which face of which cubie corresponds to which sticker index.

    // Sticker Indices Mapping:
    // U: y=1. 0:(-1,1,-1), 1:(0,1,-1), 2:(1,1,-1), ...
    // This mapping needs to be precise.

    // Let's define a helper to find the mesh at a specific (x, y, z)
    const getMesh = (x, y, z) => {
        return group.children.find(c =>
            Math.round(c.position.x) === x &&
            Math.round(c.position.y) === y &&
            Math.round(c.position.z) === z
        );
    };

    const s = cubeState.stickers;

    // Update materials for each face
    // Right (x=1), Left (x=-1), Top (y=1), Bottom (y=-1), Front (z=1), Back (z=-1)
    // Material indices: 0:Right, 1:Left, 2:Top, 3:Bottom, 4:Front, 5:Back

    // UP Face (y=1)
    // 0 1 2 -> (-1,1,-1) (0,1,-1) (1,1,-1)
    // 3 4 5 -> (-1,1,0)  (0,1,0)  (1,1,0)
    // 6 7 8 -> (-1,1,1)  (0,1,1)  (1,1,1)
    const setFace = (x, y, z, matIdx, colorCode, stickerIdx) => {
        const mesh = getMesh(x, y, z);
        if (mesh) {
            // Clone materials array to avoid sharing
            if (!Array.isArray(mesh.material)) mesh.material = [
                materialMap['CORE'], materialMap['CORE'], materialMap['CORE'],
                materialMap['CORE'], materialMap['CORE'], materialMap['CORE']
            ];

            // Store metadata for raycasting
            if (!mesh.userData.stickerMap) mesh.userData.stickerMap = {};
            mesh.userData.stickerMap[matIdx] = stickerIdx;

            // Check for center stickers
            const centerLabels = { 4: 'U', 13: 'L', 22: 'F', 31: 'R', 40: 'B', 49: 'D' };
            if (centerLabels[stickerIdx]) {
                const canvas = document.createElement('canvas');
                canvas.width = 64;
                canvas.height = 64;
                const ctx = canvas.getContext('2d');

                // Background color (colorCode is a face letter, e.g. 'U')
                ctx.fillStyle = COLORS[colorCode];
                ctx.fillRect(0, 0, 64, 64);

                // Text: dark on light faces (white, yellow), light otherwise
                ctx.fillStyle = (colorCode === 'U' || colorCode === 'D') ? 'black' : 'white';
                ctx.font = 'bold 40px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(centerLabels[stickerIdx], 32, 32);

                const texture = new THREE.CanvasTexture(canvas);
                texture.colorSpace = THREE.SRGBColorSpace;
                mesh.material[matIdx] = new THREE.MeshStandardMaterial({ map: texture });
            } else {
                mesh.material[matIdx] = materialMap[colorCode];
            }
        }
    };

    // U (Top, Index 2)
    setFace(-1, 1, -1, 2, s[0], 0); setFace(0, 1, -1, 2, s[1], 1); setFace(1, 1, -1, 2, s[2], 2);
    setFace(-1, 1, 0, 2, s[3], 3); setFace(0, 1, 0, 2, s[4], 4); setFace(1, 1, 0, 2, s[5], 5);
    setFace(-1, 1, 1, 2, s[6], 6); setFace(0, 1, 1, 2, s[7], 7); setFace(1, 1, 1, 2, s[8], 8);

    // L (Left, Index 1) (x=-1)
    setFace(-1, 1, -1, 1, s[9], 9); setFace(-1, 1, 0, 1, s[10], 10); setFace(-1, 1, 1, 1, s[11], 11);
    setFace(-1, 0, -1, 1, s[12], 12); setFace(-1, 0, 0, 1, s[13], 13); setFace(-1, 0, 1, 1, s[14], 14);
    setFace(-1, -1, -1, 1, s[15], 15); setFace(-1, -1, 0, 1, s[16], 16); setFace(-1, -1, 1, 1, s[17], 17);

    // F (Front, Index 4) (z=1)
    setFace(-1, 1, 1, 4, s[18], 18); setFace(0, 1, 1, 4, s[19], 19); setFace(1, 1, 1, 4, s[20], 20);
    setFace(-1, 0, 1, 4, s[21], 21); setFace(0, 0, 1, 4, s[22], 22); setFace(1, 0, 1, 4, s[23], 23);
    setFace(-1, -1, 1, 4, s[24], 24); setFace(0, -1, 1, 4, s[25], 25); setFace(1, -1, 1, 4, s[26], 26);

    // R (Right, Index 0) (x=1)
    setFace(1, 1, 1, 0, s[27], 27); setFace(1, 1, 0, 0, s[28], 28); setFace(1, 1, -1, 0, s[29], 29);
    setFace(1, 0, 1, 0, s[30], 30); setFace(1, 0, 0, 0, s[31], 31); setFace(1, 0, -1, 0, s[32], 32);
    setFace(1, -1, 1, 0, s[33], 33); setFace(1, -1, 0, 0, s[34], 34); setFace(1, -1, -1, 0, s[35], 35);

    // B (Back, Index 5) (z=-1)
    setFace(1, 1, -1, 5, s[36], 36); setFace(0, 1, -1, 5, s[37], 37); setFace(-1, 1, -1, 5, s[38], 38);
    setFace(1, 0, -1, 5, s[39], 39); setFace(0, 0, -1, 5, s[40], 40); setFace(-1, 0, -1, 5, s[41], 41);
    setFace(1, -1, -1, 5, s[42], 42); setFace(0, -1, -1, 5, s[43], 43); setFace(-1, -1, -1, 5, s[44], 44);

    // D (Bottom, Index 3) (y=-1)
    setFace(-1, -1, 1, 3, s[45], 45); setFace(0, -1, 1, 3, s[46], 46); setFace(1, -1, 1, 3, s[47], 47);
    setFace(-1, -1, 0, 3, s[48], 48); setFace(0, -1, 0, 3, s[49], 49); setFace(1, -1, 0, 3, s[50], 50);
    setFace(-1, -1, -1, 3, s[51], 51); setFace(0, -1, -1, 3, s[52], 52); setFace(1, -1, -1, 3, s[53], 53);
}
