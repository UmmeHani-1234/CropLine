import { describe, it, expect } from 'vitest';
import { ActionWindowFinder } from '../actionWindowFinder';
import { StageEngine } from '../stageEngine';
import sprayFixture from './fixtures/sprayWindowForecast.json';
import stormFixture from './fixtures/stormForecast.json';
import { DailyWeather } from '../types';

describe('ActionWindowFinder', () => {
  it('identifies optimal spraying window from hourly forecast with safe wind and no rain', () => {
    const sprayWeather = sprayFixture as unknown as DailyWeather[];

    const timeline = StageEngine.buildTimeline({
      sowingDate: '2025-12-01',
      currentDate: '2026-02-18',
      dailyWeather: sprayWeather,
      seasonalAvgDailyGdd: 12.0,
    });

    const windows = ActionWindowFinder.findActionWindows({
      timeline,
      dailyWeather: sprayWeather,
    });

    const sprayWindow = windows.find((w) => w.type === 'spray');
    expect(sprayWindow).toBeDefined();
    if (sprayWindow) {
      expect(sprayWindow.category).toBe('do_today');
      expect(sprayWindow.suitabilityScore).toBeGreaterThanOrEqual(80);
      expect(sprayWindow.description).toContain('Wind < 15 km/h');
    }
  });

  it('triggers Skip Irrigation recommendation when significant rain is incoming', () => {
    const stormWeather = stormFixture as DailyWeather[];

    const timeline = StageEngine.buildTimeline({
      sowingDate: '2025-12-01',
      currentDate: '2026-02-11',
      dailyWeather: stormWeather,
      seasonalAvgDailyGdd: 12.0,
    });

    const windows = ActionWindowFinder.findActionWindows({
      timeline,
      dailyWeather: stormWeather,
    });

    const irrigateSkip = windows.find((w) => w.type === 'irrigate_skip');
    expect(irrigateSkip).toBeDefined();
    if (irrigateSkip) {
      expect(irrigateSkip.category).toBe('dont_do');
      expect(irrigateSkip.title).toBe('Skip Irrigation');
      expect(irrigateSkip.urgency).toBe('high');
    }

    const fertHold = windows.find((w) => w.type === 'fertilize' && w.category === 'dont_do');
    expect(fertHold).toBeDefined();
  });
});
