import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from app.domain.contracts import EXPORT_MODELS

for model in EXPORT_MODELS:
    value = model.model_json_schema()
    value["$schema"] = "https://json-schema.org/draft/2020-12/schema"
    text = json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n"
    path = ROOT / "packages/contracts/schemas" / f"{model.__name__}.json"
    if "--check" in sys.argv:
        if not path.exists() or path.read_text(encoding="utf-8") != text:
            raise SystemExit(f"Schema drift: {path.name}. Run npm run contracts.")
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
print("Pydantic JSON schemas: OK")
