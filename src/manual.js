// "Solve by the manual": OpenJev follows the beginner's layer-by-layer method.
//
// The manual (written here as code) knows the 7 stages and the algorithms of each stage. At every step the code
// lists the options the manual allows for the current stage (each algorithm, from each side, after each U setup),
// simulates them and drops those that would break a completed stage: "never undo what is done" is a rule of the
// manual itself. Then OpenJev reads the facts about every remaining option and picks the one it judges best.
// The code never ranks the options; the model does.
//
// Orientation: the first layer is built on D, the last layer is U, so the textbook algorithms apply unchanged.

import { CubeState, CORNER_INDICES, EDGE_INDICES } from '../cubeLogic.js';

const FACES = ['U', 'L', 'F', 'R', 'B', 'D'];
const homeFace = i => FACES[Math.floor(i / 9)];
const solved = (s, idx) => idx.every(i => s[i] === homeFace(i));

const CROSS = EDGE_INDICES.slice(4, 8);       // DR DF DL DB
const D_CORNERS = CORNER_INDICES.slice(4, 8); // DFR DLF DBL DRB
const MIDDLE = EDGE_INDICES.slice(8, 12);     // FR FL BL BR
const U_EDGES = EDGE_INDICES.slice(0, 4);
const U_CORNERS = CORNER_INDICES.slice(0, 4);
const EDGE_NAMES = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR'];

export function status(state) {
    const s = state.stickers;
    return {
        cross: CROSS.filter(e => solved(s, e)).length,
        dCorners: D_CORNERS.filter(c => solved(s, c)).length,
        middle: MIDDLE.filter(e => solved(s, e)).length,
        topCross: [1, 3, 5, 7].filter(i => s[i] === 'U').length,
        topFace: [0, 1, 2, 3, 5, 6, 7, 8].filter(i => s[i] === 'U').length,
        topCorners: U_CORNERS.filter(c => solved(s, c)).length,
        topEdges: U_EDGES.filter(e => solved(s, e)).length,
    };
}

export const STAGES = [
    { id: 1, key: 'cross', of: 4, name: 'bottom cross', unit: 'edges in place',
      goal: 'put the four bottom edges in place, forming a cross on the bottom face' },
    { id: 2, key: 'dCorners', of: 4, name: 'bottom corners', unit: 'corners in place',
      goal: 'put the four bottom corners in place, completing the first layer' },
    { id: 3, key: 'middle', of: 4, name: 'middle layer', unit: 'edges in place',
      goal: 'put the four middle-layer edges in place, completing the first two layers' },
    { id: 4, key: 'topCross', of: 4, name: 'top cross', unit: 'top edges facing up',
      goal: 'turn the four top edges so that their top colour faces up, forming a cross on the top face' },
    { id: 5, key: 'topFace', of: 8, name: 'top face', unit: 'top stickers facing up',
      goal: 'turn the top corners so that the whole top face shows one colour' },
    { id: 6, key: 'topCorners', of: 4, name: 'top corners', unit: 'corners in place',
      goal: 'move the four top corners to their correct positions' },
    { id: 7, key: 'topEdges', of: 4, name: 'top edges', unit: 'edges in place',
      goal: 'move the four top edges to their correct positions, solving the cube' },
];

export const currentStage = st => STAGES.find(stage => st[stage.key] < stage.of) || null;

// --- moves ---------------------------------------------------------------------------------------------------
// "R U2 R'" -> ['R', 'U', 'U', "R'"] (the cube model only knows quarter turns)
const parse = seq => seq.trim().split(/\s+/).flatMap(m => (m.endsWith('2') ? [m[0], m[0]] : [m]));
const apply = (state, moves) => moves.reduce((st, m) => st.applyMove(m), state);
const inverse = m => (m.endsWith("'") ? m[0] : m + "'");

// The same algorithm seen from another side: rotating the cube about the vertical axis relabels F/R/B/L
const SIDES = ['F', 'R', 'B', 'L'];
const SIDE_NAMES = { F: 'front', R: 'right', B: 'back', L: 'left' };
function fromSide(moves, side) {
    const i = SIDES.indexOf(side);
    const map = { U: 'U', D: 'D', F: SIDES[i], R: SIDES[(i + 1) % 4], B: SIDES[(i + 2) % 4], L: SIDES[(i + 3) % 4] };
    return moves.map(m => map[m[0]] + m.slice(1));
}

