import { describe, it, expect } from 'vitest';
import { runCropLineEngine } from '../index';
import stormFixture from './fixtures/stormForecast.json';
import { DailyWeather } from '../types';

describe('CropLine Engine End-to-End Orchestration', () => {
  it('runs the complete engine seamlessly for a wheat farm experiencing a storm event at flowering', () => {
    const stormWeather = stormFixture as DailyWeather[];

    const result = runCropLineEngine({
      cropId: 'wheat',
      soilId: 'clay',
      sowingDate: '2025-11-15',
      currentDate: '2026-02-11',
      dailyWeather: stormWeather,
    });

    // 1. Timeline computed
    expect(result.timeline.crop.name).toBe('Wheat');
    expect(result.timeline.currentStage.id).toBe('flowering');

    // 2. Events extracted
    expect(result.events.length).toBeGreaterThan(0);
    const heavyRain = result.events.find((e) => e.type === 'heavy_rain');
    expect(heavyRain).toBeDefined();

    // 3. Collisions scored with clay modifier
    expect(result.collisions.length).toBeGreaterThan(0);
    const rainCollision = result.collisions.find((c) => c.event.type === 'heavy_rain');
    expect(rainCollision).toBeDefined();
    // In clay soil during flowering, heavy rain elevates to critical
    expect(rainCollision?.finalImpactLevel).toBe('critical');
    expect(rainCollision?.soilModifierApplied).toContain('Clay');

    // 4. Action windows generated
    expect(result.actionWindows.length).toBeGreaterThan(0);

    // 5. Plain language verdict composed
    expect(result.verdict.paragraph).toContain('wheat is at flowering');
    expect(result.verdict.ruleId).toBe('RULE_WHEAT_FLOWERING_HEAVY_RAIN');
    expect(result.verdict.decisionStrip.doToday.length).toBeGreaterThan(0);
    expect(result.verdict.decisionStrip.dontDo.length).toBeGreaterThan(0);
  });
});
