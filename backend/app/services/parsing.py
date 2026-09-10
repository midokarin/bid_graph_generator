import json
import re

from pydantic import ValidationError


def clean_json(raw: str) -> str:
    text = raw.strip()
    match = re.fullmatch(r"```(?:json)?[ \t]*\r?\n(.*)\r?\n```", text, re.DOTALL)
    return match.group(1).strip() if match else text


def no_duplicates(pairs):
    value = {}
    for key, item in pairs:
        if key in value:
            raise ValueError("duplicate JSON object key")
        value[key] = item
    return value


def reject_constant(value):
    raise ValueError("non-finite JSON number")


def parse_result(raw, model, direction):
    try:
        value = json.loads(clean_json(raw), object_pairs_hook=no_duplicates, parse_constant=reject_constant)
        result = model.model_validate(value)
        if result.spec.diagram_type == "flowchart" and result.spec.direction != direction:
            return None, [{"type": "direction_mismatch", "loc": ["spec", "direction"], "msg": f"User direction must be {direction}"}]
        return result, []
    except ValidationError as exc:
        return None, exc.errors(include_url=False, include_context=False, include_input=False)
    except (ValueError, RecursionError) as exc:
        # Syntax errors do not need to repeat the input in diagnostics.
        return None, [{"type": "invalid_json", "loc": [], "msg": "Invalid JSON syntax or duplicate object key", "detail": type(exc).__name__}]
