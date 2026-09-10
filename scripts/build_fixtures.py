"""Rebuild synthetic shared contract cases; no user data or real model responses."""
from copy import deepcopy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "packages/contracts"


def node(id, type, text, level):
    return dict(id=id, type=type, text=text, level=level, owner=None, phase=None)


flow = {
    "spec": {"schema_version": "1.0", "diagram_type": "flowchart", "title": "合成示例：检查与整改", "direction": "DOWN",
             "nodes": [node("n1", "start", "开始", 0), node("n2", "process", "执行", 1), node("n3", "decision", "检查", 2),
                       node("n4", "subprocess", "整改", 3), node("n5", "document", "报告", 3), node("n6", "end", "结束", 4)],
             "edges": [{"id": f"e{i}", "source": source, "target": target, "label": label, "kind": kind}
                       for i, (source, target, label, kind) in enumerate([
                           ("n1", "n2", None, "normal"), ("n2", "n3", None, "normal"), ("n3", "n4", "不合格", "normal"),
                           ("n4", "n3", "复检", "rework"), ("n3", "n5", "合格", "normal"), ("n5", "n6", None, "normal")], 1)]},
    "supplements": [{"target_type": "node", "target_id": "n5", "reason": "合成示例补充报告", "question": "是否需要报告？"}],
    "summary": "合成测试数据，包含六种节点与整改回路。",
}
gantt = {
    "spec": {"schema_version": "1.0", "diagram_type": "gantt", "title": "合成示例：实施进度", "time_unit": "calendar_day",
             "tasks": [{"id": id, "text": text, "kind": kind, "duration": duration, "earliest_start": earliest}
                       for id, text, kind, duration, earliest in [("t1", "准备", "task", 3, None), ("t2", "实施", "task", 5, 2),
                                                                  ("t3", "培训", "task", 2, None), ("m1", "阶段验收", "milestone", 0, None), ("m2", "交付", "milestone", 0, None)]],
             "dependencies": [{"id": f"d{i}", "source": source, "target": target, "type": "FS", "lag": lag}
                              for i, (source, target, lag) in enumerate([("t1", "t2", -1), ("t1", "t3", 1), ("t2", "m1", 0), ("m1", "m2", 0), ("t3", "m2", 0)], 1)]},
    "supplements": [{"target_type": "task", "target_id": "t2", "reason": "合成示例估算工期", "question": "是否为 5 天？"}],
    "summary": "合成测试数据，包含并行、提前、延迟和两个里程碑。",
}
style = dict(template="classic", font_family="sans-serif", font_size=16, text_color="#000000", stroke_color="#000000",
             fill_color="#FFFFFF", background_color="#FFFFFF", transparent_background=False, stroke_width=1.5, corner_radius=5)
flow_layout = dict(diagram_type="flowchart", direction="DOWN", width=500, height=500,
                   nodes=[dict(id=n["id"], x=10, y=i*60, width=100, height=40) for i, n in enumerate(flow["spec"]["nodes"])],
                   edges=[dict(id=e["id"], points=[dict(x=10,y=10), dict(x=10,y=20)], label_position=None) for e in flow["spec"]["edges"]])
gantt_layout = dict(diagram_type="gantt", width=500, height=500,
                    tasks=[dict(id=id, start=start, end=end, row=i) for i, (id, start, end) in enumerate([
                        ("t1", 0, 3), ("t2", 2, 7), ("t3", 4, 6), ("m1", 7, 7), ("m2", 7, 7)])])


def project(result, layout):
    snapshot = dict(revision=1, created_at="2026-09-10T00:00:00Z", origin="ai", **deepcopy(result), layout=layout, style=deepcopy(style))
    return dict(project_file_version="1.0", diagram_type=result["spec"]["diagram_type"], source_text="合成测试原文", current_revision=1,
                versions=[snapshot], metadata={"fixture": True})


cases = []


def add(name, model, data, valid=True):
    cases.append(dict(name=name, model=model, valid=valid, data=deepcopy(data)))


def invalid(name, model, original, path, value=None, delete=False):
    data = deepcopy(original)
    parent = data
    for key in path[:-1]:
        parent = parent[key]
    if delete:
        del parent[path[-1]]
    else:
        parent[path[-1]] = value
    add(name, model, data, False)


