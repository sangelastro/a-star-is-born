"""OpenJev scoring server for the A* Is Born "OpenJev" heuristic.

The browser describes cube states in plain English and sends (premise, hypothesis) pairs; this server returns
OpenJev's NLI probabilities [contradiction, entailment, neutral] for each pair. It knows nothing about cubes.

    python openjev/server.py            # http://127.0.0.1:7474

Environment:
    OPENJEV_MODELS   folder holding modeling_openjev.py and the checkpoints (default: openjev/models/openjev)
    OPENJEV_MODEL    checkpoint subfolder (default: qwen3.5-0.8b-nli-v2s-long)
    PORT             default 7474
"""
from __future__ import annotations

import os
import sys
import threading
import time

import torch
from flask import Flask, jsonify, request

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.environ.get("OPENJEV_MODELS") or os.path.join(HERE, "models", "openjev")
SUBFOLDER = os.environ.get("OPENJEV_MODEL", "qwen3.5-0.8b-nli-v2s-long")
MAX_PAIRS = 256

sys.path.insert(0, MODELS)
from modeling_openjev import OpenJevCrossEncoder  # noqa: E402

app = Flask(__name__)
_jev: OpenJevCrossEncoder | None = None
_lock = threading.RLock()  # rientrante: /score lo tiene mentre chiama jev()


def jev() -> OpenJevCrossEncoder:
    global _jev
    with _lock:
        if _jev is None:
            cuda = torch.cuda.is_available()
            _jev = OpenJevCrossEncoder(MODELS, subfolder=SUBFOLDER, device="cuda" if cuda else "cpu",
                                       dtype=torch.bfloat16 if cuda else torch.float32)
        return _jev


@app.after_request
def cors(resp):
    # Local only (bound to 127.0.0.1); lets both the Vite dev server and the GitHub Pages demo call it.
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    resp.headers["Access-Control-Allow-Private-Network"] = "true"
    return resp


@app.get("/health")
def health():
    # No lock: must answer even while a long /score is running
    if _jev is None:
        return jsonify({"ok": False, "loading": True}), 503
    return jsonify({"ok": True, "model": SUBFOLDER, "device": _jev.device})


@app.route("/score", methods=["POST", "OPTIONS"])
def score():
    if request.method == "OPTIONS":
        return "", 204
    body = request.get_json(force=True)
    pairs = body.get("pairs") or []
    if not pairs or len(pairs) > MAX_PAIRS or any(len(p) != 2 for p in pairs):
        return jsonify({"error": f"send 1..{MAX_PAIRS} [premise, hypothesis] pairs"}), 400
    t = time.time()
    with _lock:
        probs = jev().predict([(str(p), str(h)) for p, h in pairs])
    return jsonify({"probs": probs.round(5).tolist(), "ms": int((time.time() - t) * 1000)})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7474))
    print(f"Loading OpenJev ({SUBFOLDER}) from {MODELS}…")
    j = jev()
    print(f"OpenJev ready on {j.device} -> http://127.0.0.1:{port}")
    app.run(host="127.0.0.1", port=port, threaded=True)
