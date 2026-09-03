// Le theme de l'espace organisateur ne vient pas des carnets : il doit donc
// garder son propre garde-fou de contraste, pour les modes clair et sombre.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './theme.js';

const ICI = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(join(ICI, '../styles.css'), 'utf8');

function colors(theme: 'light' | 'dark'): Record<string, string> {
  const block = CSS.match(new RegExp(`\\[data-host-theme='${theme}'\\] \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
  return Object.fromEntries(
    [...block.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)]
      .map(([, name, value]) => [name, value]),
  );
}

const PAIRS = [
  ['ink', 'pap'], ['ink-2', 'pap'], ['ink-3', 'pap'],
  ['ink', 'pap-2'], ['ink-2', 'pap-2'], ['ink-3', 'pap-2'],
  ['on-a1', 'a1'], ['ink-well', 'well'], ['ink-well-2', 'well'],
  ['danger', 'pap'], ['ok', 'pap'], ['warn', 'pap'],
] as const;

describe.each(['light', 'dark'] as const)('theme organisateur %s', (theme) => {
  it.each(PAIRS)('%s reste lisible sur %s', (foreground, background) => {
    const palette = colors(theme);
    expect(palette[foreground], `--color-${foreground} manque`).toBeDefined();
    expect(palette[background], `--color-${background} manque`).toBeDefined();
    expect(contrastRatio(palette[foreground]!, palette[background]!)).toBeGreaterThanOrEqual(4.5);
  });
});