for name, value, model, layout in [("flowchart", flow, "FlowchartResult", flow_layout), ("gantt", gantt, "GanttResult", gantt_layout)]:
    (ROOT / "examples" / f"{name}.json").write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    add(name + "-valid", model, value)
    add(name + "-spec-valid", "FlowchartSpec" if name == "flowchart" else "GanttSpec", value["spec"])
    invalid(name + "-missing", model, value, ["spec", "title"], delete=True)
    invalid(name + "-unknown", model, value, ["spec", "code"], "print('never execute')")
    invalid(name + "-wrong-type", model, value, ["summary"], 42)
    invalid(name + "-supplement-ref", model, value, ["supplements", 0, "target_id"], "absent")
    p = project(value, layout)
    (ROOT / "examples" / f"{name}-project.json").write_text(json.dumps(p, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    add(name + "-project-valid", "ProjectFile", p)
    invalid(name + "-project-future", "ProjectFile", p, ["project_file_version"], "2.0")
    invalid(name + "-project-current", "ProjectFile", p, ["current_revision"], 8)
    invalid(name + "-project-unknown-style", "ProjectFile", p, ["versions", 0, "style", "css"], "x")
    invalid(name + "-project-date", "ProjectFile", p, ["versions", 0, "created_at"], "2026-02-30T00:00:00Z")
    invalid(name + "-project-color", "ProjectFile", p, ["versions", 0, "style", "fill_color"], "url(x)")
    invalid(name + "-project-revision", "ProjectFile", p, ["versions"], [p["versions"][0], p["versions"][0]])
    invalid(name + "-project-kind", "ProjectFile", p, ["diagram_type"], "gantt" if name == "flowchart" else "flowchart")
    invalid(name + "-empty-title", model, value, ["spec", "title"], "   ")

invalid("flow-dangling", "FlowchartResult", flow, ["spec", "edges", 0, "target"], "absent")
invalid("flow-duplicate-node", "FlowchartResult", flow, ["spec", "nodes", 1, "id"], "n1")
invalid("flow-duplicate-edge", "FlowchartResult", flow, ["spec", "edges", 1, "id"], "e1")
invalid("flow-enum", "FlowchartResult", flow, ["spec", "nodes", 0, "type"], "code")
invalid("flow-coercion", "FlowchartResult", flow, ["spec", "nodes", 0, "level"], "0")
invalid("flow-bool-number", "FlowchartResult", flow, ["spec", "nodes", 0, "level"], True)
invalid("flow-level-negative", "FlowchartResult", flow, ["spec", "nodes", 0, "level"], -1)
invalid("flow-too-many", "FlowchartResult", flow, ["spec", "nodes"], [node(f"n{i}", "process", "步骤", 0) for i in range(21)])
invalid("flow-label-too-long", "FlowchartResult", flow, ["spec", "nodes", 0, "text"], "字" * 201)
for unit in ["week", "month"]:
    value = deepcopy(gantt)
    value["spec"]["time_unit"] = unit
    add("gantt-unit-" + unit, "GanttResult", value)
invalid("gantt-dangling", "GanttResult", gantt, ["spec", "dependencies", 0, "source"], "absent")
invalid("gantt-cycle", "GanttResult", gantt, ["spec", "dependencies"], gantt["spec"]["dependencies"] + [dict(id="d6", source="m2", target="t1", type="FS", lag=0)])
invalid("gantt-self-cycle", "GanttResult", gantt, ["spec", "dependencies", 0, "target"], "t1")
invalid("gantt-duplicate-task", "GanttResult", gantt, ["spec", "tasks", 1, "id"], "t1")
invalid("gantt-duplicate-dependency", "GanttResult", gantt, ["spec", "dependencies", 1, "id"], "d1")
invalid("gantt-negative-duration", "GanttResult", gantt, ["spec", "tasks", 0, "duration"], -1)
invalid("gantt-bool-duration", "GanttResult", gantt, ["spec", "tasks", 0, "duration"], True)
invalid("gantt-milestone-duration", "GanttResult", gantt, ["spec", "tasks", 3, "duration"], 2)
invalid("gantt-task-zero", "GanttResult", gantt, ["spec", "tasks", 0, "duration"], 0)
invalid("gantt-coercion", "GanttResult", gantt, ["spec", "tasks", 0, "duration"], "3")
invalid("gantt-unit", "GanttResult", gantt, ["spec", "time_unit"], "work_day")
invalid("flow-geometry-coverage", "ProjectFile", project(flow, flow_layout), ["versions", 0, "layout", "nodes"], [])
invalid("flow-geometry-direction", "ProjectFile", project(flow, flow_layout), ["versions", 0, "layout", "direction"], "RIGHT")
invalid("flow-geometry-range", "ProjectFile", project(flow, flow_layout), ["versions", 0, "layout", "nodes", 0, "x"], -1)
invalid("flow-geometry-canvas", "ProjectFile", project(flow, flow_layout), ["versions", 0, "layout", "nodes", 0, "x"], 490)
invalid("gantt-schedule-range", "ProjectFile", project(gantt, gantt_layout), ["versions", 0, "layout", "tasks", 1, "end"], 1)
invalid("gantt-schedule-coverage", "ProjectFile", project(gantt, gantt_layout), ["versions", 0, "layout", "tasks"], [])
integer_float = deepcopy(flow)
integer_float["spec"]["nodes"][0]["level"] = 0.0
add("flow-json-integer-number", "FlowchartResult", integer_float)
invalid("flow-fractional-level", "FlowchartResult", flow, ["spec", "nodes", 0, "level"], 0.5)
for date in ["2026-09-10T00:00:60Z", "2026-09-10T00:00:00+00:60", "0000-09-10T00:00:00Z"]:
    invalid("project-timestamp-" + date, "ProjectFile", project(flow, flow_layout), ["versions", 0, "created_at"], date)
(ROOT / "cases.json").write_text(json.dumps(cases, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"Wrote {len(cases)} synthetic cases")
