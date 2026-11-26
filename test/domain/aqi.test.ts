import { describe, expect, it } from 'vitest';
import { BAND_IDS, bandFor, bandRank, naqi, subIndex } from '../../src/domain/aqi';

describe('subIndex', () => {
  it.each([
    [0, 0],
    [30, 50],
    [45, 75],
    [60, 100],
    [90, 200],
    [120, 300],
    [250, 400],
    [380, 500],
  ])('maps PM2.5 %d µg/m³ to %d on the CPCB scale', (concentration, index) => {
    expect(subIndex('pm2_5', concentration)).toBe(index);
  });

  it('uses the PM10 breakpoints for PM10', () => {
    expect(subIndex('pm10', 100)).toBe(100);
    expect(subIndex('pm10', 300)).toBe(250);
  });

  it('caps readings above the top breakpoint at 500 and treats negatives as zero', () => {
    expect(subIndex('pm2_5', 900)).toBe(500);
    expect(subIndex('pm10', -5)).toBe(0);
  });
});

describe('naqi', () => {
  it('reports the worse of the two pollutants', () => {
    expect(naqi({ pm2_5: 30, pm10: 300 })).toBe(250);
    expect(naqi({ pm2_5: 200, pm10: 20 })).toBe(362);
  });
});

describe('bandFor', () => {
  it.each([
    [0, 'good'],
    [50, 'good'],
    [51, 'satisfactory'],
    [150, 'moderate'],
    [201, 'poor'],
    [301, 'very-poor'],
    [401, 'severe'],
    [500, 'severe'],
  ])('puts index %d in band %s', (index, id) => {
    expect(bandFor(index).id).toBe(id);
  });

  it('falls back to Good for impossible negative values', () => {
    expect(bandFor(-1).id).toBe('good');
  });

  it('carries the CPCB health message with each band', () => {
    expect(bandFor(450).health).toMatch(/healthy people/u);
  });
});

describe('bandRank', () => {
  it('orders bands from good to severe', () => {
    expect(BAND_IDS.map(bandRank)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
