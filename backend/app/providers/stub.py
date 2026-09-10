import asyncio
import json


class StubProvider:
    """Synthetic fixture provider. Ignores source text, never calls a model."""

    async def stream(self, messages, schema):
        is_flow = schema["title"] == "FlowchartResult"
        spec = {"schema_version": "1.0", "diagram_type": "flowchart" if is_flow else "gantt", "title": "替身模型示例"}
        if is_flow:
            direction = "RIGHT" if '用户方向：RIGHT' in messages[0]["content"] else "DOWN"
            spec.update(direction=direction, nodes=[
                {"id": "start", "type": "start", "text": "开始", "level": 0, "owner": None, "phase": None},
                {"id": "end", "type": "end", "text": "结束", "level": 1, "owner": None, "phase": None},
            ], edges=[{"id": "e1", "source": "start", "target": "end", "label": None, "kind": "normal"}])
        else:
            spec.update(time_unit="calendar_day", tasks=[
                {"id": "t1", "text": "示例任务", "kind": "task", "duration": 3, "earliest_start": None},
                {"id": "m1", "text": "交付", "kind": "milestone", "duration": 0, "earliest_start": None},
            ], dependencies=[{"id": "d1", "source": "t1", "target": "m1", "type": "FS", "lag": 0}])
        raw = json.dumps({"spec": spec, "supplements": [], "summary": "固定替身数据，不代表对输入内容的理解。"}, ensure_ascii=False)
        for offset in range(0, len(raw), 40):
            await asyncio.sleep(0.01)
            yield raw[offset:offset + 40]
