import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createCube, updateCubeVisuals } from './cube.js';
import { CubeState, Scramble } from './cubeLogic.js';
import { SolveAStarGenerator, heuristicMisplaced, heuristicManhattan, heuristicMisplacedCubies, heuristicTwistFlip, heuristicSinglePDB, heuristicDisjointPDB, generatePDBs } from './solver.js';
import * as d3 from 'd3';

// --- Scene Setup (Three.js) ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222222);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(5, 5, 7);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 10, 10);
scene.add(directionalLight);

const cubeGroup = new THREE.Group();
scene.add(cubeGroup);

// --- State ---
let cubeState = new CubeState();
let solverGenerator = null;
let isSolving = false;
let autoPlayInterval = null;
let currentScrambleMoves = []; // Store current scramble for replay

let solutionHistoryData = []; // Store data for CSV: { scramble: [], solution: [] }

// Manual Coloring State
let isManualMode = false;
let selectedColor = 'U'; // Default to White
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Tree Data
let treeNodes = [];
let treeLinks = [];
let treeSvg, treeG, treeSimulation, treeZoom;

createCube(cubeGroup);
updateCubeVisuals(cubeGroup, cubeState);

// --- UI Elements ---
const scrambleBtn = document.getElementById('scramble-btn');
const solveBtn = document.getElementById('solve-btn');
const stepBtn = document.getElementById('step-btn');
const playBtn = document.getElementById('play-btn');
const resetBtn = document.getElementById('reset-btn');
const difficultySelect = document.getElementById('difficulty');
const scrambleFromSolvedCheckbox = document.getElementById('scramble-from-solved');
const heuristicSelect = document.getElementById('heuristic-select');
const heuristicExplanationEl = document.getElementById('heuristic-explanation');
const explanationEl = document.getElementById('explanation-text');
const gScoreEl = document.getElementById('g-score');
const hScoreEl = document.getElementById('h-score');
const fScoreEl = document.getElementById('f-score');
const openSetListEl = document.getElementById('open-set-list');
const historyListEl = document.getElementById('history-list');
const treeContainer = document.getElementById('tree-container');
const expandTreeBtn = document.getElementById('expand-tree-btn');
const manualScrambleInput = document.getElementById('manual-scramble');
const applyScrambleBtn = document.getElementById('apply-scramble-btn');
const whyPanel = document.getElementById('why-panel');
const whyText = document.getElementById('why-text');
const exportCsvBtn = document.getElementById('export-csv-btn');
const zoomInBtn = document.getElementById('zoom-in-btn');
const zoomOutBtn = document.getElementById('zoom-out-btn');
const zoomResetBtn = document.getElementById('zoom-reset-btn');

// Manual Color UI
const toggleManualModeBtn = document.getElementById('toggle-manual-mode-btn');
const colorPalette = document.getElementById('color-palette');
const colorSwatches = document.querySelectorAll('.color-swatch');
const validateStateBtn = document.getElementById('validate-state-btn');
const manualStatusEl = document.getElementById('manual-status');

// Modal Elements
const modal = document.getElementById('heuristic-modal');
const btnOpenModal = document.getElementById('heuristic-info-btn');
const spanCloseModal = document.getElementById('close-modal');

// --- Heuristic Info ---
const heuristicInfo = {
    'misplaced': "<strong>Misplaced Stickers:</strong> Imagine peeling off the wrong stickers and sticking them back correctly. This counts how many stickers you'd need to move.",
    'manhattan': "<strong>Manhattan Distance:</strong> Like a taxi driver navigating city blocks. It calculates the total distance every piece has to travel to get home. Much smarter!",
    'misplaced-cubies': "<strong>Misplaced Cubies:</strong> Counts corners and edges that are in the wrong position. Better than stickers because it respects the piece structure.",
    'twist-flip': "<strong>Twist & Flip:</strong> Counts how many pieces are in the right spot but rotated wrong. Very weak on its own.",
    'single-pdb': "<strong>Single PDB (Corners):</strong> Uses a pre-computed database of all 88 million corner states (or a subset) to know the EXACT moves needed to solve corners. Very fast and strong.",
    'disjoint-pdb': "<strong>Disjoint PDB:</strong> Combines Corner PDB with an Edge PDB. It knows how to solve corners AND edges simultaneously. The strongest heuristic here."
};

