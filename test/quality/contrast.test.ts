import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const CSS = readFileSync('web/styles/tokens.css', 'utf8');

/** Custom properties declared in a block of CSS. */
function tokens(block: string): Record<string, string> {
  const pairs = block
    .split('\n')
    .map((line) => line.trim().replace(';', '').split(': '))
    .filter(([name = '', value = '']) => name.startsWith('--') && value.startsWith('#'))
    .map(([name = '', value = '']): [string, string] => [name.slice(2), value]);
  return Object.fromEntries(pairs);
}

const light = tokens(CSS.slice(0, CSS.indexOf('@media')));
const dark = { ...light, ...tokens(CSS.slice(CSS.indexOf('@media'))) };

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.040_45 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function ratio(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high! + 0.05) / (low! + 0.05);
}

const BANDS = ['good', 'satisfactory', 'moderate', 'poor', 'very-poor', 'severe'];
const TEXT_PAIRS = [
  ['ink', 'paper'],
  ['ink', 'surface'],
  ['muted', 'paper'],
  ['muted', 'surface'],
  ['accent', 'paper'],
  ['accent', 'surface'],
  ['on-accent', 'accent'],
  ['error', 'surface'],
  ['error', 'paper'],
  ...BANDS.map((band) => ['ink', `band-${band}`]),
];
const GRAPHIC_PAIRS = [
  ['line', 'surface'],
  ['line', 'paper'],
  ['focus', 'paper'],
  ['focus', 'surface'],
  ...BANDS.map((band) => [`bar-${band}`, 'surface']),
];

describe.each([
  ['light', light],
  ['dark', dark],
])('%s colour scheme', (_scheme, palette) => {
  it.each(TEXT_PAIRS)('%s on %s meets WCAG AAA 7:1 for text', (fg, bg) => {
    expect(ratio(palette[fg]!, palette[bg]!)).toBeGreaterThanOrEqual(7);
  });

  it.each(GRAPHIC_PAIRS)('%s against %s meets 3:1 for non-text contrast', (fg, bg) => {
    expect(ratio(palette[fg]!, palette[bg]!)).toBeGreaterThanOrEqual(3);
  });
});
