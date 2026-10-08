<p align="center">
  <img src="docs/banner.svg" alt="A* Is Born — un risolutore interattivo del cubo di Rubik" width="100%">
</p>

<p align="center">
  🇬🇧 <a href="README.md">English</a> · 🇮🇹 <b>Italiano</b>
</p>

<p align="center">
  <a href="https://sangelastro.github.io/a-star-is-born/"><b>▶️ Provalo subito online</b></a>, senza installare nulla
</p>

> **Una storia d'amore tra un algoritmo di ricerca e un cubo di Rubik tutto mescolato.**
> Lui è perso, contorto e confuso. Lei è una cercatrice di percorsi con un'euristica e un piano.
> Spoiler: finisce con ogni faccia di un solo colore. 🌟

**A\* Is Born** è un laboratorio 3D interattivo: mescoli un cubo di Rubik e guardi l'algoritmo A\* risolverlo, una decisione alla volta. Vedi ogni nodo che espande, ogni candidato che valuta e *perché* sceglie proprio quello. È il dietro le quinte di un algoritmo di ricerca, in versione director's cut.

<p align="center">
  <img src="docs/screenshot.png" alt="A* che risolve un cubo di Rubik: pannello di controllo, cubo 3D e albero di ricerca in tempo reale" width="100%">
</p>

## ✨ Funzionalità

- 🏁 **Gara delle euristiche**: con un click tutte le euristiche risolvono lo stesso cubo, e una classifica mostra nodi espansi, lunghezza della soluzione e tempo.
- 🧊 **Cubo in 3D** con Three.js: lo ruoti, lo zoomi e lo ammiri da ogni angolazione.
- 👣 **A\* passo passo**: avanzi un'espansione alla volta, oppure premi *Auto Play* e ti godi lo spettacolo.
- 🌳 **Albero di ricerca in tempo reale** con D3. Il nodo corrente, la frontiera e il percorso vincente sono evidenziati, e puoi zoomare, spostarti o andare a schermo intero.
- 📋 **Ispettore dell'open set** con i migliori candidati e i loro punteggi `F = G + H`.
- 💬 **Pannello "Why?"** che spiega ogni scelta a parole.
- 🧠 **Un'euristica che è un modello linguistico**: [OpenJev](docs/openjev.it.md) legge fatti sul cubo scritti in inglese e giudica quanto sembra risolto. Il pannello "Why?" mostra esattamente cosa ha letto e come ha giudicato ogni nodo (serve un piccolo server locale).
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

## 🏁 La gara delle euristiche

Le chiacchiere stanno a zero: facciamole gareggiare. Mescola il cubo, premi **🏁 Race all heuristics** e tutte le euristiche risolvono lo *stesso* cubo, una dopo l'altra. La classifica le ordina per **nodi espansi**, la misura onesta di quanto è furba un'euristica: meno stati A\* deve esplorare, migliore è la sua stima della distanza dall'obiettivo.

<p align="center">
  <img src="docs/race.png" alt="Classifica della gara: Disjoint PDB vince con 132 nodi espansi, mentre due euristiche raggiungono il limite di ricerca" width="80%">
</p>

Su questo mescolamento da 7 mosse, il pattern database disgiunto trova la soluzione espandendo **132 nodi**, mentre contare gli adesivi fuori posto ne richiede **1.158**. Due euristiche non ci arrivano prima del limite di ricerca. Stesso algoritmo, stesso cubo: cambia solo l'euristica. Ecco A\* in poche parole.

> Le tabelle PDB vengono costruite in automatico la prima volta che avvii una gara (pochi secondi, una volta per sessione).

## 🧩 Euristiche

| Euristica | Idea |
|---|---|
| Misplaced Stickers | Conta gli adesivi che non sono sulla faccia giusta. |
| Misplaced Cubies | Conta angoli e spigoli fuori dalla loro posizione. |
| Twist & Flip | Conta gli angoli ruotati e gli spigoli capovolti. |
| 3D Manhattan Distance | Somma quanto ogni adesivo è lontano dalla sua faccia. |
| Single PDB (Corners) | Pattern database per orientamento e permutazione degli angoli, costruiti nel browser con una ricerca in ampiezza. |
| Disjoint PDB (Corners + Edges) | Combina i PDB degli angoli con un PDB su un sottoinsieme di spigoli. |
| 🧠 OpenJev language model | Nessuna formula: un modello NLI legge fatti sul cubo (cubetti risolti, facce complete, adesivi a posto) e giudica tre affermazioni, da *"almeno metà dei cubetti è risolta"* a *"il cubo è risolto"*. `h = 10 × (1 − accordo medio)`. **[Come funziona →](docs/openjev.it.md)** |

> Le euristiche PDB richiedono prima un click su **Generate PDBs**. Le tabelle vengono costruite nel tuo browser in pochi secondi.
>
> L'euristica OpenJev richiede il suo server del modello acceso sul tuo computer (`python openjev/server.py`, vedi [Avviarlo in locale](docs/openjev.it.md#avviarlo-in-locale)). Senza server, l'opzione spiega come avviarlo e la gara la salta.

## 🚀 Come avviarlo

Il modo più veloce è la [demo online](https://sangelastro.github.io/a-star-is-born/). Per avviarlo in locale serve [Node.js](https://nodejs.org/) 18 o superiore.

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

Ogni push su `main` viene pubblicato in automatico su GitHub Pages dal workflow in `.github/workflows/deploy.yml`.

## 🗂️ Struttura del progetto

```
index.html      Layout dell'interfaccia
main.js         Scena Three.js, collegamento della UI, albero di ricerca D3
cube.js         Mesh del cubo 3D e disegno degli adesivi
cubeLogic.js    Stato del cubo, mosse e modello a cubetti (permutazione/orientamento)
solver.js       Euristiche e generatore A*
src/pdb.js      Indicizzazione e generazione dei pattern database
src/openjev.js  Euristica OpenJev: fatti sul cubo, client del modello locale, verdetti per il pannello "Why?"
openjev/        Server locale di OpenJev (Python) e script per scaricare il modello
bench/race.mjs  Gara delle euristiche senza browser, in Node, su mescolamenti riproducibili
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

**Il modello linguistico.** [OpenJev](https://huggingface.co/AlexWortega/openjev) di AlexWortega (MIT), basato su Qwen3.5 di Alibaba.

**Il rompicapo.** Il cubo di Rubik è stato inventato da **Ernő Rubik** nel 1974.

**Realizzato con** [Three.js](https://threejs.org/) · [D3.js](https://d3js.org/) · [Vite](https://vitejs.dev/)

## 📄 Licenza

[MIT](LICENSE)

<sub>Rubik's Cube® è un marchio registrato di Spin Master Ltd. Questo è un progetto educativo indipendente, non affiliato né approvato dal titolare del marchio.</sub>
