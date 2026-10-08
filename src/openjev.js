// OpenJev heuristic: an NLI model judges how close a cube is to solved, from facts computed here.
//
// OpenJev (https://huggingface.co/AlexWortega/openjev) knows nothing about Rubik's Cubes. For every state we
// write a plain-English premise with objective facts (solved cubies, complete faces, stickers at home) and ask
// how strongly it entails a graded ladder of statements, from "at least half of the cubies are solved" to
// "the cube is solved". The heuristic is
//     h(n) = WEIGHT * (1 - mean P(entailment) over the ladder)
// The facts only describe the cube, they never judge it: judging is the model's job.
// It is not admissible: A* becomes a best-first search guided by the model's judgement.
// The model runs in a local Python server (openjev/server.py); without it this heuristic is unavailable.

import { CORNER_INDICES, EDGE_INDICES } from '../cubeLogic.js';

export const OPENJEV_URL = 'http://127.0.0.1:7474';
export const WEIGHT = 10;
// Chosen by measuring how well each wording tracks the scramble depth (Spearman: -0.71, -0.62, -0.40);
// vaguer wordings like "close to being solved" stay flat.
export const HYPOTHESES = [
    'At least half of the cubies are solved.',
    'Most of the cube is solved.',
    'The cube is solved.',
];

const FACES = ['U', 'L', 'F', 'R', 'B', 'D'];
const FACE_NAMES = { U: 'up', L: 'left', F: 'front', R: 'right', B: 'back', D: 'down' };
const homeFace = i => FACES[Math.floor(i / 9)];

const isCubieSolved = (s, indices) => indices.every(i => s[i] === homeFace(i));
// Same stickers as its home slot, but not in the solved position: right place, wrong orientation
const isCubieTwisted = (s, indices) =>
    !isCubieSolved(s, indices) &&
    [...indices.map(i => s[i])].sort().join('') === [...indices.map(homeFace)].sort().join('');

export function describeState(state) {
    const s = state.stickers;
    const cornersSolved = CORNER_INDICES.filter(c => isCubieSolved(s, c)).length;
    const edgesSolved = EDGE_INDICES.filter(e => isCubieSolved(s, e)).length;
    const twisted = [...CORNER_INDICES, ...EDGE_INDICES].filter(c => isCubieTwisted(s, c)).length;
    const completeFaces = FACES.filter((f, k) => s.slice(k * 9, k * 9 + 9).every(c => c === f));
    const stickersHome = s.filter((c, i) => c === homeFace(i)).length;
    const solved = cornersSolved + edgesSolved;

    const facts = [
        "Rubik's Cube position.",
        `Solved cubies: ${solved} of 20 (${cornersSolved} of 8 corners, ${edgesSolved} of 12 edges).`,
        `Cubies in the right place but twisted or flipped: ${twisted}.`,
        `Complete faces: ${completeFaces.length} of 6${completeFaces.length ? ` (${completeFaces.map(f => FACE_NAMES[f]).join(', ')})` : ''}.`,
        `Stickers on their own face: ${stickersHome} of 54.`,
    ];
    return facts.join(' ');
}

let status = null; // null = not checked yet; {ok, model, device} or {ok: false}

export async function checkOpenJev(timeoutMs = 1500) {
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);
        const res = await fetch(`${OPENJEV_URL}/health`, { signal: ctrl.signal });
        clearTimeout(timer);
        status = res.ok ? await res.json() : { ok: false };
    } catch {
        status = { ok: false };
    }
    return status;
}

export const openJevStatus = () => status;

const cache = new Map();   // state key -> h
const verdicts = new Map(); // state key -> what OpenJev read and judged, for the "Why?" panel
export const openJevStats = { calls: 0, pairs: 0, cached: 0, ms: 0 };

// Entailment of every hypothesis of the ladder, for each premise: [[p1, p2, p3], ...]
async function entailment(premises) {
    const res = await fetch(`${OPENJEV_URL}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairs: premises.flatMap(p => HYPOTHESES.map(h => [p, h])) }),
    });
    if (!res.ok) throw new Error(`OpenJev server: HTTP ${res.status}`);
    const { probs, ms } = await res.json();
    openJevStats.calls++;
    openJevStats.pairs += premises.length;
    openJevStats.ms += ms;
    const k = HYPOTHESES.length;
    return premises.map((_, i) => probs.slice(i * k, i * k + k).map(p => p[1])); // p = [con, ent, neu]
}

// Batch heuristic used by SolveAStarGenerator: one HTTP call scores all the children of a node.
export async function heuristicOpenJevBatch(states) {
    const keys = states.map(st => st.stickers.join(''));
    const todo = [...new Set(keys.filter(k => !cache.has(k)))];
    openJevStats.cached += keys.length - todo.length;
    if (todo.length) {
        const byKey = new Map(states.map((st, i) => [keys[i], st]));
        const premises = todo.map(k => describeState(byKey.get(k)));
        const probs = await entailment(premises);
        todo.forEach((k, i) => {
            const mean = probs[i].reduce((a, b) => a + b, 0) / probs[i].length;
            const h = byKey.get(k).isSolved() ? 0 : Math.round(WEIGHT * (1 - mean) * 100) / 100;
            cache.set(k, h);
            verdicts.set(k, { premise: premises[i], probs: probs[i], mean, h });
        });
    }
    return keys.map(k => cache.get(k));
}

// What OpenJev read (premise) and judged (one probability per hypothesis) for a state, or null
export function openJevVerdict(state) {
    return verdicts.get(state.stickers.join('')) || null;
}

// Marker so the A* generator knows to call the async batch version
export const heuristicOpenJev = Object.assign(
    () => { throw new Error('heuristicOpenJev is async: use heuristicOpenJevBatch'); },
    { batch: heuristicOpenJevBatch, label: 'OpenJev' },
);
