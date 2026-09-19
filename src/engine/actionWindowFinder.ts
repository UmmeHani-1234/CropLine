import { DailyWeather, HourlyWeather, ActionWindow, CropTimeline, SoilType } from './types';

export class ActionWindowFinder {
  /**
   * Scan forecast weather to find actionable operational windows for farm activities.
   */
  public static findActionWindows(params: {
    timeline: CropTimeline;
    dailyWeather: DailyWeather[];
    soil?: SoilType;
  }): ActionWindow[] {
    const windows: ActionWindow[] = [];
    const { timeline, dailyWeather } = params;
    const currentStage = timeline.currentStage;

    if (!dailyWeather || dailyWeather.length === 0) return windows;

    // Filter to future/forecast days starting from today
    const forecastDays = dailyWeather.filter((d) => d.date >= timeline.currentDate);
    const allHourly: HourlyWeather[] = [];
    forecastDays.forEach((d) => {
      if (d.hourly) allHourly.push(...d.hourly);
    });

    // 1. SPRAY WINDOWS
    // Ideal: No rain (precip < 0.2mm, prob < 30%), wind < 15 km/h, temp 12 - 30°C for >= 4 consecutive hours
    const sprayWindows = this.findHourlySprayWindows(allHourly, forecastDays);
    if (sprayWindows.length > 0) {
      windows.push(sprayWindows[0]); // Best primary spray window
    } else {
      // Unfavorable spray conditions
      const highWindOrRainDay = forecastDays[0];
      windows.push({
        id: 'spray_unfavorable',
        type: 'spray',
        category: 'dont_do',
        title: 'Hold Chemical Sprays',
        description: `Unfavorable conditions in the next 24-48 hours (rain probability ${highWindOrRainDay.precipitationProbabilityMax ?? 60}% or high wind). Risk of chemical wash-off and drift.`,
        startTime: forecastDays[0].date,
        endTime: forecastDays[Math.min(1, forecastDays.length - 1)].date,
        suitabilityScore: 20,
        urgency: 'medium',
        ruleId: 'RULE_SPRAY_HOLD',
      });
    }

    // 2. IRRIGATION GUIDANCE (Skip vs Due)
    // Calculate total rain expected in next 3 days
    const next3Days = forecastDays.slice(0, 3);
    const rainNext3Days = next3Days.reduce((acc, d) => acc + d.precipitationSum, 0);

    if (rainNext3Days >= 15.0) {
      // Upcoming significant rain -> Skip irrigation
      windows.push({
        id: 'irrigation_skip',
        type: 'irrigate_skip',
        category: 'dont_do',
        title: 'Skip Irrigation',
        description: `Significant rainfall (${rainNext3Days.toFixed(1)} mm) forecast over the next 72 hours. Save water and avoid root waterlogging.`,
        startTime: forecastDays[0].date,
        endTime: next3Days[next3Days.length - 1].date,
        suitabilityScore: 95,
        urgency: 'high',
        ruleId: 'RULE_IRRIGATION_SKIP_UPCOMING_RAIN',
      });
    } else if (rainNext3Days < 3.0 && (currentStage.waterSensitivity === 'critical' || currentStage.waterSensitivity === 'high')) {
      // Moisture critical stage with dry weather -> Irrigation Due
      windows.push({
        id: 'irrigation_due',
        type: 'irrigate_due',
        category: 'do_today',
        title: `Irrigation Due (${currentStage.shortName})`,
        description: `Crop is in moisture-sensitive ${currentStage.name} with minimal rain expected (${rainNext3Days.toFixed(1)} mm). Irrigate to protect yield.`,
        startTime: forecastDays[0].date,
        endTime: forecastDays[Math.min(2, forecastDays.length - 1)].date,
        suitabilityScore: 90,
        urgency: 'high',
        ruleId: 'RULE_IRRIGATION_DUE_CRITICAL_STAGE',
      });
    }

    // 3. FERTILIZER TOP-DRESSING WINDOW
    // Ideal: Light rain / moist soil, but NO heavy rain (> 25 mm) in 48h
    const heavyRainComing = next3Days.some((d) => d.precipitationSum >= 25.0);
    if (heavyRainComing) {
      windows.push({
        id: 'fertilizer_hold',
        type: 'fertilize',
        category: 'dont_do',
        title: 'Hold Fertilizer Top-Dressing',
        description: 'Heavy rain expected within 48h. Applying nitrogen or granular fertilizer will cause runoff leaching loss.',
        startTime: forecastDays[0].date,
        endTime: next3Days[next3Days.length - 1].date,
        suitabilityScore: 10,
        urgency: 'high',
        ruleId: 'RULE_FERTILIZER_HOLD_LEACHING_RISK',
      });
    } else if (currentStage.id === 'tillering' || currentStage.id === 'jointing_booting') {
      const bestFertDay = forecastDays.find((d) => d.precipitationSum >= 2.0 && d.precipitationSum <= 15.0) || forecastDays[0];
      windows.push({
        id: 'fertilizer_window',
        type: 'fertilize',
        category: 'do_today',
        title: 'Fertilizer Top-Dressing Window',
        description: `Ideal vegetative window during ${currentStage.shortName}. Apply nitrogen under moderate moisture for rapid root uptake.`,
        startTime: bestFertDay.date,
        endTime: bestFertDay.date,
        suitabilityScore: 85,
        urgency: 'medium',
        ruleId: 'RULE_FERTILIZER_VEGETATIVE_WINDOW',
      });
    }

    // 4. HARVEST WINDOW (for mature crop)
    if (currentStage.id === 'maturity_harvest') {
      const dryStreak = this.findDryHarvestStreak(forecastDays);
      if (dryStreak) {
        windows.push({
          id: 'harvest_window',
          type: 'harvest',
          category: 'do_today',
          title: 'Harvest Window Active',
          description: `Consecutive dry weather window from ${dryStreak.startDate} to ${dryStreak.endDate}. Grain dry-down will be optimal.`,
          startTime: dryStreak.startDate,
          endTime: dryStreak.endDate,
          suitabilityScore: 95,
          urgency: 'high',
          ruleId: 'RULE_HARVEST_DRY_WINDOW',
        });
      } else {
        windows.push({
          id: 'harvest_delay',
          type: 'harvest',
          category: 'wait_for',
          title: 'Wait for Dry Weather to Harvest',
          description: 'Rain or high moisture in the forecast. Delay combining until grain moisture drops below 14%.',
          startTime: forecastDays[0].date,
          endTime: forecastDays[forecastDays.length - 1].date,
          suitabilityScore: 30,
          urgency: 'high',
          ruleId: 'RULE_HARVEST_HOLD_RAIN',
        });
      }
    }

    return windows;
  }

