from importlib import import_module
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
ML_ROOT = ROOT / "ml-service"


def import_ml_module(name: str):
    if str(ML_ROOT) not in sys.path:
        sys.path.insert(0, str(ML_ROOT))
    return import_module(name)