// PDB UI
const pdbControls = document.getElementById('pdb-controls');
const generatePdbBtn = document.getElementById('generate-pdb-btn');
const pdbProgress = document.getElementById('pdb-progress');
const pdbStatus = document.getElementById('pdb-status');
let pdbsGenerated = false;

// --- Event Listeners ---

// Modal Logic
btnOpenModal.onclick = () => modal.classList.remove('hidden');
spanCloseModal.onclick = () => modal.classList.add('hidden');
window.onclick = (event) => {
    if (event.target == modal) modal.classList.add('hidden');
};

// Expand Tree Logic
expandTreeBtn.addEventListener('click', () => {
    treeContainer.classList.toggle('expanded');
    setTimeout(() => {
        const width = treeContainer.clientWidth;
        const height = treeContainer.clientHeight;
        if (treeSvg) {
            treeSvg.attr("width", width).attr("height", height);
            treeSimulation.force("center", d3.forceCenter(width / 2, height / 2));
            treeSimulation.alpha(1).restart();
        }
    }, 350);
});

// Zoom Controls
zoomInBtn.addEventListener('click', () => {
    if (treeSvg) treeSvg.transition().call(treeZoom.scaleBy, 1.2);
});
zoomOutBtn.addEventListener('click', () => {
    if (treeSvg) treeSvg.transition().call(treeZoom.scaleBy, 0.8);
});
zoomResetBtn.addEventListener('click', () => {
    if (treeSvg) treeSvg.transition().call(treeZoom.transform, d3.zoomIdentity);
});

