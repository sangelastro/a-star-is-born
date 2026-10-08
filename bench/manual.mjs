// OpenJev follows the layer-by-layer manual on random cubes: node bench/manual.mjs [cubes=3]
// Needs the local OpenJev server (openjev/server.py).
import { CubeState } from '../cubeLogic.js';
import { solveByManual, openJevChooser, status } from '../src/manual.js';

const MOVES = ['U', "U'", 'D', "D'", 'L', "L'", 'R', "R'", 'F', "F'", 'B', "B'"];
let seed = 9; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const N = Number(process.argv[2] || 3);
const chooser = openJevChooser();
const rows = [];
for (let i = 0; i < N; i++) {
    let st = new CubeState();
    for (let k = 0; k < 25; k++) st = st.applyMove(MOVES[Math.floor(rand() * 12)]);
    const t0 = performance.now();
    let last, steps = 0, top1 = 0, options = 0;
    for await (const ev of solveByManual(st, chooser)) {
        last = ev;
        if (ev.type === 'step') {
            steps++; options += ev.ranked.length;
            // did OpenJev pick the option with the most progress on the current stage?
            const best = Math.max(...ev.ranked.map(c => c.after[ev.stage.key]));
            if (ev.chosen.after[ev.stage.key] === best) top1++;
            process.stdout.write(`\rcube ${i + 1}: step ${steps}, stage ${ev.stage.id}, ${ev.ranked.length} options   `);
        }
    }
    const ok = last.type === 'success';
    rows.push({ ok, steps, moves: last.moves.length, top1, options, s: (performance.now() - t0) / 1000, why: last.reason });
    process.stdout.write(`\rcube ${i + 1}: ${ok ? 'SOLVED' : 'failed (' + last.reason + ')'} in ${steps} steps, `
        + `${last.moves.length} moves, ${Math.round((performance.now() - t0) / 1000)} s; picked the most progress `
        + `${top1}/${steps} times, avg ${Math.round(options / Math.max(steps, 1))} options per step\n`);
    if (!ok) console.log('  stuck at', JSON.stringify(status(st.constructor ? last.moves.reduce((a, m) => a.applyMove(m), st) : st)));
}
const solved = rows.filter(r => r.ok);
console.log(`\nOpenJev + manual: ${solved.length}/${N} solved, avg ${Math.round(solved.reduce((a, r) => a + r.moves, 0) / Math.max(1, solved.length))} moves`);
