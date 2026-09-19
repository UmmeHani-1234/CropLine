import { describe, it, expect } from 'vitest';
import { CollisionScorer } from '../collisionScorer';
import { StageEngine } from '../stageEngine';
import { AgronomyDataLoader } from '../dataLoader';
import { WeatherEvent, DailyWeather } from '../types';

describe('CollisionScorer', () => {
  const wheat = AgronomyDataLoader.getCrop('wheat');
  const loamSoil = AgronomyDataLoader.getSoil('loam');
  const claySoil = AgronomyDataLoader.getSoil('clay');
  const sandSoil = AgronomyDataLoader.getSoil('sand');

  // Synthetic heavy rain event
  const heavyRainEvent: WeatherEvent = {
    id: 'heavy_rain_test',
    type: 'heavy_rain',
    name: 'Heavy Rain Event',
    startDate: '2026-02-10',
    endDate: '2026-02-11',
    peakDate: '2026-02-10',
    totalAmount: 75.0,
    peakValue: 65.0,
    probability: 90,
    confidence: 'high',
    summary: 'Heavy Rain of 75mm',
    unit: 'mm',
  };

  it('scores the exact same 75mm rain event differently at Tillering, Flowering, and Maturity', () => {
    // 1. Timeline at Tillering (~350 GDD)
    const tilleringWeather: DailyWeather[] = [
      { date: '2026-01-01', tMax: 20, tMin: 10, precipitationSum: 0, isHistorical: true },
      { date: '2026-02-10', tMax: 20, tMin: 10, precipitationSum: 75, isHistorical: false },
    ];
    // Sowing 30 days prior with ~11 GDD/day gives ~330 GDD (Tillering)
    const tilleringTimeline = StageEngine.buildTimeline({
      sowingDate: '2026-01-10',
      currentDate: '2026-02-10',
      dailyWeather: tilleringWeather,
      seasonalAvgDailyGdd: 11.0,
    });
    expect(tilleringTimeline.currentStage.id).toBe('tillering');

    const tilleringCollision = CollisionScorer.scoreEventCollision({
      event: heavyRainEvent,
      timeline: tilleringTimeline,
      soil: loamSoil,
    });
    expect(tilleringCollision.finalImpactLevel).toBe('medium');
    expect(tilleringCollision.ruleId).toBe('RULE_WHEAT_TILLERING_HEAVY_RAIN');

    // 2. Timeline at Flowering (~1000 GDD)
    // Sowing 90 days prior with ~11 GDD/day gives ~990 GDD (Flowering)
    const floweringTimeline = StageEngine.buildTimeline({
      sowingDate: '2025-11-12',
      currentDate: '2026-02-10',
      dailyWeather: tilleringWeather,
      seasonalAvgDailyGdd: 11.0,
    });
    expect(floweringTimeline.currentStage.id).toBe('flowering');

    const floweringCollision = CollisionScorer.scoreEventCollision({
      event: heavyRainEvent,
      timeline: floweringTimeline,
      soil: loamSoil,
    });
    expect(floweringCollision.finalImpactLevel).toBe('high');
    expect(floweringCollision.ruleId).toBe('RULE_WHEAT_FLOWERING_HEAVY_RAIN');

    // 3. Timeline at Maturity / Harvest (~1750 GDD)
    // Sowing 160 days prior gives ~1760 GDD (Maturity & Harvest)
    const harvestTimeline = StageEngine.buildTimeline({
      sowingDate: '2025-09-03',
      currentDate: '2026-02-10',
      dailyWeather: tilleringWeather,
      seasonalAvgDailyGdd: 11.0,
    });
    expect(harvestTimeline.currentStage.id).toBe('maturity_harvest');

    const harvestCollision = CollisionScorer.scoreEventCollision({
      event: heavyRainEvent,
      timeline: harvestTimeline,
      soil: loamSoil,
    });
    expect(harvestCollision.finalImpactLevel).toBe('critical');
    expect(harvestCollision.ruleId).toBe('RULE_WHEAT_MATURITY_HEAVY_RAIN');
  });

  it('modifies impact level based on soil type (Clay elevates waterlogging risk)', () => {
    const tilleringTimeline = StageEngine.buildTimeline({
      sowingDate: '2026-01-10',
      currentDate: '2026-02-10',
      dailyWeather: [],
      seasonalAvgDailyGdd: 11.0,
    });

    const loamResult = CollisionScorer.scoreEventCollision({
      event: heavyRainEvent,
      timeline: tilleringTimeline,
      soil: loamSoil,
    });

    const clayResult = CollisionScorer.scoreEventCollision({
      event: heavyRainEvent,
      timeline: tilleringTimeline,
      soil: claySoil,
    });

    // In loam, heavy rain at tillering is medium. In clay, waterlogging risk raises it to high.
    expect(loamResult.finalImpactLevel).toBe('medium');
    expect(clayResult.finalImpactLevel).toBe('high');
    expect(clayResult.soilModifierApplied).toContain('Clay');
  });

  it('evaluates beneficial rain correctly (moderate rain during vegetative tillering)', () => {
    const modRainEvent: WeatherEvent = {
      id: 'mod_rain_test',
      type: 'moderate_rain',
      name: 'Moderate Rain Shower',
      startDate: '2026-02-10',
      endDate: '2026-02-10',
      peakDate: '2026-02-10',
      totalAmount: 25.0,
      peakValue: 25.0,
      probability: 85,
      confidence: 'high',
      summary: 'Moderate rain of 25mm',
      unit: 'mm',
    };

    const tilleringTimeline = StageEngine.buildTimeline({
      sowingDate: '2026-01-10',
      currentDate: '2026-02-10',
      dailyWeather: [],
      seasonalAvgDailyGdd: 11.0,
    });

    const result = CollisionScorer.scoreEventCollision({
      event: modRainEvent,
      timeline: tilleringTimeline,
      soil: loamSoil,
    });

    expect(result.finalImpactLevel).toBe('beneficial');
    expect(result.isBeneficial).toBe(true);
    expect(result.severityScore).toBeLessThan(0);
    expect(result.headline).toBe('Beneficial Tillering Moisture');
  });

  it('re-scores impact when an ahead/behind shift alters the stage landing', () => {
    // Event fixed at 2026-02-15
    const stormEvent: WeatherEvent = {
      ...heavyRainEvent,
      startDate: '2026-02-15',
      endDate: '2026-02-15',
      peakDate: '2026-02-15',
    };

    // On track: on Feb 15, reaches Jointing & Booting (high impact for 75mm rain)
    const onTrackTimeline = StageEngine.buildTimeline({
      sowingDate: '2025-12-15',
      currentDate: '2026-02-01',
      dailyWeather: [],
      calibrationOffsetDays: 0,
      seasonalAvgDailyGdd: 12.0,
    });

    // 20 days behind: on Feb 15, still in Tillering (medium impact for 75mm rain in loam)
    const behindTimeline = StageEngine.buildTimeline({
      sowingDate: '2025-12-15',
      currentDate: '2026-02-01',
      dailyWeather: [],
      calibrationOffsetDays: -20,
      seasonalAvgDailyGdd: 12.0,
    });

    const onTrackScore = CollisionScorer.scoreEventCollision({
      event: stormEvent,
      timeline: onTrackTimeline,
      soil: loamSoil,
    });

    const behindScore = CollisionScorer.scoreEventCollision({
      event: stormEvent,
      timeline: behindTimeline,
      soil: loamSoil,
    });

    expect(onTrackScore.stage.id).toBe('jointing_booting');
    expect(onTrackScore.finalImpactLevel).toBe('high');

    expect(behindScore.stage.id).toBe('tillering');
    expect(behindScore.finalImpactLevel).toBe('medium');
  });
});
