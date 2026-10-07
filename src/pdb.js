// Pattern Database (PDB) Logic

// Factorials for permutation indexing
const FACTORIALS = [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880, 3628800, 39916800, 479001600];

// --- Indexing Functions ---

// 1. Corner Indexing
export function indexCorners(corners) {
    // 1. Orientation Index
    let oriIdx = 0;
    for (let i = 0; i < 7; i++) {
        oriIdx = oriIdx * 3 + corners[i].ori;
    }

    // 2. Permutation Index
    let permIdx = 0;
    const seen = [false, false, false, false, false, false, false, false];
    for (let i = 0; i < 8; i++) {
        const p = corners[i].perm;
        let count = 0;
        for (let j = 0; j < p; j++) {
            if (!seen[j]) count++;
        }
        permIdx += count * FACTORIALS[7 - i];
        seen[p] = true;
    }

    return permIdx * 2187 + oriIdx;
}

// 2. Edge Subset Indexing
export function indexEdgeSubset(edges, targetIndices) {
    const positions = {};
    for (let slot = 0; slot < 12; slot++) {
        const p = edges[slot].perm;
        positions[p] = { slot, ori: edges[slot].ori };
    }

    let oriIdx = 0;
    let permIdx = 0;

    // Orientation
    for (let i = 0; i < targetIndices.length; i++) {
        const pieceID = targetIndices[i];
        const pos = positions[pieceID];
        oriIdx = oriIdx * 2 + pos.ori;
    }

    // Permutation
    const occupied = Array(12).fill(false);
    for (let i = 0; i < targetIndices.length; i++) {
        const pieceID = targetIndices[i];
        const slot = positions[pieceID].slot;

        let count = 0;
        for (let j = 0; j < slot; j++) {
            if (!occupied[j]) count++;
        }

        const term = count * permutations(12 - 1 - i, targetIndices.length - 1 - i);
        permIdx += term;

        occupied[slot] = true;
    }

    return permIdx * Math.pow(2, targetIndices.length) + oriIdx;
}

function permutations(n, k) {
    if (k < 0 || k > n) return 0;
    let res = 1;
    for (let i = 0; i < k; i++) {
        res *= (n - i);
    }
    return res;
}

// --- PDB Class ---

export class PatternDatabase {
    constructor(name, indexFunc, size) {
        this.name = name;
        this.indexFunc = indexFunc;
        this.size = size;
        this.table = new Uint8Array(size).fill(255);
        this.generated = false;
    }

    get(state) {
        if (!this.generated) return 0;
        const idx = this.indexFunc(state);
        const val = this.table[idx];
        return val === 255 ? 0 : val;
    }

    async generate(startState, onProgress) {
        if (this.generated) return;

        console.log(`Starting PDB Generation: ${this.name}`);
        const queue = [];

        const startIdx = this.indexFunc(startState);
        this.table[startIdx] = 0;
        queue.push(startState);

        const moves = ['U', "U'", 'D', "D'", 'L', "L'", 'R', "R'", 'F', "F'", 'B', "B'"];
        let visitedCount = 1;
        let head = 0;
        const CHUNK_SIZE = 1000;

        while (head < queue.length) {
            const end = Math.min(head + CHUNK_SIZE, queue.length);

            for (let i = head; i < end; i++) {
                const current = queue[i];
                const currentIdx = this.indexFunc(current);
                const currentDist = this.table[currentIdx];

                if (currentDist >= 12) continue;

                for (const move of moves) {
                    const nextState = current.applyMove(move);
                    const nextIdx = this.indexFunc(nextState);

                    if (this.table[nextIdx] === 255) {
                        this.table[nextIdx] = currentDist + 1;
                        queue.push(nextState);
                        visitedCount++;
                    }
                }
            }

            head = end;

            if (onProgress && head % 5000 === 0) {
                onProgress(visitedCount, this.size);
                await new Promise(r => setTimeout(r, 0));
            }
        }

        this.generated = true;
        console.log(`PDB ${this.name} generated.`);
    }
}

// --- Specific PDB Instances ---

export const cornerOrientationPDB = new PatternDatabase(
    "Corner Orientation",
    (state) => {
        const { corners } = state.toCubieState();
        let idx = 0;
        for (let i = 0; i < 7; i++) idx = idx * 3 + corners[i].ori;
        return idx;
    },
    2187
);

export const cornerPermutationPDB = new PatternDatabase(
    "Corner Permutation",
    (state) => {
        const { corners } = state.toCubieState();
        let idx = 0;
        const seen = [false, false, false, false, false, false, false, false];
        for (let i = 0; i < 8; i++) {
            const p = corners[i].perm;
            let count = 0;
            for (let j = 0; j < p; j++) if (!seen[j]) count++;
            idx += count * FACTORIALS[7 - i];
            seen[p] = true;
        }
        return idx;
    },
    40320
);

export const edgeSubsetPDB = new PatternDatabase(
    "Edge Subset (4 Edges)",
    (state) => {
        const { edges } = state.toCubieState();
        const targetIndices = [0, 1, 2, 3];
        return indexEdgeSubset(edges, targetIndices);
    },
    190080
);
