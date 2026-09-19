import { describe, it, expect } from 'vitest';
import { VerdictWriter } from '../verdictWriter';
import { StageEngine } from '../stageEngine';
import { CollisionScorer } from '../collisionScorer';
import { ActionWindowFinder } from '../actionWindowFinder';
import { AgronomyDataLoader } from '../dataLoader';
import stormFixture from './fixtures/stormForecast.json';
import { DailyWeather, WeatherEvent } from '../types';

describe('VerdictWriter', () => {
  it('composes a plain-language verdict paragraph with stage, numbers, confidence, and ruleId', () => {
    const stormWeather = stormFixture as DailyWeather[];

    // Wheat at Flowering (~1000 GDD)
    const timeline = StageEngine.buildTimeline({
      sowingDate: '2025-11-15',
      currentDate: '2026-02-11',
      dailyWeather: stormWeather,
      seasonalAvgDailyGdd: 11.5,
    });
    expect(timeline.currentStage.id).toBe('flowering');

    const heavyRainEvent: WeatherEvent = {
      id: 'rain_storm',
      type: 'heavy_rain',
      name: 'Heavy Rain Event',
      startDate: '2026-02-12',
      endDate: '2026-02-14',
      peakDate: '2026-02-13',
      totalAmount: 108.5,
      peakValue: 78.5,
      probability: 95,
      confidence: 'high',
      summary: 'Heavy Rain of 108.5 mm',
      unit: 'mm',
    };

    const collision = CollisionScorer.scoreEventCollision({
      event: heavyRainEvent,
      timeline,
      soil: AgronomyDataLoader.getSoil('loam'),
    });

    const actionWindows = ActionWindowFinder.findActionWindows({
      timeline,
      dailyWeather: stormWeather,
    });

    const verdict = VerdictWriter.composeVerdict({
      timeline,
      collisions: [collision],
      actionWindows,
    });

    expect(verdict.cropName).toBe('Wheat');
    expect(verdict.stageShortName).toBe('Flowering');
    expect(verdict.primaryImpactLevel).toBe('high');
    expect(verdict.ruleId).toBe('RULE_WHEAT_FLOWERING_HEAVY_RAIN');
    expect(verdict.confidence).toBe('high');
    expect(verdict.paragraph).toContain('wheat is at flowering');
    expect(verdict.paragraph).toContain('78.5-108.5 mm');
    expect(verdict.paragraph).toContain('high confidence');
    expect(verdict.paragraph).toContain('pollen');

    // Decision Strip groups
    expect(verdict.decisionStrip.doToday.length).toBeGreaterThan(0);
    expect(verdict.decisionStrip.dontDo.length).toBeGreaterThan(0);
    expect(verdict.decisionStrip.waitFor.length).toBeGreaterThan(0);

    // Shows unverified badge indicator
    expect(verdict.unverifiedAgronomy).toBe(true);
  });
});
