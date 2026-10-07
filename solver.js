import { CubeState } from './cubeLogic.js';
import { cornerOrientationPDB, cornerPermutationPDB, edgeSubsetPDB } from './src/pdb.js';

// --- Heuristics ---

// 1. Misplaced Stickers
export function heuristicMisplaced(state) {
    let misplaced = 0;
    const s = state.stickers;
    const ranges = [
        { start: 0, end: 8, color: 'U' },
        { start: 9, end: 17, color: 'L' },
        { start: 18, end: 26, color: 'F' },
        { start: 27, end: 35, color: 'R' },
        { start: 36, end: 44, color: 'B' },
        { start: 45, end: 53, color: 'D' }
    ];
    for (const range of ranges) {
        for (let i = range.start; i <= range.end; i++) {
            if (s[i] !== range.color) misplaced++;
        }
    }
    return Math.ceil(misplaced / 8);
}

// 2. Manhattan Distance (Stickers)
const faceAdjacency = {
    'U': { 'U': 0, 'F': 1, 'B': 1, 'L': 1, 'R': 1, 'D': 2 },
    'D': { 'D': 0, 'F': 1, 'B': 1, 'L': 1, 'R': 1, 'U': 2 },
    'F': { 'F': 0, 'U': 1, 'D': 1, 'L': 1, 'R': 1, 'B': 2 },
    'B': { 'B': 0, 'U': 1, 'D': 1, 'L': 1, 'R': 1, 'F': 2 },
    'L': { 'L': 0, 'U': 1, 'D': 1, 'F': 1, 'B': 1, 'R': 2 },
    'R': { 'R': 0, 'U': 1, 'D': 1, 'F': 1, 'B': 1, 'L': 2 }
};

function getFaceFromIndex(i) {
    if (i >= 0 && i <= 8) return 'U';
    if (i >= 9 && i <= 17) return 'L';
    if (i >= 18 && i <= 26) return 'F';
    if (i >= 27 && i <= 35) return 'R';
    if (i >= 36 && i <= 44) return 'B';
    if (i >= 45 && i <= 53) return 'D';
    return '?';
}

export function heuristicManhattan(state) {
    let totalDistance = 0;
    const s = state.stickers;
    for (let i = 0; i < 54; i++) {
        const stickerColor = s[i];
        const currentFace = getFaceFromIndex(i);
        const dist = faceAdjacency[stickerColor][currentFace];
        totalDistance += dist;
    }
    return Math.ceil(totalDistance / 8);
}

// 3. Misplaced Cubies
export function heuristicMisplacedCubies(state) {
    const { corners, edges } = state.toCubieState();
    let misplaced = 0;
    for (let i = 0; i < 8; i++) if (corners[i].perm !== i) misplaced++;
    for (let i = 0; i < 12; i++) if (edges[i].perm !== i) misplaced++;
    return Math.ceil(misplaced / 8);
}

// 4. Twist and Flip
export function heuristicTwistFlip(state) {
    const { corners, edges } = state.toCubieState();
    let twists = 0;
    let flips = 0;
    for (let i = 0; i < 8; i++) if (corners[i].ori !== 0) twists++;
    for (let i = 0; i < 12; i++) if (edges[i].ori !== 0) flips++;
    return Math.ceil((twists + flips) / 8);
}

// 5. Single PDB (Corners)
export function heuristicSinglePDB(state) {
    const h1 = cornerOrientationPDB.get(state);
    const h2 = cornerPermutationPDB.get(state);
    return Math.max(h1, h2);
}

// 6. Disjoint PDB
export function heuristicDisjointPDB(state) {
    const hCorners = heuristicSinglePDB(state);
    const hEdges = edgeSubsetPDB.get(state);
    return Math.max(hCorners, hEdges);
}

// Helper to trigger generation
export async function generatePDBs(onProgress) {
    const { CubeState } = await import('./cubeLogic.js');
    const solved = new CubeState();

    await cornerOrientationPDB.generate(solved, (c, t) => onProgress(`Corner Ori: ${c}/${t}`));
    await cornerPermutationPDB.generate(solved, (c, t) => onProgress(`Corner Perm: ${c}/${t}`));
    await edgeSubsetPDB.generate(solved, (c, t) => onProgress(`Edge Subset: ${c}/${t}`));
}

// --- Generator ---

export async function* SolveAStarGenerator(startState, heuristicFunc = heuristicMisplaced) {
    const openSet = [];
    const closedSet = new Set();

    const startH = heuristicFunc(startState);
    const startNode = {
        state: startState,
        path: [],
        g: 0,
        h: startH,
        f: startH,
        id: 0,
        parentId: null
    };

    openSet.push(startNode);

    const moves = ['U', "U'", 'D', "D'", 'L', "L'", 'R', "R'", 'F', "F'", 'B', "B'"];
    let iterations = 0;
    const maxIterations = 5000;
    let nodeIdCounter = 1;

    while (openSet.length > 0) {
        iterations++;
        openSet.sort((a, b) => a.f - b.f);
        const current = openSet.shift();

        yield {
            type: 'step',
            current: current,
            openSet: openSet.slice(0, 10),
            closedSetSize: closedSet.size,
            iterations: iterations
        };

        if (current.state.isSolved()) {
            yield {
                type: 'success',
                path: current.path,
                iterations: iterations,
                finalNode: current
            };
            return;
        }

        const stateKey = JSON.stringify(current.state.stickers);
        if (closedSet.has(stateKey)) continue;
        closedSet.add(stateKey);

        if (iterations > maxIterations) {
            yield { type: 'failure', reason: 'Max iterations reached' };
            return;
        }

        for (const move of moves) {
            if (current.path.length > 0) {
                const lastMove = current.path[current.path.length - 1];
                if (isReverseMove(move, lastMove)) continue;
            }

            const newState = current.state.applyMove(move);
            const newG = current.g + 1;
            const newH = heuristicFunc(newState);

            const neighbor = {
                state: newState,
                path: [...current.path, move],
                g: newG,
                h: newH,
                f: newG + newH,
                id: nodeIdCounter++,
                parentId: current.id,
                moveFromParent: move
            };

            openSet.push(neighbor);
        }
    }

    yield { type: 'failure', reason: 'No solution found' };
}

function isReverseMove(move1, move2) {
    if (move1 === move2 + "'") return true;
    if (move1 + "'" === move2) return true;
    return false;
}
