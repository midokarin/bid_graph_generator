"""Deterministic finish-to-start scheduling; offsets start at zero.

Decimal arithmetic prevents order-dependent floating-point accumulation. Rows
follow input task order; business feasibility is deliberately not judged here.
"""
from decimal import Decimal
from heapq import heapify, heappop, heappush
from .contracts import GanttSpec, ScheduledTask


def schedule(spec: GanttSpec) -> list[ScheduledTask]:
    tasks = {task.id: task for task in spec.tasks}
    incoming = dict.fromkeys(tasks, 0)
    following = {key: [] for key in tasks}
    starts = {key: Decimal(str(task.earliest_start or 0)) for key, task in tasks.items()}
    for edge in spec.dependencies:
        incoming[edge.target] += 1
        following[edge.source].append(edge)
    ready = [key for key in tasks if incoming[key] == 0]
    heapify(ready)
    ends = {}
    while ready:
        key = heappop(ready)
        ends[key] = starts[key] + Decimal(str(tasks[key].duration))
        for edge in following[key]:
            starts[edge.target] = max(starts[edge.target], ends[key] + Decimal(str(edge.lag)))
            incoming[edge.target] -= 1
            if incoming[edge.target] == 0:
                heappush(ready, edge.target)
    if len(ends) != len(tasks):
        raise ValueError('gantt dependency cycle')
    return [ScheduledTask(id=task.id, start=float(starts[task.id]), end=float(ends[task.id]), row=row)
            for row, task in enumerate(spec.tasks)]
