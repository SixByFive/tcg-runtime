import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

// @fontsource ships .woff files, which satori can read (it cannot read woff2).
const fontsDir = path.join(path.dirname(require.resolve('@fontsource/inter/package.json')), 'files');

const WEIGHTS = [400, 700, 800, 900];

let cached = null;

export function getFonts() {
  if (cached) return cached;
  cached = WEIGHTS.map((weight) => ({
    name: 'Inter',
    weight,
    style: 'normal',
    data: fs.readFileSync(path.join(fontsDir, `inter-latin-${weight}-normal.woff`)),
  }));
  return cached;
}