const SETUPS = [[], ['U'], ["U'"], ['U', 'U']];
const setupName = s => (s.length ? `after ${s.length === 2 ? 'U2' : s[0]}, ` : '');

// Algorithms of the manual, written for the front side
const ALGS = {
    corner: { seq: "R U R' U'", name: 'corner trigger' },
    edgeRight: { seq: "U R U' R' U' F' U F", name: 'middle edge to the right' },
    edgeLeft: { seq: "U' L' U L U F U' F'", name: 'middle edge to the left' },
    topCross: { seq: "F R U R' U' F'", name: 'top-cross algorithm' },
    sune: { seq: "R U R' U R U2 R'", name: 'Sune' },
    antiSune: { seq: "R U2 R' U' R U' R'", name: 'Anti-Sune' },
    // corner 3-cycles that keep the corners' orientation (A-perms): the top face stays one colour
    cornersA: { seq: "R' F R' B2 R F' R' B2 R2", name: 'corner cycle (clockwise)' },
    cornersB: { seq: "R2 B2 R F R' B2 R F' R", name: 'corner cycle (counter-clockwise)' },
    uPermA: { seq: "R U' R U R U R U' R' U' R2", name: 'edge cycle (clockwise)' },
    uPermB: { seq: "R2 U R U R' U' R' U' R' U R'", name: 'edge cycle (counter-clockwise)' },
};

function options(stageId, state) {
    const out = [];
    const add = (name, moves) => out.push({ name, moves });
    if (stageId === 1) {
        // No algorithm for the cross: the manual says "bring each edge home"; a short search finds how
        for (const [k, edge] of CROSS.entries()) {
            if (solved(state.stickers, edge)) continue;
            const keep = CROSS.filter(e => e !== edge && solved(state.stickers, e));
            const moves = shortestSequence(state, st => solved(st.stickers, edge) && keep.every(e => solved(st.stickers, e)), 7);
            if (moves) add(`bring the ${EDGE_NAMES[4 + k]} edge into the cross`, moves);
        }
        return out;
    }
    // alg from each side, after each U setup (setups = [[]] when the top layer must not move)
    const perSide = (alg, sides = SIDES, reps = [1], setups = SETUPS) => {
        for (const side of sides) for (const setup of setups) for (const r of reps) {
            const body = Array.from({ length: r }, () => fromSide(parse(ALGS[alg].seq), side)).flat();
            add(`${setupName(setup)}${ALGS[alg].name}${r > 1 ? ` ×${r}` : ''} on the ${SIDE_NAMES[side]} side`, [...setup, ...body]);
        }
    };
    if (stageId === 2) perSide('corner', SIDES, [1, 2, 3, 4, 5]);
    if (stageId === 3) { perSide('edgeRight'); perSide('edgeLeft'); }
    if (stageId === 4) perSide('topCross', ['F']);
    if (stageId >= 5) {
        // Last layer: some cases need two algorithms in a row, so the manual also lists every pair
        if (stageId === 5) { perSide('sune', ['F']); perSide('antiSune', ['F']); }
        if (stageId === 6) {
            for (const setup of SETUPS.slice(1)) add(`turn the top layer (${setup.length === 2 ? 'U2' : setup[0]})`, setup);
            perSide('cornersA', SIDES, [1], [[]]); perSide('cornersB', SIDES, [1], [[]]);
        }
        if (stageId === 7) { perSide('uPermA', SIDES, [1], [[]]); perSide('uPermB', SIDES, [1], [[]]); }
        const singles = [...out];
        for (const a of singles) for (const b of singles) add(`${a.name}, then ${b.name}`, [...a.moves, ...b.moves]);
    }
    return out;
}

// Iterative deepening over quarter turns, used only for the cross
function shortestSequence(start, goal, maxDepth) {
    const MOVES = ['U', "U'", 'D', "D'", 'L', "L'", 'R', "R'", 'F', "F'", 'B', "B'"];
    const path = [];
    const dfs = (st, depth) => {
        if (goal(st)) return true;
        if (depth === 0) return false;
        for (const m of MOVES) {
            const last = path[path.length - 1];
            if (last && (m === inverse(last))) continue;
            if (path.length >= 2 && m === last && m === path[path.length - 2]) continue; // three equal = one inverse
            path.push(m);
            if (dfs(st.applyMove(m), depth - 1)) return true;
            path.pop();
        }
        return false;
    };
    for (let d = 0; d <= maxDepth; d++) if (dfs(start, d)) return [...path];
    return null;
}

