// Cube Logic

export const COLORS = {
    U: 'white',
    D: 'yellow',
    F: 'green',
    B: 'blue',
    L: 'orange',
    R: 'red'
};

// Indices for the 54 stickers
// U: 0-8, L: 9-17, F: 18-26, R: 27-35, B: 36-44, D: 45-53
// Standard mapping:
//             U0 U1 U2
//             U3 U4 U5
//             U6 U7 U8
// L0 L1 L2  F0 F1 F2  R0 R1 R2  B0 B1 B2
// L3 L4 L5  F3 F4 F5  R3 R4 R5  B3 B4 B5
// L6 L7 L8  F6 F7 F8  R6 R7 R8  B6 B7 B8
//             D0 D1 D2
//             D3 D4 D5
//             D6 D7 D8

export class CubeState {
    constructor(stickers) {
        if (stickers) {
            this.stickers = [...stickers];
        } else {
            // Solved state
            this.stickers = [
                ...Array(9).fill('U'), // 0-8
                ...Array(9).fill('L'), // 9-17
                ...Array(9).fill('F'), // 18-26
                ...Array(9).fill('R'), // 27-35
                ...Array(9).fill('B'), // 36-44
                ...Array(9).fill('D')  // 45-53
            ];
        }
    }

    clone() {
        return new CubeState(this.stickers);
    }

    // Apply a move and return a NEW state
    applyMove(move) {
        const newState = this.clone();
        const s = newState.stickers;

        // Helper to cycle 4 stickers
        const cycle = (i1, i2, i3, i4) => {
            const temp = s[i4];
            s[i4] = s[i3];
            s[i3] = s[i2];
            s[i2] = s[i1];
            s[i1] = temp;
        };

        // Helper to rotate a face clockwise
        const rotateFace = (offset) => {
            cycle(offset + 0, offset + 2, offset + 8, offset + 6); // Corners
            cycle(offset + 1, offset + 5, offset + 7, offset + 3); // Edges
        };

        switch (move) {
            case 'U':
                rotateFace(0);
                cycle(18, 9, 36, 27); // F0 L0 B0 R0
                cycle(19, 10, 37, 28); // F1 L1 B1 R1
                cycle(20, 11, 38, 29); // F2 L2 B2 R2
                break;
            case 'D':
                rotateFace(45);
                cycle(24, 33, 42, 15); // F6 R6 B6 L6
                cycle(25, 34, 43, 16); // F7 R7 B7 L7
                cycle(26, 35, 44, 17); // F8 R8 B8 L8
                break;

            case 'F':
                rotateFace(18);
                cycle(6, 27, 47, 17); // U6 R0 D2 L8
                cycle(7, 30, 46, 14); // U7 R3 D1 L5
                cycle(8, 33, 45, 11); // U8 R6 D0 L2
                break;

            case 'B':
                rotateFace(36);
                cycle(2, 9, 51, 35); // U2 L0 D6 R8
                cycle(1, 12, 52, 32); // U1 L3 D7 R5
                cycle(0, 15, 53, 29); // U0 L6 D8 R2
                break;

            case 'L':
                rotateFace(9);
                cycle(0, 18, 45, 44); // U0 F0 D0 B8
                cycle(3, 21, 48, 41); // U3 F3 D3 B5
                cycle(6, 24, 51, 38); // U6 F6 D6 B2
                break;

            case 'R':
                rotateFace(27);
                cycle(8, 36, 53, 26); // U8 B0 D8 F8
                cycle(5, 39, 50, 23); // U5 B3 D5 F5
                cycle(2, 42, 47, 20); // U2 B6 D2 F2
                break;
        }

        // Handle Prime moves properly
        if (move.endsWith("'")) {
            const baseMove = move[0];
            let state = this.clone();
            state = state.applyMove(baseMove);
            state = state.applyMove(baseMove);
            state = state.applyMove(baseMove);
            return state;
        }

        return newState;
    }

    isSolved() {
        // Check if all faces have uniform color
        const faces = [0, 9, 18, 27, 36, 45];
        for (let start of faces) {
            const color = this.stickers[start];
            for (let i = 1; i < 9; i++) {
                if (this.stickers[start + i] !== color) return false;
            }
        }
        return true;
    }

    // Convert sticker state to Cubie state (Permutation + Orientation)
    toCubieState() {
        return getCubieState(this.stickers);
    }
}

