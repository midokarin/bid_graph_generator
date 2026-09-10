import json
from pathlib import Path
import unittest
from app.domain.contracts import GanttResult, GanttSpec
from app.domain.scheduling import schedule


class SchedulingTests(unittest.TestCase):
    def test_units_parallel_lead_lag_milestones_and_determinism(self):
        data = json.loads((Path(__file__).parents[2] / 'packages/contracts/examples/gantt.json').read_text())
        for unit in ['calendar_day', 'week', 'month']:
            data['spec']['time_unit'] = unit
            spec = GanttResult.model_validate(data).spec
            first = schedule(spec)
            self.assertEqual(first, schedule(spec))
            self.assertEqual([(t.id, t.start, t.end, t.row) for t in first],
                [('t1', 0, 3, 0), ('t2', 2, 7, 1), ('t3', 4, 6, 2), ('m1', 7, 7, 3), ('m2', 7, 7, 4)])
            reverse = spec.model_copy(update={'dependencies': list(reversed(spec.dependencies))})
            self.assertEqual(first, schedule(reverse))

    def test_earliest_fractional_and_cycle(self):
        spec = GanttSpec.model_validate({'schema_version':'1.0','diagram_type':'gantt','title':'测试','time_unit':'week',
            'tasks':[{'id':str(i), 'text':'任务','kind':'task','duration':0.1,'earliest_start':0.1 if i == 0 else None} for i in range(3)],
            'dependencies':[{'id':str(i),'source':str(i),'target':str(i+1),'type':'FS','lag':0.0} for i in range(2)]})
        self.assertEqual([t.end for t in schedule(spec)], [0.2, 0.3, 0.4])
        raw=spec.model_dump()
        raw['dependencies'].append({'id':'cycle','source':'2','target':'0','type':'FS','lag':0.0})
        with self.assertRaises(ValueError): GanttSpec.model_validate(raw)
