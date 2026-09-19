export * from './types';
export * from './dataLoader';
export * from './stageEngine';
export * from './eventExtractor';
export * from './collisionScorer';
export * from './actionWindowFinder';
export * from './verdictWriter';

import { DailyWeather, SoilType, CropTimeline, WeatherEvent, CollisionResult, ActionWindow, Verdict } from './types';
import { AgronomyDataLoader } from './dataLoader';
import { StageEngine } from './stageEngine';
import { EventExtractor } from './eventExtractor';
import { CollisionScorer } from './collisionScorer';
import { ActionWindowFinder } from './actionWindowFinder';
import { VerdictWriter } from './verdictWriter';

export interface CropLineEngineOutput {
  timeline: CropTimeline;
  events: WeatherEvent[];
  collisions: CollisionResult[];
  actionWindows: ActionWindow[];
  verdict: Verdict;
  soil: SoilType;
}

/**
 * High-level orchestration function to run the complete CropLine engine.
 */
export function runCropLineEngine(params: {
  cropId?: string;
  soilId?: string;
  sowingDate: string; // "YYYY-MM-DD"
  currentDate: string; // "YYYY-MM-DD"
  dailyWeather: DailyWeather[];
  calibrationOffsetDays?: number;
}): CropLineEngineOutput {
  const cropId = params.cropId || 'wheat';
  const soil = AgronomyDataLoader.getSoil(params.soilId || 'loam');

  // 1. Stage Engine
  const timeline = StageEngine.buildTimeline({
    cropId,
    sowingDate: params.sowingDate,
    currentDate: params.currentDate,
    dailyWeather: params.dailyWeather,
    calibrationOffsetDays: params.calibrationOffsetDays,
  });

  // 2. Event Extractor
  const events = EventExtractor.extractEvents(params.dailyWeather);

  // 3. Collision Scorer
  const collisions = CollisionScorer.scoreAllCollisions({
    events,
    timeline,
    soil,
  });

  // 4. Action Window Finder
  const actionWindows = ActionWindowFinder.findActionWindows({
    timeline,
    dailyWeather: params.dailyWeather,
    soil,
  });

  // 5. Verdict Writer
  const verdict = VerdictWriter.composeVerdict({
    timeline,
    collisions,
    actionWindows,
  });

  return {
    timeline,
    events,
    collisions,
    actionWindows,
    verdict,
    soil,
  };
}