// CSV Export
exportCsvBtn.addEventListener('click', () => {
    if (solutionHistoryData.length === 0) {
        alert("No history to export yet!");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Initial_Scramble,Solution_Path,Solution_Length\n";

    solutionHistoryData.forEach(row => {
        csvContent += `${row.scramble.join(' ')},${row.solution.join(' ')},${row.solution.length}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "rubiks_solutions.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// --- Manual Coloring Logic ---

toggleManualModeBtn.addEventListener('click', () => {
    isManualMode = !isManualMode;
    toggleManualModeBtn.classList.toggle('active');
    toggleManualModeBtn.textContent = isManualMode ? "Exit Manual Color Mode" : "Enter Manual Color Mode";

    if (isManualMode) {
        colorPalette.classList.remove('hidden');
        resetSolver(); // Stop any running solver
        orbitControls.enabled = true; // Keep rotation enabled
        manualStatusEl.textContent = "Select a color and click on the cube stickers.";
    } else {
        colorPalette.classList.add('hidden');
        manualStatusEl.textContent = "";
    }
});

colorSwatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
        // Update selection UI
        colorSwatches.forEach(s => s.classList.remove('selected'));
        swatch.classList.add('selected');

        // Update state
        selectedColor = swatch.getAttribute('data-color');
    });
});

// Raycasting for clicking on cube
window.addEventListener('pointerdown', (event) => {
    if (!isManualMode) return;

    // Calculate mouse position in normalized device coordinates
    // (-1 to +1) for both components
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(cubeGroup.children);

    if (intersects.length > 0) {
        // We hit a cubie
        const intersect = intersects[0];
        const mesh = intersect.object;
        const faceIndex = intersect.face.materialIndex;

        // Check if we have metadata for this face
        if (mesh.userData.stickerMap && mesh.userData.stickerMap[faceIndex] !== undefined) {
            const stickerIdx = mesh.userData.stickerMap[faceIndex];

            // Prevent changing centers
            const centers = [4, 13, 22, 31, 40, 49];
            if (centers.includes(stickerIdx)) {
                manualStatusEl.textContent = "Cannot change center stickers! They define the face orientation.";
                manualStatusEl.style.color = "#ef4444";
                setTimeout(() => manualStatusEl.style.color = "#aaa", 2000);
                return;
            }

            // Apply color
            cubeState.stickers[stickerIdx] = selectedColor;
            updateCubeVisuals(cubeGroup, cubeState);

            // Prevent orbit controls from rotating if we clicked a sticker? 
            // Actually, usually we want to click without rotating.
            // But OrbitControls handles drag vs click well.
        }
    }
});

validateStateBtn.addEventListener('click', () => {
    // Count colors
    const counts = { U: 0, D: 0, F: 0, B: 0, L: 0, R: 0 };
    cubeState.stickers.forEach(c => counts[c]++);

    const invalid = Object.entries(counts).filter(([k, v]) => v !== 9);

    if (invalid.length > 0) {
        const details = invalid.map(([k, v]) => `${k}: ${v}`).join(', ');
        alert(`Invalid Cube State! Each color must appear exactly 9 times.\nCurrent counts: ${details}`);
        return;
    }

    // Reset solver and ready to solve
    resetSolver();
    explanationEl.textContent = "Manual configuration applied. Ready to solve!";
    updateStats(0, 0);
    initTree();

    // Exit manual mode
    isManualMode = false;
    toggleManualModeBtn.classList.remove('active');
    toggleManualModeBtn.textContent = "Enter Manual Color Mode";
    colorPalette.classList.add('hidden');
});


// Manual Scramble Logic
applyScrambleBtn.addEventListener('click', () => {
    const movesStr = manualScrambleInput.value.trim().toUpperCase();
    if (!movesStr) return;

    const moves = movesStr.split(/\s+/);
    const validMoves = ['U', "U'", 'D', "D'", 'L', "L'", 'R', "R'", 'F', "F'", 'B', "B'"];

    const isValid = moves.every(m => validMoves.includes(m));
    if (!isValid) {
        alert("Invalid moves! Use U, U', D, D', etc.");
        return;
    }

    resetSolver();
    cubeState = new CubeState();
    moves.forEach(m => cubeState = cubeState.applyMove(m));
    updateCubeVisuals(cubeGroup, cubeState);

    currentScrambleMoves = moves;
    explanationEl.textContent = `Custom scramble applied: ${movesStr}`;
    updateStats(0, 0);
    initTree();
});

heuristicSelect.addEventListener('change', () => {
    const val = heuristicSelect.value;
    heuristicExplanationEl.innerHTML = `<small>${heuristicInfo[val]}</small>`;

    // Show PDB controls if needed
    if (val === 'single-pdb' || val === 'disjoint-pdb') {
        pdbControls.classList.remove('hidden');
        if (!pdbsGenerated) {
            pdbStatus.textContent = "PDBs not generated. Click 'Generate' to build them.";
            pdbStatus.style.color = "#ef4444";
        }
    } else {
        pdbControls.classList.add('hidden');
    }

    if (isSolving) resetSolver();
});

let pdbGenerationPromise = null;

// Builds the pattern databases once; concurrent callers share the same run.
// onStatus (optional) receives progress text, e.g. "Corner Perm: 1000/40320".
function ensurePDBs(onStatus) {
    if (pdbsGenerated) return Promise.resolve(true);
    if (pdbGenerationPromise) return pdbGenerationPromise;

    generatePdbBtn.disabled = true;
    generatePdbBtn.textContent = "Generating...";
    pdbStatus.textContent = "Generating Pattern Databases... This may take a few seconds.";
    pdbStatus.style.color = "#aaa";

    pdbGenerationPromise = generatePDBs((msg, total) => {
        if (typeof msg === 'string') {
            pdbStatus.textContent = msg;
            if (onStatus) onStatus(msg);
        }
        if (typeof msg === 'number' && total) {
            const pct = Math.round((msg / total) * 100);
            pdbProgress.style.width = `${pct}%`;
        }
    }).then(() => {
        pdbsGenerated = true;
        generatePdbBtn.textContent = "Generated";
        pdbStatus.textContent = "PDBs Ready!";
        pdbStatus.style.color = "#4ade80";
        pdbProgress.style.width = "100%";
        return true;
    }).catch((e) => {
        console.error(e);
        pdbStatus.textContent = "Error generating PDBs.";
        pdbStatus.style.color = "#ef4444";
        generatePdbBtn.disabled = false;
        generatePdbBtn.textContent = "Retry";
        return false;
    }).finally(() => {
        pdbGenerationPromise = null;
    });

    return pdbGenerationPromise;
}

generatePdbBtn.addEventListener('click', () => ensurePDBs());

scrambleBtn.addEventListener('click', () => {
    resetSolver();
    const depth = parseInt(difficultySelect.value);

    const moves = [];
    const possibleMoves = ['U', "U'", 'D', "D'", 'L', "L'", 'R', "R'", 'F', "F'", 'B', "B'"];
    const fromSolved = scrambleFromSolvedCheckbox.checked;
    if (fromSolved) cubeState = new CubeState();

    for (let i = 0; i < depth; i++) {
        const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
        moves.push(randomMove);
        cubeState = cubeState.applyMove(randomMove);
    }

    // When stacking scrambles, keep the full sequence so replays start from the solved cube
    currentScrambleMoves = fromSolved ? moves : [...currentScrambleMoves, ...moves];
    updateCubeVisuals(cubeGroup, cubeState);
    explanationEl.textContent = fromSolved
        ? `Cube scrambled with ${depth} moves (${moves.join(' ')}). Ready to explain A*!`
        : `Added ${depth} moves (${moves.join(' ')}). Total scramble: ${currentScrambleMoves.length} moves. Ready to explain A*!`;
    updateStats(0, 0);
    initTree();
});

solveBtn.addEventListener('click', () => {
    if (isSolving) return;

    isSolving = true;
    scrambleBtn.disabled = true;
    solveBtn.disabled = true;
    stepBtn.disabled = false;
    playBtn.disabled = false;
    difficultySelect.disabled = true;
    heuristicSelect.disabled = true;
    applyScrambleBtn.disabled = true;

    let selectedHeuristic;
    switch (heuristicSelect.value) {
        case 'manhattan': selectedHeuristic = heuristicManhattan; break;
        case 'misplaced-cubies': selectedHeuristic = heuristicMisplacedCubies; break;
        case 'twist-flip': selectedHeuristic = heuristicTwistFlip; break;
        case 'single-pdb': selectedHeuristic = heuristicSinglePDB; break;
        case 'disjoint-pdb': selectedHeuristic = heuristicDisjointPDB; break;
        default: selectedHeuristic = heuristicMisplaced;
    }

    if ((heuristicSelect.value === 'single-pdb' || heuristicSelect.value === 'disjoint-pdb') && !pdbsGenerated) {
        alert("Please generate Pattern Databases first!");
        isSolving = false;
        scrambleBtn.disabled = false;
        solveBtn.disabled = false;
        stepBtn.disabled = true;
        playBtn.disabled = true;
        difficultySelect.disabled = false;
        heuristicSelect.disabled = false;
        applyScrambleBtn.disabled = false;
        return;
    }

    solverGenerator = SolveAStarGenerator(cubeState, selectedHeuristic);
    explanationEl.textContent = "A* Solver initialized. Click 'Next Step' or 'Auto Play'.";
    whyPanel.style.display = 'block';

    initTree();
    stepSolver();
});

stepBtn.addEventListener('click', () => {
    stepSolver();
});

playBtn.addEventListener('click', () => {
    if (autoPlayInterval) {
        stopAutoPlay();
    } else {
        startAutoPlay();
    }
});

resetBtn.addEventListener('click', () => {
    resetSolver();
    cubeState = new CubeState();
    updateCubeVisuals(cubeGroup, cubeState);
    explanationEl.textContent = "Session reset. Cube is solved.";
    updateStats(0, 0);
    initTree();
    currentScrambleMoves = [];
});

const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
        const { width, height } = entry.contentRect;
        if (treeSvg) {
            // Update SVG dimensions
            treeSvg.attr("width", width).attr("height", height);

            // Update Force Center
            treeSimulation.force("center", d3.forceCenter(width / 2, height / 2));

            // Re-heat simulation to move nodes to new center
            treeSimulation.alpha(0.3).restart();
        }
    }
});
resizeObserver.observe(treeContainer);


// --- Heuristic Race ---

const RACE_HEURISTICS = [
    { name: 'Misplaced Stickers', fn: heuristicMisplaced },
    { name: 'Misplaced Cubies', fn: heuristicMisplacedCubies },
    { name: 'Twist & Flip', fn: heuristicTwistFlip },
    { name: '3D Manhattan', fn: heuristicManhattan },
    { name: 'Single PDB', fn: heuristicSinglePDB },
    { name: 'Disjoint PDB', fn: heuristicDisjointPDB }
];

const raceBtn = document.getElementById('race-btn');
const raceModal = document.getElementById('race-modal');
const raceRowsEl = document.getElementById('race-rows');
const raceScrambleEl = document.getElementById('race-scramble');
const raceStatusEl = document.getElementById('race-status');
const raceSummaryEl = document.getElementById('race-summary');
let isRacing = false;
let raceCancelled = false;

document.getElementById('close-race-modal').onclick = closeRaceModal;
raceModal.addEventListener('click', (event) => {
    if (event.target === raceModal) closeRaceModal();
});

function closeRaceModal() {
    raceCancelled = true;
    raceModal.classList.add('hidden');
}

function setRaceControlsDisabled(disabled) {
    [raceBtn, scrambleBtn, solveBtn, applyScrambleBtn, toggleManualModeBtn].forEach(b => b.disabled = disabled);
}

raceBtn.addEventListener('click', async () => {
    if (isRacing) return;
    if (cubeState.isSolved()) {
        alert("The cube is already solved! Scramble it first, then start the race.");
        return;
    }

    resetSolver();
    updateCubeVisuals(cubeGroup, cubeState);
    isRacing = true;
    raceCancelled = false;
    setRaceControlsDisabled(true);

    const startState = cubeState.clone();
    raceScrambleEl.textContent = currentScrambleMoves.length > 0
        ? `Scramble: ${currentScrambleMoves.join(' ')}`
        : 'Scramble: custom cube (manual colors)';
    raceSummaryEl.textContent = '';
    raceModal.classList.remove('hidden');

    const rows = RACE_HEURISTICS.map(h => ({ ...h, status: 'waiting', expanded: 0, moves: null, ms: 0 }));
    renderRaceRows(rows);

    raceStatusEl.textContent = pdbsGenerated ? '' : 'Building pattern databases (one-time, a few seconds)...';
    const pdbReady = await ensurePDBs(msg => { raceStatusEl.textContent = `Building pattern databases: ${msg}`; });
    if (!pdbReady) {
        rows.filter(r => r.fn === heuristicSinglePDB || r.fn === heuristicDisjointPDB)
            .forEach(r => { r.status = 'skipped'; });
    }

    for (const row of rows) {
        if (raceCancelled) break;
        if (row.status === 'skipped') continue;
        raceStatusEl.textContent = `Racing: ${row.name}...`;
        row.status = 'running';
        renderRaceRows(rows);
        const ok = await raceOne(row, startState, () => renderRaceRows(rows));
        if (!ok) break;
        renderRaceRows(rows);
    }

    isRacing = false;
    setRaceControlsDisabled(false);
    if (raceCancelled) return;

    raceStatusEl.textContent = '';
    rows.sort(compareRaceRows);
    renderRaceRows(rows, true);
    raceSummaryEl.innerHTML = raceSummary(rows);
});

// Runs A* with one heuristic; updates row in place. Returns false if the race was cancelled.
async function raceOne(row, startState, onTick) {
    const generator = SolveAStarGenerator(startState, row.fn);
    while (true) {
        const t0 = performance.now();
        const { value, done } = await generator.next();
        row.ms += performance.now() - t0; // compute time only, UI pauses excluded

        if (done || !value) {
            row.status = 'failed';
            return true;
        }
        if (value.type === 'step') {
            row.expanded++;
        } else if (value.type === 'success') {
            row.status = 'solved';
            row.moves = value.path.length;
            return true;
        } else {
            row.status = 'failed';
            return true;
        }

        // Let the browser breathe and show live progress
        if (row.expanded % 40 === 0) {
            onTick();
            await new Promise(r => setTimeout(r, 0));
            if (raceCancelled) return false;
        }
    }
}

function compareRaceRows(a, b) {
    const rank = r => (r.status === 'solved' ? 0 : r.status === 'failed' ? 1 : 2);
    return rank(a) - rank(b) || a.expanded - b.expanded || a.ms - b.ms;
}

function renderRaceRows(rows, finished = false) {
    const maxExpanded = Math.max(1, ...rows.map(r => r.expanded));
    const winner = finished && rows[0] && rows[0].status === 'solved' ? rows[0] : null;

    raceRowsEl.innerHTML = rows.map(r => {
        const pct = r.expanded > 0 ? Math.max(1, (r.expanded / maxExpanded) * 100) : 0;
        let moves = '—';
        if (r.status === 'solved') moves = r.moves;
        else if (r.status === 'running') moves = 'racing…';
        else if (r.status === 'failed') moves = 'gave up';
        else if (r.status === 'skipped') moves = 'skipped';
        const time = (r.status === 'solved' || r.status === 'failed') ? formatMs(r.ms) : '—';
        const tooltip = r.status === 'solved'
            ? `${r.name}: solved in ${r.moves} moves, ${r.expanded.toLocaleString('en-US')} nodes expanded, ${formatMs(r.ms)}`
            : r.status === 'failed'
                ? `${r.name}: hit the search limit after ${r.expanded.toLocaleString('en-US')} nodes expanded`
                : r.name;

        return `
            <div class="race-row ${r.status} ${r === winner ? 'winner' : ''}" role="row" title="${tooltip}">
                <span class="race-name" role="cell">${r === winner ? '🏆 ' : ''}${r.name}</span>
                <span class="race-bar-cell" role="cell"><span class="race-bar" style="width:${pct}%"></span></span>
                <span class="num" role="cell">${r.expanded > 0 ? r.expanded.toLocaleString('en-US') : '—'}</span>
                <span class="num" role="cell">${moves}</span>
                <span class="num" role="cell">${time}</span>
            </div>`;
    }).join('');
}

function raceSummary(rows) {
    const solved = rows.filter(r => r.status === 'solved');
    const failed = rows.filter(r => r.status === 'failed');
    if (solved.length === 0) {
        return "😵 Nobody made it this time. Every heuristic gave up: try an easier scramble.";
    }
    const best = solved[0];
    let text = `🏆 <strong>${best.name}</strong> wins: solved in ${best.moves} moves expanding just ${best.expanded.toLocaleString('en-US')} nodes.`;
    const worst = solved[solved.length - 1];
    if (worst !== best && worst.expanded > best.expanded) {
        const ratio = worst.expanded / best.expanded;
        text += ` That's ${ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)}× fewer than ${worst.name}.`;
    }
    if (failed.length > 0) {
        text += ` ${failed.length} heuristic${failed.length > 1 ? 's' : ''} hit the search limit and gave up.`;
    }
    return text;
}

function formatMs(ms) {
    return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.max(1, Math.round(ms))} ms`;
}

// --- Logic Functions ---

function startAutoPlay() {
    playBtn.textContent = "Pause";
    stepBtn.disabled = true;
    autoPlayInterval = setInterval(() => {
        stepSolver();
    }, 300);
}

function stopAutoPlay() {
    clearInterval(autoPlayInterval);
    autoPlayInterval = null;
    playBtn.textContent = "Auto Play";
    stepBtn.disabled = false;
}

function resetSolver() {
    stopAutoPlay();
    isSolving = false;
    solverGenerator = null;
    scrambleBtn.disabled = false;
    solveBtn.disabled = false;
    stepBtn.disabled = true;
    playBtn.disabled = true;
    difficultySelect.disabled = false;
    heuristicSelect.disabled = false;
    applyScrambleBtn.disabled = false;
    openSetListEl.innerHTML = '';
    whyPanel.style.display = 'none';
}

async function stepSolver() {
    if (!solverGenerator) return;

    const result = await solverGenerator.next();

    if (result.done) {
        handleSolverEnd(result.value);
        return;
    }

    const data = result.value;

    if (data.type === 'step') {
        updateCubeVisuals(cubeGroup, data.current.state);
        updateStats(data.current.g, data.current.h);
        updateOpenSetUI(data.openSet);
        updateTree(data.current, data.openSet);

        const g = data.current.g;
        const h = data.current.h;
        const f = data.current.f;

        let narrative = `<strong>Step ${data.iterations}:</strong> `;
        narrative += `Expanding a state with <strong>F=${f}</strong>.<br>`;
        explanationEl.innerHTML = narrative;

        whyText.innerHTML = `
            <strong>Evaluating Node #${data.current.id}</strong><br>
            This node has the lowest total cost (F=${f}) in the Open Set.<br>
            <ul>
                <li><strong>Cost so far (G):</strong> ${g} moves from start.</li>
                <li><strong>Estimated remaining (H):</strong> ${h} moves to goal.</li>
            </ul>
            <strong>Action:</strong> Generating all possible next moves (neighbors) to see if any lead closer to the solution.
        `;

    } else if (data.type === 'success') {
        stopAutoPlay();
        explanationEl.innerHTML = `<strong>Solved!</strong> Solution found in ${data.iterations} iterations.<br>Path: ${data.path.join(' -> ')}`;
        whyText.innerHTML = `<strong>Goal Reached!</strong><br>The heuristic estimated 0 remaining moves, and the state matches the solved cube.`;

        highlightSolutionPath(data.finalNode);
        addToHistory(data.path, currentScrambleMoves);

        // Keep the logical state in sync with the solved cube on screen
        cubeState = data.finalNode.state;
        currentScrambleMoves = [];

        solveBtn.disabled = false;
        scrambleBtn.disabled = false;
        difficultySelect.disabled = false;
        heuristicSelect.disabled = false;
        applyScrambleBtn.disabled = false;
        stepBtn.disabled = true;
        playBtn.disabled = true;
        isSolving = false;
    } else if (data.type === 'failure') {
        stopAutoPlay();
        explanationEl.textContent = `Failed: ${data.reason}`;
        resetSolver();
    }
}

function updateStats(g, h) {
    gScoreEl.textContent = g;
    hScoreEl.textContent = h;
    fScoreEl.textContent = g + h;
}

function updateOpenSetUI(openSet) {
    openSetListEl.innerHTML = openSet.map((node, index) => `
        <div class="open-set-item ${index === 0 ? 'best' : ''}">
            <span>Node #${node.id}</span>
            <span>F: <strong>${node.f}</strong> (G:${node.g} + H:${node.h})</span>
        </div>
    `).join('');
}

function addToHistory(path, scramble) {
    const seq = path.join(' ');
    const scrambleStr = scramble.join(' ');

    // Store for CSV
    solutionHistoryData.push({ scramble: [...scramble], solution: [...path] });

    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
        <div><strong>Solved:</strong> ${seq}</div>
        <div style="font-size: 0.75rem; color: #9ca3af;">Scramble: ${scrambleStr}</div>
    `;

    item.addEventListener('click', () => {
        replaySolution(scramble, path);
    });

    historyListEl.prepend(item);
}

async function replaySolution(scramble, solution) {
    resetSolver();
    explanationEl.textContent = "Replaying solution...";

    cubeState = new CubeState();
    updateCubeVisuals(cubeGroup, cubeState);
    await new Promise(r => setTimeout(r, 500));

    for (const move of scramble) {
        cubeState = cubeState.applyMove(move);
    }
    updateCubeVisuals(cubeGroup, cubeState);
    await new Promise(r => setTimeout(r, 500));

    for (const move of solution) {
        cubeState = cubeState.applyMove(move);
        updateCubeVisuals(cubeGroup, cubeState);
        explanationEl.textContent = `Replay Move: ${move}`;
        await new Promise(r => setTimeout(r, 600));
    }

    explanationEl.textContent = "Replay finished.";
}

// --- D3 Tree Visualization ---

function initTree() {
    const container = document.getElementById('tree-container');

    // Robust Cleanup: Remove any existing visualization SVG
    // We select only SVGs that are direct children or have the class
    const oldViz = container.querySelectorAll('svg.tree-viz');
    oldViz.forEach(el => el.remove());

    // Also try to find any SVG that is a direct child and NOT inside a button (legacy cleanup)
    Array.from(container.children).forEach(child => {
        if (child.tagName.toLowerCase() === 'svg' && !child.classList.contains('tree-viz')) {
            child.remove();
        }
    });

    treeNodes = [];
    treeLinks = [];

    const width = container.clientWidth;
    const height = container.clientHeight;

    treeZoom = d3.zoom().on("zoom", (event) => {
        treeG.attr("transform", event.transform);
    });

    treeSvg = d3.select("#tree-container").append("svg")
        .attr("class", "tree-viz")
        .attr("width", "100%") // Use CSS size
        .attr("height", "100%")
        .style("position", "absolute")
        .style("top", "0")
        .style("left", "0")
        .style("z-index", "1") // Behind controls
        .call(treeZoom)
        .append("g");

    treeG = treeSvg.append("g");

    treeSimulation = d3.forceSimulation(treeNodes)
        .force("link", d3.forceLink(treeLinks).id(d => d.id).distance(40))
        .force("charge", d3.forceManyBody().strength(-100))
        .force("center", d3.forceCenter(width / 2, height / 2));
}

function updateTree(currentNode, openSet) {
    if (!treeNodes.find(n => n.id === currentNode.id)) {
        treeNodes.push({ ...currentNode, type: 'current' });
        if (currentNode.parentId !== null) {
            treeLinks.push({
                source: currentNode.parentId,
                target: currentNode.id,
                move: currentNode.moveFromParent
            });
        }
    }

    openSet.forEach(node => {
        if (!treeNodes.find(n => n.id === node.id)) {
            treeNodes.push({ ...node, type: 'frontier' });
            if (node.parentId !== null) {
                treeLinks.push({
                    source: node.parentId,
                    target: node.id,
                    move: node.moveFromParent
                });
            }
        }
    });

    const link = treeG.selectAll(".link-group")
        .data(treeLinks)
        .join("g")
        .attr("class", "link-group");

    link.each(function (d) {
        const g = d3.select(this);
        if (g.selectAll("line").empty()) g.append("line").attr("class", "link");
        if (g.selectAll("text").empty()) {
            g.append("text")
                .attr("class", "link-label")
                .attr("dy", -3)
                .text(d.move || "");
        }
    });

    const node = treeG.selectAll(".node")
        .data(treeNodes, d => d.id)
        .join("g")
        .attr("class", d => `node ${d.id === currentNode.id ? 'current' : ''}`);

    node.selectAll("*").remove();

    node.append("circle")
        .attr("r", 6);

    node.append("title")
        .text(d => `F: ${d.f} (G:${d.g} + H:${d.h})`);

    node.append("text")
        .attr("dy", 3)
        .attr("dx", 8)
        .text(d => `F:${d.f}`);

    treeSimulation.nodes(treeNodes).on("tick", () => {
        link.selectAll("line")
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        link.selectAll("text")
            .attr("x", d => (d.source.x + d.target.x) / 2)
            .attr("y", d => (d.source.y + d.target.y) / 2);

        node
            .attr("transform", d => `translate(${d.x},${d.y})`);
    });

    treeSimulation.force("link").links(treeLinks);
    treeSimulation.alpha(0.3).restart();
}

function highlightSolutionPath(finalNode) {
    const pathIds = new Set();
    let curr = finalNode;
    while (curr) {
        pathIds.add(curr.id);
        const parent = treeNodes.find(n => n.id === curr.parentId);
        curr = parent;
    }

    treeG.selectAll(".node")
        .classed("solution", d => pathIds.has(d.id));

    treeG.selectAll(".link-group line")
        .classed("solution", d => pathIds.has(d.source.id) && pathIds.has(d.target.id));
}

// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);
    orbitControls.update();
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize tree on load
initTree();
