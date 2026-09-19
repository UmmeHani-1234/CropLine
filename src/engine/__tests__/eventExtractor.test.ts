import { describe, it, expect } from 'vitest';
import { EventExtractor } from '../eventExtractor';
import stormForecastData from './fixtures/stormForecast.json';
import drySpellData from './fixtures/drySpellForecast.json';
import { DailyWeather } from '../types';

describe('EventExtractor', () => {
  it('extracts heavy rain event with correct amounts, peak date, and high confidence', () => {
    const stormWeather = stormForecastData as DailyWeather[];
    const events = EventExtractor.extractEvents(stormWeather);

    expect(events.length).toBeGreaterThan(0);
    const rainEvent = events.find((e) => e.type === 'heavy_rain');
    expect(rainEvent).toBeDefined();

    if (rainEvent) {
      expect(rainEvent.totalAmount).toBeGreaterThanOrEqual(78.5);
      expect(rainEvent.peakValue).toBe(78.5);
      expect(rainEvent.peakDate).toBe('2026-02-13');
      expect(rainEvent.startDate).toBe('2026-02-12');
      expect(rainEvent.endDate).toBe('2026-02-14');
      expect(rainEvent.confidence).toBe('high');
      expect(rainEvent.unit).toBe('mm');
    }
  });

  it('extracts extended dry spell and heat wave from dry spell forecast', () => {
    const dryWeather = drySpellData as DailyWeather[];
    const events = EventExtractor.extractEvents(dryWeather);

    const drySpellEvent = events.find((e) => e.type === 'dry_spell');
    expect(drySpellEvent).toBeDefined();
    if (drySpellEvent) {
      expect(drySpellEvent.totalAmount).toBe(7); // 7 continuous days
      expect(drySpellEvent.confidence).toBe('high');
      expect(drySpellEvent.unit).toBe('days');
    }

    const heatEvent = events.find((e) => e.type === 'heat');
    expect(heatEvent).toBeDefined();
    if (heatEvent) {
      expect(heatEvent.peakValue).toBe(36.0);
      expect(heatEvent.peakDate).toBe('2026-03-04');
    }
  });

  it('extracts cold event when temperatures drop below 4°C', () => {
    const coldDays: DailyWeather[] = [
      { date: '2026-01-05', tMax: 12, tMin: 5, precipitationSum: 0, isHistorical: false },
      { date: '2026-01-06', tMax: 10, tMin: 2.5, precipitationSum: 0, isHistorical: false },
      { date: '2026-01-07', tMax: 11, tMin: 1.8, precipitationSum: 0, isHistorical: false },
      { date: '2026-01-08', tMax: 14, tMin: 6, precipitationSum: 0, isHistorical: false },
    ];

    const events = EventExtractor.extractEvents(coldDays);
    const coldEvent = events.find((e) => e.type === 'cold');
    expect(coldEvent).toBeDefined();
    if (coldEvent) {
      expect(coldEvent.peakValue).toBe(1.8);
      expect(coldEvent.peakDate).toBe('2026-01-07');
      expect(coldEvent.name).toBe('Ground Frost Warning');
    }
  });
});
