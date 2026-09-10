import asyncio
import json
from pathlib import Path


class StubProvider:
    """Fixed synthetic examples: six node types / parallel tasks and milestones.

    Ignores business text. Shared fixtures contain no user or model data.
    """
    async def stream(self, messages, schema):
        kind = 'flowchart' if schema['title'] == 'FlowchartResult' else 'gantt'
        path = Path(__file__).resolve().parents[3] / 'packages/contracts/examples' / f'{kind}.json'
        result = json.loads(path.read_text(encoding='utf-8'))
        if kind == 'flowchart':
            result['spec']['direction'] = 'RIGHT' if '用户方向：RIGHT' in messages[0]['content'] else 'DOWN'
        raw = json.dumps(result, ensure_ascii=False)
        for offset in range(0, len(raw), 40):
            await asyncio.sleep(0.01)
            yield raw[offset:offset + 40]
