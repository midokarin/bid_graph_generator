from copy import deepcopy
import json
from pathlib import Path
import unittest

from pydantic import ValidationError

from app.domain.contracts import EXPORT_MODELS, FlowchartResult, GenerationRequest
from app.domain.limits import MAX_SOURCE
from app.domain.migrations import migrate_project
from app.services.parsing import clean_json, parse_result

CONTRACTS = Path(__file__).resolve().parents[2] / "packages/contracts"


class ContractTests(unittest.TestCase):
    def test_shared_corpus(self):
        models = {model.__name__: model for model in EXPORT_MODELS}
        for case in json.loads((CONTRACTS / "cases.json").read_text()):
            with self.subTest(case=case["name"]):
                original = deepcopy(case["data"])
                if case["valid"]:
                    result = models[case["model"]].model_validate(case["data"])
                    self.assertEqual(result.model_dump(mode="json", exclude_unset=True), original)
                else:
                    with self.assertRaises(ValidationError):
                        models[case["model"]].model_validate(case["data"])
                self.assertEqual(original, case["data"])

    def test_limited_cleanup_and_no_execution(self):
        raw = (CONTRACTS / "examples/flowchart.json").read_text()
        for wrapped in [raw, f"  ```json\n{raw}\n```  ", f"```\n{raw}\n```"]:
            result, errors = parse_result(wrapped, FlowchartResult, "DOWN")
            self.assertIsNotNone(result)
            self.assertEqual(errors, [])
        for invalid in ["prefix" + raw, raw + "suffix", '{"a":1,"a":2}', '{"value":NaN}',
                        "```python\nraise RuntimeError('do not run')\n```", '{"x": 1,}', "[]"]:
            result, errors = parse_result(invalid, FlowchartResult, "DOWN")
            self.assertIsNone(result)
            self.assertTrue(errors)
        self.assertEqual(clean_json(' {"unknown":1} '), '{"unknown":1}')
        self.assertIsNone(parse_result(raw, FlowchartResult, "RIGHT")[0])

    def test_migration_boundary(self):
        original = json.loads((CONTRACTS / "examples/flowchart-project.json").read_text())
        result, migrated = migrate_project(original)
        self.assertFalse(migrated)
        self.assertEqual(result.model_dump(exclude_unset=True), original)
        for version in ["0.8", "2.0", None]:
            with self.assertRaisesRegex(ValueError, "支持 1.0"):
                migrate_project({**original, "project_file_version": version})

    def test_input_bounds_and_no_coercion(self):
        for text in ["", " " * 20, "x" * (MAX_SOURCE + 1), 5]:
            with self.assertRaises(ValidationError):
                GenerationRequest(diagram_type="flowchart", source_text=text)
        self.assertEqual(GenerationRequest(diagram_type="flowchart", source_text="x" * MAX_SOURCE).direction, "DOWN")

    def test_optional_presentation_defaults_and_strict_choices(self):
        from app.domain.contracts import ProjectFile
        original = json.loads((CONTRACTS / "examples/flowchart-project.json").read_text())
        project = ProjectFile.model_validate(original)
        style = project.versions[0].style
        self.assertEqual((style.font_weight, style.border_style, style.node_accent,
                          style.gantt_bar_style, style.gantt_grid),
                         (400, "solid", "none", "solid", "full"))
        for field, value in [("font_weight", 900), ("border_style", "bad"),
                             ("node_accent", "bad"), ("gantt_bar_style", "bad"), ("gantt_grid", "bad")]:
            invalid = deepcopy(original)
            invalid["versions"][0]["style"][field] = value
            with self.assertRaises(ValidationError):
                ProjectFile.model_validate(invalid)
