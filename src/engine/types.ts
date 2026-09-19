/**
 * CropLine Core Domain Types
 */

export type ImpactLevel = 'beneficial' | 'none' | 'low' | 'medium' | 'high' | 'critical';
export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type EventType = 'heavy_rain' | 'moderate_rain' | 'light_rain' | 'dry_spell' | 'heat' | 'cold';
export type SensitivityLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface CropStage {
  id: string;
  name: string;
  shortName: string;
  description: string;
  startGdd: number;
  endGdd: number;
  waterSensitivity: SensitivityLevel;
  heatSensitivity: SensitivityLevel;
  coldSensitivity: SensitivityLevel;
  lodgingSensitivity: SensitivityLevel;
  source: string;
  verified: boolean;
}

export interface CropDefinition {
  id: string;
  name: string;
  scientificName: string;
  version: string;
  baseTemperature: number;
  optimalTemperature: {
    min: number;
    max: number;
  };
  maxTemperature: number;
  frostThreshold: number;
  source: string;
  verified: boolean;
  stages: CropStage[];
}

export interface SoilType {
  id: string;
  name: string;
  description: string;
  waterHoldingCapacityMmPerMeter: number;
  infiltrationRateMmPerHour: number;
  waterloggingRiskModifier: number; // +1 (worse waterlogging) to -2 (fast drainage)
  droughtRiskModifier: number; // +2 (rapid drying) to -1 (slow drying)
  rainThresholdMultiplier: number; // < 1.0 lowers heavy rain threshold
  drySpellThresholdDaysModifier: number;
  source: string;
  verified: boolean;
}

export interface RainClass {
  id: string;
  name: string;
  minMm: number;
  maxMm: number;
  description: string;
}

export interface HourlyWeather {
  time: string; // ISO string e.g. "2026-03-20T06:00:00"
  temperature: number; // °C
  precipitation: number; // mm
  precipitationProbability: number; // 0-100%
  windSpeed: number; // km/h
  relativeHumidity: number; // %
  weatherCode?: number;
}

export interface DailyWeather {
  date: string; // "YYYY-MM-DD"
  tMax: number;
  tMin: number;
  precipitationSum: number;
  precipitationProbabilityMax?: number;
  windSpeedMax?: number;
  relativeHumidityMean?: number;
  hourly?: HourlyWeather[];
  isHistorical: boolean;
}

export interface StageProjection {
  stage: CropStage;
  startDate: string;
  endDate: string;
  startGdd: number;
  endGdd: number;
  isCurrent: boolean;
  isPast: boolean;
  isFuture: boolean;
  daysRemaining?: number;
}

export interface DailyGddPoint {
  date: string;
  dailyGdd: number;
  cumulativeGdd: number;
  stageId: string;
  stageName: string;
  isHistorical: boolean;
  tMax: number;
  tMin: number;
  precipitation: number;
}

export interface CropTimeline {
  crop: CropDefinition;
  sowingDate: string;
  currentDate: string;
  calibrationOffsetDays: number;
  accumulatedGddToday: number;
  currentStage: CropStage;
  stageProgressPercent: number;
  allStages: StageProjection[];
  dailyGddSeries: DailyGddPoint[];
  unverifiedAgronomy: boolean;
}

export interface WeatherEvent {
  id: string;
  type: EventType;
  name: string;
  startDate: string;
  endDate: string;
  peakDate: string;
  totalAmount: number; // mm for rain, days for dry spell, peak temp for heat
  peakValue: number;
  probability: number;
  confidence: ConfidenceLevel;
  summary: string;
  unit: string;
}

export interface CollisionResult {
  event: WeatherEvent;
  stage: CropStage;
  baseImpactLevel: ImpactLevel;
  finalImpactLevel: ImpactLevel;
  severityScore: number; // -5 to +5
  soilModifierApplied?: string;
  ruleId: string;
  headline: string;
  description: string;
  advisory: string;
  isBeneficial: boolean;
  unverifiedAgronomy: boolean;
}

export interface ActionWindow {
  id: string;
  type: 'spray' | 'fertilize' | 'harvest' | 'irrigate_skip' | 'irrigate_due' | 'frost_protect' | 'heat_mitigate';
  category: 'do_today' | 'dont_do' | 'wait_for';
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  suitabilityScore: number; // 0 to 100
  urgency: 'low' | 'medium' | 'high';
  ruleId: string;
}

export interface DecisionItem {
  id: string;
  text: string;
  icon: string;
  priority: number;
  actionWindowId?: string;
  ruleId: string;
}

export interface DecisionStrip {
  doToday: DecisionItem[];
  dontDo: DecisionItem[];
  waitFor: DecisionItem[];
}

export interface VerdictNumbers {
  eventAmount?: string;
  timingText?: string;
  windSpeed?: string;
  temperature?: string;
  probabilityText?: string;
}

export interface Verdict {
  cropName: string;
  stageName: string;
  stageShortName: string;
  primaryImpactLevel: ImpactLevel;
  headline: string;
  paragraph: string;
  ruleId: string;
  confidence: ConfidenceLevel;
  numbers: VerdictNumbers;
  decisionStrip: DecisionStrip;
  unverifiedAgronomy: boolean;
  i18nKey: string;
}

export interface FarmProfile {
  farmName: string;
  cropId: string;
  soilId: string;
  sowingDate: string;
  latitude: number;
  longitude: number;
  drainageQuality?: 'poor' | 'moderate' | 'good' | 'excellent';
  farmSizeAcres?: number;
}
