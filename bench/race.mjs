// Headless Heuristic Race: every heuristic solves the same seeded scrambles, in Node.
//
//   node bench/race.mjs [scrambles=10] [depths=3,5,7] [maxExpanded=1500]
//
// The OpenJev heuristic needs the local server (openjev/server.py); without it, it is skipped.
import { CubeState } from '../cubeLogic.js';
import {
    SolveAStarGenerator, heuristicMisplaced, heuristicMisplacedCubies, heuristicTwistFlip,
    heuristicManhattan, heuristicSinglePDB, heuristicDisjointPDB, generatePDBs,
} from '../solver.js';
import { heuristicOpenJev, checkOpenJev, openJevStats } from '../src/openjev.js';

const [nArg, depthArg, capArg] = process.argv.slice(2);
const N = Number(nArg || 10);
const DEPTHS = (depthArg || '3,5,7').split(',').map(Number);
const CAP = Number(capArg || 1500);
const MOVES = ['U', "U'", 'D', "D'", 'L', "L'", 'R', "R'", 'F', "F'", 'B', "B'"];

// Small seeded RNG (mulberry32), so every run uses the same scrambles
function rng(seed) {
    return () => {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function scramble(depth, rand) {
    const seq = [];
    while (seq.length < depth) {
        const m = MOVES[Math.floor(rand() * MOVES.length)];
        const last = seq[seq.length - 1];
        if (last && (m === last + "'" || m + "'" === last || m[0] === last[0])) continue; // no undo, no same face twice
        seq.push(m);
    }
    return seq;
}

async function solve(start, h) {
    const t0 = performance.now();
    let expanded = 0;
    for await (const ev of SolveAStarGenerator(start, h)) {
        if (ev.type === 'step' && ++expanded > CAP) return { ok: false, expanded, ms: performance.now() - t0 };
        if (ev.type === 'success') return { ok: true, expanded, moves: ev.path.length, ms: performance.now() - t0 };
        if (ev.type === 'failure') return { ok: false, expanded, ms: performance.now() - t0 };
    }
    return { ok: false, expanded, ms: performance.now() - t0 };
}

const heuristics = [
    ['Misplaced Stickers', heuristicMisplaced],
    ['Misplaced Cubies', heuristicMisplacedCubies],
    ['Twist & Flip', heuristicTwistFlip],
    ['3D Manhattan', heuristicManhattan],
    ['Single PDB', heuristicSinglePDB],
    ['Disjoint PDB', heuristicDisjointPDB],
];
const jev = await checkOpenJev();
if (jev.ok) heuristics.push([`OpenJev (${jev.device})`, heuristicOpenJev]);
else console.log('OpenJev server not reachable on 127.0.0.1:7474: skipped');

process.stdout.write('Building PDBs… ');
console.log = () => {}; // silence the PDB generation logs
await generatePDBs(() => {});
process.stdout.write('done\n');

const rand = rng(42);
const cases = DEPTHS.flatMap(d => Array.from({ length: N }, () => ({ depth: d, seq: scramble(d, rand) })));
const results = Object.fromEntries(heuristics.map(([name]) => [name, []]));

for (const [i, c] of cases.entries()) {
    let st = new CubeState();
    for (const m of c.seq) st = st.applyMove(m);
    for (const [name, h] of heuristics) results[name].push({ depth: c.depth, ...(await solve(st, h)) });
    process.stdout.write(`\rscramble ${i + 1}/${cases.length}`);
}
process.stdout.write('\n\n');

const pad = (s, n) => String(s).padStart(n);
for (const d of DEPTHS) {
    process.stdout.write(`== scramble depth ${d} (${N} cubes, cap ${CAP} expansions)\n`);
    process.stdout.write(`${'heuristic'.padEnd(22)}${pad('solved', 8)}${pad('avg nodes', 11)}${pad('avg moves', 11)}${pad('avg ms', 9)}\n`);
    for (const [name] of heuristics) {
        const rs = results[name].filter(r => r.depth === d);
        const ok = rs.filter(r => r.ok);
        const avg = (xs, f) => (xs.length ? Math.round(xs.reduce((a, r) => a + f(r), 0) / xs.length) : '—');
        process.stdout.write(`${name.padEnd(22)}${pad(`${ok.length}/${rs.length}`, 8)}${pad(avg(ok, r => r.expanded), 11)}`
            + `${pad(ok.length ? (ok.reduce((a, r) => a + r.moves, 0) / ok.length).toFixed(1) : '—', 11)}${pad(avg(rs, r => r.ms), 9)}\n`);
    }
    process.stdout.write('\n');
}
if (jev.ok) process.stdout.write(`OpenJev: ${openJevStats.calls} calls, ${openJevStats.pairs} states scored, `
    + `${openJevStats.cached} cache hits, ${Math.round(openJevStats.ms / Math.max(1, openJevStats.calls))} ms per call on the server\n`);
