<p align="center">
  <img src="docs/banner.svg" alt="A* Is Born — un risolutore interattivo del cubo di Rubik" width="100%">
</p>

<p align="center">
  🇬🇧 <a href="README.md">English</a> · 🇮🇹 <b>Italiano</b>
</p>

> **Una storia d'amore tra un algoritmo di ricerca e un cubo di Rubik tutto mescolato.**
> Lui è perso, contorto e confuso. Lei è una cercatrice di percorsi con un'euristica e un piano.
> Spoiler: finisce con ogni faccia di un solo colore. 🌟

**A\* Is Born** è un laboratorio 3D interattivo: mescoli un cubo di Rubik e guardi l'algoritmo A\* risolverlo, una decisione alla volta. Vedi ogni nodo che espande, ogni candidato che valuta e *perché* sceglie proprio quello. È il dietro le quinte di un algoritmo di ricerca, in versione director's cut.

<p align="center">
  <img src="docs/screenshot.png" alt="A* che risolve un cubo di Rubik: pannello di controllo, cubo 3D e albero di ricerca in tempo reale" width="100%">
</p>

## ✨ Funzionalità

- 🧊 **Cubo in 3D** con Three.js: lo ruoti, lo zoomi e lo ammiri da ogni angolazione.
- 👣 **A\* passo passo**: avanzi un'espansione alla volta, oppure premi *Auto Play* e ti godi lo spettacolo.
- 🌳 **Albero di ricerca in tempo reale** con D3. Il nodo corrente, la frontiera e il percorso vincente sono evidenziati, e puoi zoomare, spostarti o andare a schermo intero.
- 📋 **Ispettore dell'open set** con i migliori candidati e i loro punteggi `F = G + H`.
- 💬 **Pannello "Why?"** che spiega ogni scelta a parole.
- 🎲 **Mescola come vuoi**:
  - mescolamenti casuali per difficoltà, partendo dal cubo risolto o sommandoli a quello attuale;
  - una sequenza di mosse personalizzata, tipo `U R' F D`;
  - la modalità colori manuale, per dipingere gli adesivi direttamente sul cubo.
- 🕹️ **Cronologia delle soluzioni** con replay, più l'esportazione CSV di mescolamenti e soluzioni.

## 🧠 A\* in 60 secondi

A\* è un algoritmo di ricerca *best-first*. Trova un percorso da uno stato iniziale (il cubo mescolato) a uno stato obiettivo (il cubo risolto), esplorando sempre per primo lo stato più *promettente*.

Per ogni stato `n`, A\* calcola:

```
f(n) = g(n) + h(n)
```

| Termine | Significato | Sul cubo |
|---|---|---|
| `g(n)` | Costo reale dall'inizio fino a `n` | Mosse già fatte |
| `h(n)` | **Euristica**: costo stimato da `n` all'obiettivo | Stima ragionata delle mosse che mancano |
| `f(n)` | Costo totale stimato del miglior percorso che passa da `n` | Il valore che A\* usa per scegliere |

Il ciclo:

1. Metti lo stato iniziale nell'**open set** (i candidati da esplorare).
2. Prendi lo stato con la **`f` più bassa**. Se è l'obiettivo, hai finito 🎉
3. Altrimenti **espandilo**: genera i 12 stati vicini (`U U' D D' L L' R R' F F' B B'`), calcola la loro `f` e aggiungili all'open set.
4. Sposta lo stato espanso nel **closed set**, così non viene mai esplorato due volte, e ricomincia.

**Perché l'euristica conta.** Se `h` non sovrastima mai la distanza reale (euristica *ammissibile*), A\* trova di sicuro una soluzione più corta possibile. Più `h` si avvicina alla verità, meno stati A\* deve esplorare. Per questo l'app ti fa cambiare euristica e confrontarle: una debole gira a vuoto, una forte va dritta a casa.

> ℹ️ Alcune euristiche di questa demo sono scalate per andare più veloci e non sono strettamente ammissibili: le soluzioni sono corte, ma non sempre garantite ottime. La ricerca si ferma inoltre a 5.000 iterazioni, per non far soffrire il browser.

## 🧩 Euristiche

| Euristica | Idea |
|---|---|
| Misplaced Stickers | Conta gli adesivi che non sono sulla faccia giusta. |
| Misplaced Cubies | Conta angoli e spigoli fuori dalla loro posizione. |
| Twist & Flip | Conta gli angoli ruotati e gli spigoli capovolti. |
| 3D Manhattan Distance | Somma quanto ogni adesivo è lontano dalla sua faccia. |
| Single PDB (Corners) | Pattern database per orientamento e permutazione degli angoli, costruiti nel browser con una ricerca in ampiezza. |
| Disjoint PDB (Corners + Edges) | Combina i PDB degli angoli con un PDB su un sottoinsieme di spigoli. |

> Le euristiche PDB richiedono prima un click su **Generate PDBs**. Le tabelle vengono costruite nel tuo browser in pochi secondi.

## 🚀 Come avviarlo

Serve [Node.js](https://nodejs.org/) 18 o superiore.

```bash
npm install
npm run dev
```

Poi apri l'indirizzo che stampa Vite (di solito http://localhost:5173).

Per creare la versione statica:

```bash
npm run build
npm run preview
```

## 🗂️ Struttura del progetto

```
index.html      Layout dell'interfaccia
main.js         Scena Three.js, collegamento della UI, albero di ricerca D3
cube.js         Mesh del cubo 3D e disegno degli adesivi
cubeLogic.js    Stato del cubo, mosse e modello a cubetti (permutazione/orientamento)
solver.js       Euristiche e generatore A*
src/pdb.js      Indicizzazione e generazione dei pattern database
style.css       Stili
```

## 🔤 Notazione

Le mosse usano la notazione standard di Singmaster: `U` (su), `D` (giù), `L` (sinistra), `R` (destra), `F` (fronte), `B` (retro). L'apice `'` indica una rotazione in senso antiorario.

## 🏆 Crediti

**L'algoritmo.** Le vere star dello spettacolo:

- **A\*** è stato introdotto da **Peter E. Hart, Nils J. Nilsson e Bertram Raphael** allo Stanford Research Institute:
  *"A Formal Basis for the Heuristic Determination of Minimum Cost Paths"*, IEEE Transactions on Systems Science and Cybernetics, 4(2), 100–107, 1968.
- I **pattern database** sono stati introdotti da **Joseph C. Culberson e Jonathan Schaeffer**:
  *"Pattern Databases"*, Computational Intelligence, 14(3), 318–334, 1998.
- L'**applicazione dei pattern database al cubo di Rubik** si deve a **Richard E. Korf**:
  *"Finding Optimal Solutions to Rubik's Cube Using Pattern Databases"*, AAAI-97, 1997.
- I **pattern database disgiunti** sono di **Richard E. Korf e Ariel Felner**:
  *"Disjoint Pattern Database Heuristics"*, Artificial Intelligence, 134(1–2), 9–22, 2002.

**Il rompicapo.** Il cubo di Rubik è stato inventato da **Ernő Rubik** nel 1974.

**Realizzato con** [Three.js](https://threejs.org/) · [D3.js](https://d3js.org/) · [Vite](https://vitejs.dev/)

## 📄 Licenza

[MIT](LICENSE)

<sub>Rubik's Cube® è un marchio registrato di Spin Master Ltd. Questo è un progetto educativo indipendente, non affiliato né approvato dal titolare del marchio.</sub>
