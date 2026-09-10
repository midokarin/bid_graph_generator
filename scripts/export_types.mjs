import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { compile } from 'json-schema-to-typescript';

const source = new URL('../packages/contracts/schemas/', import.meta.url);
const target = new URL('../frontend/src/domain/generated/', import.meta.url);
await mkdir(target, { recursive: true });
for (const file of (await readdir(source)).sort()) {
  const schema = JSON.parse(await readFile(new URL(file, source), 'utf8'));
  const text = await compile(schema, file.replace('.json', ''), {
    bannerComment: '/* Generated from Pydantic JSON Schema. Do not edit. */',
    additionalProperties: false,
  });
  const path = new URL(file.replace('.json', '.ts'), target);
  if (process.argv.includes('--check')) {
    if (await readFile(path, 'utf8') !== text) throw new Error(`Type drift: ${file}. Run npm run contracts.`);
  } else await writeFile(path, text);
}
console.log('Generated TypeScript contracts: OK');
