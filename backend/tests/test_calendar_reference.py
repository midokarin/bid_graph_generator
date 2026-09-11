import json
import unittest

from app.domain.contracts import GenerationRequest, GanttResult, FlowchartResult
from app.services.calendar_reference import calendar_reference
from app.services.prompts import initial_messages, repair_messages


class CalendarReferenceTests(unittest.TestCase):
    def test_cross_month_leap_day_and_explicit_cross_year(self):
        cases = [("2026年10月13日至11月2日", 20, 21),
                 ("2024年2月28日至3月1日", 2, 3),
                 ("2025年12月31日至2026年1月2日", 2, 3),
                 ("2026年11月15日至11月15日", 0, 1)]
        for source, difference, inclusive in cases:
            reference = calendar_reference(source)
            self.assertEqual(reference, [{"原文日期段": source, "日期差": difference, "包含首尾当天的天数": inclusive}])

    def test_ambiguous_or_invalid_dates_are_not_guessed(self):
        for source in ["10月1日至10月7日", "2026年2月29日至3月1日", "2026年12月31日至1月2日",
                       "2025年和2026年项目，10月1日至10月7日", "2026年10月7日至10月1日"]:
            self.assertEqual(calendar_reference(source), [])

    def test_hints_preserve_source_and_stay_out_of_flow_and_repair(self):
        source = "项目2026年实施，任务10月13日至11月2日。总工期不是任务。"
        request = GenerationRequest(diagram_type="gantt", source_text=source)
        messages = initial_messages(request, GanttResult.model_json_schema())
        user = json.loads(messages[1]["content"])
        self.assertEqual(user["source_text"], source)
        self.assertEqual(user["calendar_reference"]["日期换算"][0]["包含首尾当天的天数"], 21)
        repaired = repair_messages(request, GanttResult.model_json_schema(), "{}", [])
        self.assertNotIn(source, json.dumps(repaired, ensure_ascii=False))
        flow = initial_messages(GenerationRequest(diagram_type="flowchart", source_text=source), FlowchartResult.model_json_schema())
        self.assertNotIn("calendar_reference", json.loads(flow[1]["content"]))
