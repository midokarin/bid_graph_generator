import copy
import json
import re
import unittest

from pydantic import ValidationError

from app.domain.contracts import FlowchartResult, GanttResult, GenerationRequest
from app.providers.schema import native_schema
from app.services.prompts import initial_messages, repair_messages


def patterns(value):
    if isinstance(value, dict):
        if 'pattern' in value:
            yield value['pattern']
        for item in value.values():
            yield from patterns(item)
    elif isinstance(value, list):
        for item in value:
            yield from patterns(item)


class GenerationSchemaTests(unittest.TestCase):
    def test_provider_schema_removes_only_nonblank_search_pattern_without_mutating_contract(self):
        for model in [FlowchartResult, GanttResult]:
            original = model.model_json_schema()
            before = copy.deepcopy(original)
            wire = native_schema(original)
            self.assertEqual(original, before)
            self.assertIn(r'\S', list(patterns(original)))
            self.assertNotIn(r'\S', list(patterns(wire)))
            self.assertIn(r'^[A-Za-z0-9_-]+$', list(patterns(wire)))
            self.assertEqual(wire['required'], original['required'])
            definition = 'FlowNode' if model == FlowchartResult else 'GanttTask'
            self.assertEqual(wire['$defs'][definition]['properties']['text'], {
                k: v for k, v in original['$defs'][definition]['properties']['text'].items() if k != 'pattern'
            })
            self.assertFalse(wire['additionalProperties'])
            self.assertEqual(native_schema(wire), wire)

    def test_initial_and_repair_prompts_use_the_same_generation_schema(self):
        request = GenerationRequest(diagram_type='flowchart', source_text='合成测试')
        schema = FlowchartResult.model_json_schema()
        for messages in [initial_messages(request, schema), repair_messages(request, schema, '{}', [])]:
            prompt_schema = json.loads(messages[0]['content'].split('JSON Schema：\n', 1)[1].split('\n修复给定', 1)[0])
            self.assertEqual(prompt_schema, native_schema(schema))
            self.assertNotIn(r'\S', list(patterns(prompt_schema)))

    def test_search_vs_fullmatch_regression_and_local_nonblank_validation(self):
        # Reproduces the precise interpretation mismatch observed on the live endpoint.
        self.assertIsNotNone(re.search(r'\S', '接收项目需求'))
        self.assertIsNone(re.fullmatch(r'\S', '接收项目需求'))
        self.assertIsNotNone(re.fullmatch(r'\S', '接'))
        from app.domain.contracts import FlowNode, GanttTask
        for text in ['', ' ', '\t\n']:
            with self.assertRaises(ValidationError):
                FlowNode(id='n1', type='process', text=text, level=0, owner=None, phase=None)
            with self.assertRaises(ValidationError):
                GanttTask(id='t1', text=text, kind='task', duration=1, earliest_start=None)
        for text in ['接收项目需求', '第一行\n第二行', 'A', '收']:
            self.assertEqual(FlowNode(id='n1', type='process', text=text, level=0, owner=None, phase=None).text, text)