// --- what OpenJev reads ----------------------------------------------------------------------------------------
function describeStatus(st) {
    return STAGES.map(stage => `${stage.name} ${st[stage.key]}/${stage.of}`).join(', ');
}

export function premise(state) {
    const st = status(state);
    const stage = currentStage(st);
    const done = STAGES.filter(s => s.id < stage.id).map(s => s.name);
    return [
        "Rubik's Cube, solved with the layer-by-layer method in 7 stages.",
        `Completed stages: ${done.length ? done.join(', ') : 'none'}.`,
        `Current stage ${stage.id} of 7, ${stage.name}: ${stage.goal}.`,
        `Progress on this stage: ${st[stage.key]} of ${stage.of} ${stage.unit}.`,
        'The best step is the one that puts the most pieces in place on the current stage. '
        + 'The number of moves only matters between steps with the same progress.',
    ].join(' ');
}

// The effect comes first, the name of the algorithm last: the small model weighs the beginning most
function hypothesis(option, before, after, stage) {
    const b = before[stage.key], a = after[stage.key];
    let effect;
    if (a === stage.of) effect = `This step completes the ${stage.name}: ${a} of ${stage.of} ${stage.unit}.`;
    else if (a > b) effect = `This step puts ${a - b} more in place: the ${stage.name} goes from ${b} to ${a} of ${stage.of} ${stage.unit}.`;
    else effect = `This step puts nothing more in place: the ${stage.name} stays at ${a} of ${stage.of} ${stage.unit}.`;
    return `${effect} It is the best next step. (${option.name}, ${option.moves.length} moves)`;
}

// --- the solver ------------------------------------------------------------------------------------------------
// chooser(premise, hypotheses) -> Promise<number[]> (one score per hypothesis, higher is better)
export async function* solveByManual(start, chooser, { maxSteps = 80 } = {}) {
    let state = start;
    const seen = new Set([state.stickers.join('')]);
    const allMoves = [];
    for (let step = 1; step <= maxSteps; step++) {
        const before = status(state);
        const stage = currentStage(before);
        if (!stage) { yield { type: 'success', moves: allMoves, steps: step - 1 }; return; }

        const candidates = [];
        const keys = new Set();
        for (const opt of options(stage.id, state)) {
            const next = apply(state, opt.moves);
            const key = next.stickers.join('');
            const after = status(next);
            // Rules of the manual: never break a completed stage, never undo progress on the current one
            const breaks = STAGES.some(s => s.id < stage.id && after[s.key] < s.of) || after[stage.key] < before[stage.key];
            if (breaks || keys.has(key) || seen.has(key)) continue;
            keys.add(key);
            candidates.push({ ...opt, next, after, hypothesis: hypothesis(opt, before, after, stage) });
        }
        if (!candidates.length) { yield { type: 'failure', reason: `no option left in stage ${stage.id}`, moves: allMoves }; return; }

        const text = premise(state);
        const scores = await chooser(text, candidates.map(c => c.hypothesis), candidates);
        candidates.forEach((c, i) => { c.score = scores[i]; });
        const ranked = [...candidates].sort((a, b) => b.score - a.score);
        const chosen = ranked[0];

        state = chosen.next;
        seen.add(state.stickers.join(''));
        allMoves.push(...chosen.moves);
        yield { type: 'step', step, stage, premise: text, before, chosen, ranked, state, totalMoves: allMoves.length };
    }
    yield { type: 'failure', reason: `step limit (${maxSteps}) reached`, moves: allMoves };
}

// OpenJev as the chooser: P(entailment) of each hypothesis given the premise
export function openJevChooser(url = 'http://127.0.0.1:7474') {
    return async (prem, hyps) => {
        const res = await fetch(`${url}/score`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pairs: hyps.map(h => [prem, h]) }),
        });
        if (!res.ok) throw new Error(`OpenJev server: HTTP ${res.status}`);
        return (await res.json()).probs.map(p => p[1]);
    };
}

// Reference chooser without a model (for tests): most progress first, then fewest moves
export const greedyChooser = async (prem, hyps, candidates) =>
    candidates.map(c => STAGES.reduce((a, s) => a + c.after[s.key] * 10 ** (2 * (7 - s.id)), 0) - c.moves.length / 1000);

export const _test = { parse, apply, fromSide, ALGS, options };
