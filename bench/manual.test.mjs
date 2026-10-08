// Sanity checks for the layer-by-layer manual (no model needed): node bench/manual.test.mjs
import { CubeState } from '../cubeLogic.js';
import { status, STAGES, solveByManual, greedyChooser, _test } from '../src/manual.js';
const { parse, apply, fromSide, ALGS } = _test;
const solvedKey = new CubeState().stickers.join('');
let fail = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) fail++; };

for (const [k, a] of Object.entries(ALGS)) {
    let st = new CubeState(), n = 0;
    do { st = apply(st, parse(a.seq)); n++; } while (st.stickers.join('') !== solvedKey && n < 200);
    check(n < 200, `${k} returns to solved after ${n} repetitions`);
}
const f2l = st => { const s = status(st); return s.cross === 4 && s.dCorners === 4 && s.middle === 4; };
for (const k of ['topCross', 'sune', 'antiSune', 'cornersA', 'cornersB', 'uPermA', 'uPermB'])
    for (const side of ['F', 'R', 'B', 'L'])
        check(f2l(apply(new CubeState(), fromSide(parse(ALGS[k].seq), side))), `${k} from ${side} keeps the first two layers`);
for (const k of ['cornersA', 'cornersB', 'uPermA', 'uPermB'])
    check(status(apply(new CubeState(), parse(ALGS[k].seq))).topFace === 8, `${k} keeps the top face one colour`);
for (const k of ['edgeRight', 'edgeLeft', 'corner']) {
    const s = status(apply(new CubeState(), parse(ALGS[k].seq)));
    check(s.cross === 4, `${k} keeps the bottom cross (${JSON.stringify(s)})`);
}

// Greedy chooser on random scrambles: the manual must always be completable
const MOVES = ['U', "U'", 'D', "D'", 'L', "L'", 'R', "R'", 'F', "F'", 'B', "B'"];
let seed = 3; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const N = Number(process.argv[2] || 30);
let ok = 0, totalMoves = 0, totalSteps = 0;
const t0 = performance.now();
for (let i = 0; i < N; i++) {
    let st = new CubeState();
    for (let k = 0; k < 25; k++) st = st.applyMove(MOVES[Math.floor(rand() * 12)]);
    let last;
    for await (const ev of solveByManual(st, greedyChooser)) last = ev;
    if (last.type === 'success') {
        const end = apply(st, last.moves);
        if (end.isSolved()) { ok++; totalMoves += last.moves.length; totalSteps += last.steps; }
        else console.log('  wrong final state!');
    } else console.log(`  cube ${i + 1}: ${last.reason}`, JSON.stringify(status(apply(st, last.moves))));
}
check(ok === N, `greedy manual solves ${ok}/${N} random cubes, avg ${Math.round(totalMoves / Math.max(ok, 1))} moves, `
    + `${(totalSteps / Math.max(ok, 1)).toFixed(1)} steps, ${Math.round((performance.now() - t0) / N)} ms per cube`);
process.exit(fail ? 1 : 0);