// --- Cubie Representation Logic ---

// Corner definitions (indices of stickers)
// Order: URF, UFL, ULB, UBR, DFR, DLF, DBL, DRB
export const CORNER_INDICES = [
    [8, 27, 20],  // URF (U8, R0, F2)
    [6, 18, 11],  // UFL (U6, F0, L2)
    [0, 9, 38],   // ULB (U0, L0, B2)
    [2, 36, 29],  // UBR (U2, B0, R2)
    [47, 26, 33], // DFR (D2, F8, R6)
    [45, 17, 24], // DLF (D0, L8, F6)
    [51, 44, 15], // DBL (D6, B8, L6)
    [53, 35, 42]  // DRB (D8, R8, B6)
];

// Edge definitions (indices of stickers)
// Order: UR, UF, UL, UB, DR, DF, DL, DB, FR, FL, BL, BR
export const EDGE_INDICES = [
    [5, 28], // UR (U5, R1)
    [7, 19], // UF (U7, F1)
    [3, 10], // UL (U3, L1)
    [1, 37], // UB (U1, B1)
    [50, 34], // DR (D5, R7)
    [46, 25], // DF (D1, F7)
    [48, 16], // DL (D3, L7)
    [52, 43], // DB (D7, B7)
    [23, 30], // FR (F5, R3)
    [21, 14], // FL (F3, L5)
    [41, 12], // BL (B5, L3)
    [39, 32]  // BR (B3, R5)
];

// Solved Cubie Definitions (to identify which cubie is which)
// We identify a cubie by its colors.
// Sorted string of colors -> Cubie Index
const SOLVED_CORNERS = {};
const SOLVED_EDGES = {};

function initSolvedCubies() {
    // Generate map from colors to index
    // We assume the standard coloring: U=U, F=F, etc.
    // Corner 0 (URF) has colors U, R, F.
    const getColors = (indices) => indices.map(i => {
        if (i < 9) return 'U';
        if (i < 18) return 'L';
        if (i < 27) return 'F';
        if (i < 36) return 'R';
        if (i < 45) return 'B';
        return 'D';
    });

    CORNER_INDICES.forEach((indices, i) => {
        const colors = getColors(indices).sort().join('');
        SOLVED_CORNERS[colors] = i;
    });

    EDGE_INDICES.forEach((indices, i) => {
        const colors = getColors(indices).sort().join('');
        SOLVED_EDGES[colors] = i;
    });
}
initSolvedCubies();

export function getCubieState(stickers) {
    // Corners
    const corners = [];
    for (let i = 0; i < 8; i++) {
        const indices = CORNER_INDICES[i];
        const currentColors = indices.map(idx => stickers[idx]);
        const key = [...currentColors].sort().join('');
        const perm = SOLVED_CORNERS[key];

        // Orientation: position of the U/D sticker within the corner (0, 1 or 2)
        const ori = currentColors.findIndex(c => c === 'U' || c === 'D');

        corners.push({ perm, ori });
    }

    // Edges
    const edges = [];
    for (let i = 0; i < 12; i++) {
        const indices = EDGE_INDICES[i];
        const currentColors = indices.map(idx => stickers[idx]);
        const key = [...currentColors].sort().join('');
        const perm = SOLVED_EDGES[key];

        // Orientation: 0 if the cubie's primary color sits on the slot's primary facelet
        // (index 0 of EDGE_INDICES), 1 if flipped.
        // Primary color: U for U-layer edges, D for D-layer edges, F/B for middle-layer edges.
        const p = perm;
        const c0 = currentColors[0];
        let primaryColorOfCubie;
        if (p < 4) primaryColorOfCubie = 'U';
        else if (p < 8) primaryColorOfCubie = 'D';
        else primaryColorOfCubie = (p === 8 || p === 9) ? 'F' : 'B';
        // Only middle-layer edges are tracked for flips; U/D-layer edges count as oriented.
        const ori = (p >= 8 && c0 !== primaryColorOfCubie) ? 1 : 0;

        edges.push({ perm, ori });
    }

    return { corners, edges };
}
export function Scramble(state, moves = 20) {
    const possibleMoves = ['U', "U'", 'D', "D'", 'L', "L'", 'R', "R'", 'F', "F'", 'B', "B'"];
    let currentState = state;
    for (let i = 0; i < moves; i++) {
        const move = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
        currentState = currentState.applyMove(move);
    }
    return currentState;
}
