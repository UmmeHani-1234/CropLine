import { CropDefinition, CropStage, DailyWeather, StageProjection, DailyGddPoint, CropTimeline } from './types';
import { AgronomyDataLoader } from './dataLoader';

export class StageEngine {
  /**
   * Calculate Growing Degree Days (GDD) for a single day.
   * GDD = max(0, ((Tmax + Tmin) / 2) - Tbase)
   */
  public static calculateDailyGDD(tMax: number, tMin: number, baseTemp: number, maxTemp: number = 35.0): number {
    // Cap effective max temperature at crop upper threshold
    const effectiveTmax = Math.min(tMax, maxTemp);
    const meanTemp = (effectiveTmax + tMin) / 2;
    const gdd = meanTemp - baseTemp;
    return Math.max(0, Number(gdd.toFixed(2)));
  }

  /**
   * Find the active crop stage given accumulated GDD.
   */
  public static getStageForGdd(crop: CropDefinition, cumulativeGdd: number): CropStage {
    const stages = crop.stages;
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      if (cumulativeGdd >= stage.startGdd && cumulativeGdd < stage.endGdd) {
        return stage;
      }
    }
    // If accumulated GDD exceeds the last stage, return final harvest stage
    return stages[stages.length - 1];
  }

  /**
   * Build complete crop timeline from sowing date across weather history, forecast, and seasonal projection.
   */
  public static buildTimeline(params: {
    cropId?: string;
    sowingDate: string; // "YYYY-MM-DD"
    currentDate: string; // "YYYY-MM-DD"
    dailyWeather: DailyWeather[]; // Sorted by date ascending
    calibrationOffsetDays?: number; // + ahead, - behind
    seasonalAvgDailyGdd?: number; // fallback GDD/day for days beyond forecast
  }): CropTimeline {
    const crop = AgronomyDataLoader.getCrop(params.cropId || 'wheat');
    const calibrationOffset = params.calibrationOffsetDays || 0;
    const baseTemp = crop.baseTemperature;
    const maxTemp = crop.maxTemperature;
    const seasonalAvgGdd = params.seasonalAvgDailyGdd || 12.0;

    // Filter or sort weather records starting from sowing date
    const weatherMap = new Map<string, DailyWeather>();
    params.dailyWeather.forEach((dw) => weatherMap.set(dw.date, dw));

    const sowing = new Date(params.sowingDate);
    const current = new Date(params.currentDate);

    // Apply calibration offset if any (shifting virtual sowing date or GDD)
    const effectiveSowing = new Date(sowing);
    // If farm is 5 days ahead, it's equivalent to sowing 5 days earlier
    effectiveSowing.setDate(effectiveSowing.getDate() - calibrationOffset);

    const dailyGddSeries: DailyGddPoint[] = [];
    let cumulativeGdd = 0;
    let accumulatedGddToday = 0;

    // We project up to 200 days from sowing or until maturity is reached (endGdd of last stage)
    const maxSeasonDays = 220;
    const lastStageEndGdd = crop.stages[crop.stages.length - 1].endGdd;

    const iterDate = new Date(effectiveSowing);
    let dayCount = 0;

    while (dayCount < maxSeasonDays && cumulativeGdd < lastStageEndGdd + 50) {
      const dateStr = iterDate.toISOString().split('T')[0];
      const isHistorical = iterDate <= current;

      const weather = weatherMap.get(dateStr);
      let tMax = 22;
      let tMin = 8;
      let precipitation = 0;
      let dailyGdd = seasonalAvgGdd;

      if (weather) {
        tMax = weather.tMax;
        tMin = weather.tMin;
        precipitation = weather.precipitationSum;
        dailyGdd = this.calculateDailyGDD(tMax, tMin, baseTemp, maxTemp);
      }

      cumulativeGdd += dailyGdd;
      const currentStage = this.getStageForGdd(crop, cumulativeGdd);

      dailyGddSeries.push({
        date: dateStr,
        dailyGdd,
        cumulativeGdd: Number(cumulativeGdd.toFixed(2)),
        stageId: currentStage.id,
        stageName: currentStage.name,
        isHistorical,
        tMax,
        tMin,
        precipitation,
      });

      if (dateStr === params.currentDate) {
        accumulatedGddToday = cumulativeGdd;
      }

      iterDate.setDate(iterDate.getDate() + 1);
      dayCount++;
    }

    // Fallback if currentDate wasn't reached
    if (accumulatedGddToday === 0 && dailyGddSeries.length > 0) {
      const point = dailyGddSeries.find((p) => p.date === params.currentDate);
      accumulatedGddToday = point ? point.cumulativeGdd : dailyGddSeries[0].cumulativeGdd;
    }

    const currentStage = this.getStageForGdd(crop, accumulatedGddToday);
    const stageSpan = currentStage.endGdd - currentStage.startGdd;
    const progressInStage = Math.max(0, Math.min(100, ((accumulatedGddToday - currentStage.startGdd) / stageSpan) * 100));

    // Calculate Stage Projections (start and end dates for each stage)
    const allStages: StageProjection[] = crop.stages.map((stage) => {
      // Find first day where cumulativeGdd >= stage.startGdd
      const startPoint = dailyGddSeries.find((p) => p.cumulativeGdd >= stage.startGdd) || dailyGddSeries[0];
      // Find last day where cumulativeGdd < stage.endGdd
      const endPoints = dailyGddSeries.filter((p) => p.cumulativeGdd < stage.endGdd);
      const endPoint = endPoints.length > 0 ? endPoints[endPoints.length - 1] : dailyGddSeries[dailyGddSeries.length - 1];

      const startDate = startPoint ? startPoint.date : params.sowingDate;
      const endDate = endPoint ? endPoint.date : startDate;

      const isCurrent = stage.id === currentStage.id;
      const isPast = accumulatedGddToday >= stage.endGdd;
      const isFuture = accumulatedGddToday < stage.startGdd;

      let daysRemaining: number | undefined;
      if (isCurrent && endPoint) {
        const endD = new Date(endPoint.date);
        const curD = new Date(params.currentDate);
        daysRemaining = Math.max(0, Math.round((endD.getTime() - curD.getTime()) / (1000 * 60 * 60 * 24)));
      }

      return {
        stage,
        startDate,
        endDate,
        startGdd: stage.startGdd,
        endGdd: stage.endGdd,
        isCurrent,
        isPast,
        isFuture,
        daysRemaining,
      };
    });

    const unverifiedAgronomy = !AgronomyDataLoader.isAgronomyVerified(crop.id);

    return {
      crop,
      sowingDate: params.sowingDate,
      currentDate: params.currentDate,
      calibrationOffsetDays: calibrationOffset,
      accumulatedGddToday: Number(accumulatedGddToday.toFixed(2)),
      currentStage,
      stageProgressPercent: Number(progressInStage.toFixed(1)),
      allStages,
      dailyGddSeries,
      unverifiedAgronomy,
    };
  }

  /**
   * Get the active stage for any given date within the timeline.
   */
  public static getStageOnDate(timeline: CropTimeline, dateStr: string): CropStage {
    const point = timeline.dailyGddSeries.find((p) => p.date === dateStr);
    if (!point) {
      // If date is before sowing, return first stage
      if (dateStr < timeline.sowingDate) return timeline.crop.stages[0];
      // If beyond projection, return last stage
      return timeline.crop.stages[timeline.crop.stages.length - 1];
    }
    return this.getStageForGdd(timeline.crop, point.cumulativeGdd);
  }
}
