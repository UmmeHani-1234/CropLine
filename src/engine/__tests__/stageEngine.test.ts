import { describe, it, expect } from 'vitest';
import { StageEngine } from '../stageEngine';
import { AgronomyDataLoader } from '../dataLoader';
import coldSeasonData from './fixtures/coldSeasonWeather.json';
import warmSeasonData from './fixtures/warmSeasonWeather.json';
import { DailyWeather } from '../types';

describe('StageEngine', () => {
  const wheat = AgronomyDataLoader.getCrop('wheat');

  it('calculates daily GDD correctly with base temperature 4.5°C', () => {
    // (24 + 10)/2 - 4.5 = 17 - 4.5 = 12.5
    const gdd1 = StageEngine.calculateDailyGDD(24.0, 10.0, 4.5);
    expect(gdd1).toBe(12.5);

    // Negative GDD is clamped to 0
    const gddZero = StageEngine.calculateDailyGDD(4.0, 2.0, 4.5);
    expect(gddZero).toBe(0);
  });

  it('demonstrates cold season delays stages vs warm season', () => {
    const coldWeather = coldSeasonData as DailyWeather[];
    const warmWeather = warmSeasonData as DailyWeather[];

    const coldTimeline = StageEngine.buildTimeline({
      cropId: 'wheat',
      sowingDate: '2025-11-01',
      currentDate: '2025-11-30',
      dailyWeather: coldWeather,
    });

    const warmTimeline = StageEngine.buildTimeline({
      cropId: 'wheat',
      sowingDate: '2025-11-01',
      currentDate: '2025-11-30',
      dailyWeather: warmWeather,
    });

    // Warm season accumulates much more GDD over the 30-day period
    expect(warmTimeline.accumulatedGddToday).toBeGreaterThan(coldTimeline.accumulatedGddToday);

    // Cold season is still in Sowing/Emergence or early CRI, while warm season has advanced further
    const coldStage = coldTimeline.currentStage;
    const warmStage = warmTimeline.currentStage;

    expect(coldStage.startGdd).toBeLessThanOrEqual(warmStage.startGdd);
    expect(coldTimeline.accumulatedGddToday).toBeLessThan(200); // Cold slow start
    expect(warmTimeline.accumulatedGddToday).toBeGreaterThan(350); // Warm advanced start
  });

  it('projects future stage timeline correctly', () => {
    const warmWeather = warmSeasonData as DailyWeather[];
    const timeline = StageEngine.buildTimeline({
      cropId: 'wheat',
      sowingDate: '2025-11-01',
      currentDate: '2025-11-15',
      dailyWeather: warmWeather,
    });

    expect(timeline.allStages.length).toBe(wheat.stages.length);
    expect(timeline.allStages[0].startDate).toBe('2025-11-01');

    // Stage progression is chronological
    for (let i = 0; i < timeline.allStages.length - 1; i++) {
      expect(timeline.allStages[i].startDate <= timeline.allStages[i + 1].startDate).toBe(true);
    }
  });

  it('shifts timeline when calibration offset is applied (ahead/behind farm)', () => {
    const warmWeather = warmSeasonData as DailyWeather[];

    const onTrack = StageEngine.buildTimeline({
      sowingDate: '2025-11-01',
      currentDate: '2025-11-20',
      dailyWeather: warmWeather,
      calibrationOffsetDays: 0,
    });

    const fiveDaysBehind = StageEngine.buildTimeline({
      sowingDate: '2025-11-01',
      currentDate: '2025-11-20',
      dailyWeather: warmWeather,
      calibrationOffsetDays: -5,
    });

    const fiveDaysAhead = StageEngine.buildTimeline({
      sowingDate: '2025-11-01',
      currentDate: '2025-11-20',
      dailyWeather: warmWeather,
      calibrationOffsetDays: 5,
    });

    // Behind has lower accumulated GDD on the same calendar day
    expect(fiveDaysBehind.accumulatedGddToday).toBeLessThan(onTrack.accumulatedGddToday);
    // Ahead has higher accumulated GDD
    expect(fiveDaysAhead.accumulatedGddToday).toBeGreaterThan(onTrack.accumulatedGddToday);
  });
});
