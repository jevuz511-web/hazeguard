/**
 * India's National Air Quality Index (CPCB, 2014) computed from particulate readings.
 * Each pollutant maps to a sub-index by linear interpolation between breakpoints; the
 * reported index is the worst sub-index, capped at 500.
 */

/** The six NAQI categories, mildest first. */
export const BAND_IDS = [
  'good',
  'satisfactory',
  'moderate',
  'poor',
  'very-poor',
  'severe',
] as const;

/** One NAQI category name. */
export type BandId = (typeof BAND_IDS)[number];

/** A NAQI category with its index range and the CPCB health message. */
export interface Band {
  readonly id: BandId;
  readonly label: string;
  readonly floor: number;
  readonly health: string;
}

/** Particulate concentrations in micrograms per cubic metre. */
export interface Particulates {
  readonly pm2_5: number;
  readonly pm10: number;
}

type Breakpoint = readonly [concentration: number, index: number];

/** CPCB breakpoints as (µg/m³, index) pairs; the top pair is the interpolation ceiling. */
const BREAKPOINTS: Record<keyof Particulates, readonly Breakpoint[]> = {
  pm2_5: [
    [0, 0],
    [30, 50],
    [60, 100],
    [90, 200],
    [120, 300],
    [250, 400],
    [380, 500],
  ],
  pm10: [
    [0, 0],
    [50, 50],
    [100, 100],
    [250, 200],
    [350, 300],
    [430, 400],
    [510, 500],
  ],
};

const BANDS: readonly [Band, ...Band[]] = [
  { id: 'good', label: 'Good', floor: 0, health: 'Minimal impact.' },
  {
    id: 'satisfactory',
    label: 'Satisfactory',
    floor: 51,
    health: 'Minor breathing discomfort for sensitive people.',
  },
  {
    id: 'moderate',
    label: 'Moderate',
    floor: 101,
    health:
      'Breathing discomfort for people with lung or heart disease, children and older adults.',
  },
  {
    id: 'poor',
    label: 'Poor',
    floor: 201,
    health: 'Breathing discomfort for most people on prolonged exposure.',
  },
  {
    id: 'very-poor',
    label: 'Very poor',
    floor: 301,
    health: 'Respiratory illness on prolonged exposure.',
  },
  {
    id: 'severe',
    label: 'Severe',
    floor: 401,
    health: 'Affects healthy people and seriously affects those with existing disease.',
  },
];

/** Sub-index (0 to 500) for one pollutant concentration. */
export function subIndex(pollutant: keyof Particulates, concentration: number): number {
  const reading = Math.max(0, concentration);
  let previous: Breakpoint = [0, 0];
  for (const point of BREAKPOINTS[pollutant]) {
    const [high, indexHigh] = point;
    if (reading <= high) {
      const [low, indexLow] = previous;
      const span = high - low;
      return span === 0
        ? indexHigh
        : Math.round(indexLow + ((reading - low) * (indexHigh - indexLow)) / span);
    }
    previous = point;
  }
  return 500;
}

/** The NAQI value for a pair of particulate readings. */
export function naqi(sample: Particulates): number {
  return Math.max(subIndex('pm2_5', sample.pm2_5), subIndex('pm10', sample.pm10));
}

/** The NAQI category an index value falls in. */
export function bandFor(index: number): Band {
  return BANDS.findLast((band) => index >= band.floor) ?? BANDS[0];
}

/** Position of a band on the scale (0 = good, 5 = severe), for comparisons. */
export function bandRank(id: BandId): number {
  return BAND_IDS.indexOf(id);
}
