"""Download the OpenJev checkpoint used by the heuristic into openjev/models/openjev/ (about 1.7 GB).

    python openjev/download_model.py
"""
import os

from huggingface_hub import snapshot_download

HERE = os.path.dirname(os.path.abspath(__file__))
path = snapshot_download("AlexWortega/openjev",
                         allow_patterns=["modeling_openjev.py", "qwen3.5-0.8b-nli-v2s-long/*"],
                         local_dir=os.path.join(HERE, "models", "openjev"))
print("OpenJev downloaded to", path)