  private static findHourlySprayWindows(hourlyList: HourlyWeather[], dailyList: DailyWeather[]): ActionWindow[] {
    if (hourlyList.length >= 6) {
      let streakStart = -1;
      for (let h = 0; h < hourlyList.length; h++) {
        const item = hourlyList[h];
        const isGood = item.precipitation < 0.2 && item.precipitationProbability <= 30 && item.windSpeed <= 15 && item.temperature >= 12 && item.temperature <= 30;

        if (isGood) {
          if (streakStart === -1) streakStart = h;
          const streakLen = h - streakStart + 1;
          if (streakLen >= 4) {
            const startHour = hourlyList[streakStart].time;
            const endHour = item.time;
            return [
              {
                id: `spray_${startHour}`,
                type: 'spray',
                category: 'do_today',
                title: 'Optimal Spray Window',
                description: `Clear window: ${this.formatHourRange(startHour, endHour)} (Wind < 15 km/h, Rain prob < 30%, Temp 15-28°C).`,
                startTime: startHour,
                endTime: endHour,
                suitabilityScore: 90,
                urgency: 'medium',
                ruleId: 'RULE_SPRAY_WINDOW_OPTIMAL',
              },
            ];
          }
        } else {
          streakStart = -1;
        }
      }
    }

    // Daily fallback if hourly is sparse
    const dryDay = dailyList.find((d) => d.precipitationSum < 1.0 && (d.precipitationProbabilityMax ?? 0) <= 25 && (d.windSpeedMax ?? 10) <= 15);
    if (dryDay) {
      return [
        {
          id: `spray_${dryDay.date}`,
          type: 'spray',
          category: 'do_today',
          title: 'Spray Window Available',
          description: `Low wind and minimal rain risk on ${dryDay.date} (Morning 6:00 AM - 11:00 AM recommended).`,
          startTime: `${dryDay.date}T06:00:00`,
          endTime: `${dryDay.date}T11:00:00`,
          suitabilityScore: 80,
          urgency: 'medium',
          ruleId: 'RULE_SPRAY_WINDOW_DAILY_ESTIMATE',
        },
      ];
    }

    return [];
  }

  private static findDryHarvestStreak(dailyList: DailyWeather[]): { startDate: string; endDate: string } | null {
    let streak = 0;
    let start = '';
    for (const day of dailyList) {
      if (day.precipitationSum < 1.0) {
        if (streak === 0) start = day.date;
        streak++;
        if (streak >= 3) {
          return { startDate: start, endDate: day.date };
        }
      } else {
        streak = 0;
      }
    }
    return null;
  }

  private static formatHourRange(startIso: string, endIso: string): string {
    const sDate = new Date(startIso);
    const eDate = new Date(endIso);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const sDay = dayNames[sDate.getDay()];
    const sHour = sDate.toLocaleTimeString([], { hour: 'numeric', hour12: true });
    const eHour = eDate.toLocaleTimeString([], { hour: 'numeric', hour12: true });
    return `${sDay} ${sHour} - ${eHour}`;
  }
}
