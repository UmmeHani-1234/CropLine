import { DailyWeather, WeatherEvent, EventType, ConfidenceLevel } from './types';

export class EventExtractor {
  /**
   * Extract discrete meteorological events from daily and hourly weather forecasts.
   */
  public static extractEvents(dailyWeather: DailyWeather[]): WeatherEvent[] {
    const events: WeatherEvent[] = [];

    if (!dailyWeather || dailyWeather.length === 0) {
      return events;
    }

    // 1. Extract Rain Events
    let i = 0;
    while (i < dailyWeather.length) {
      const day = dailyWeather[i];
      const precip = day.precipitationSum;

      if (precip >= 2.5) {
        // Find cluster of consecutive rainy days
        let clusterEnd = i;
        let totalPrecip = precip;
        let peakPrecip = precip;
        let peakDate = day.date;
        let maxProb = day.precipitationProbabilityMax ?? 75;

        while (clusterEnd + 1 < dailyWeather.length && dailyWeather[clusterEnd + 1].precipitationSum >= 2.5) {
          clusterEnd++;
          const nextDay = dailyWeather[clusterEnd];
          totalPrecip += nextDay.precipitationSum;
          if (nextDay.precipitationSum > peakPrecip) {
            peakPrecip = nextDay.precipitationSum;
            peakDate = nextDay.date;
          }
          if (nextDay.precipitationProbabilityMax && nextDay.precipitationProbabilityMax > maxProb) {
            maxProb = nextDay.precipitationProbabilityMax;
          }
        }

        const startDate = day.date;
        const endDate = dailyWeather[clusterEnd].date;

        // Classify rain event using IMD standards
        let eventType: EventType = 'light_rain';
        let eventName = 'Light Rain';

        if (totalPrecip >= 64.5 || peakPrecip >= 64.5) {
          eventType = 'heavy_rain';
          eventName = totalPrecip >= 115.5 ? 'Very Heavy Rain' : 'Heavy Rain Event';
        } else if (totalPrecip >= 15.6 || peakPrecip >= 15.6) {
          eventType = 'moderate_rain';
          eventName = 'Moderate Rain Shower';
        } else {
          eventType = 'light_rain';
          eventName = 'Light Rain Shower';
        }

        const confidence = this.computeConfidence(maxProb);

        events.push({
          id: `rain_${startDate}_${endDate}`,
          type: eventType,
          name: eventName,
          startDate,
          endDate,
          peakDate,
          totalAmount: Number(totalPrecip.toFixed(1)),
          peakValue: Number(peakPrecip.toFixed(1)),
          probability: maxProb,
          confidence,
          summary: `${eventName} of ${totalPrecip.toFixed(1)} mm total (${peakPrecip.toFixed(1)} mm peak) from ${startDate} to ${endDate}`,
          unit: 'mm',
        });

        i = clusterEnd + 1;
      } else {
        i++;
      }
    }

    // 2. Extract Dry Spells (>= 5 consecutive days with < 2.5 mm rain)
    let dryStart = -1;
    for (let d = 0; d < dailyWeather.length; d++) {
      const day = dailyWeather[d];
      if (day.precipitationSum < 2.5) {
        if (dryStart === -1) {
          dryStart = d;
        }
      } else {
        if (dryStart !== -1) {
          const dryDuration = d - dryStart;
          if (dryDuration >= 5) {
            const startDate = dailyWeather[dryStart].date;
            const endDate = dailyWeather[d - 1].date;
            events.push({
              id: `dry_${startDate}_${endDate}`,
              type: 'dry_spell',
              name: `Extended Dry Spell (${dryDuration} Days)`,
              startDate,
              endDate,
              peakDate: dailyWeather[Math.floor((dryStart + d - 1) / 2)].date,
              totalAmount: dryDuration,
              peakValue: dryDuration,
              probability: 85,
              confidence: 'high',
              summary: `Continuous ${dryDuration}-day dry spell with negligible rainfall (<2.5 mm)`,
              unit: 'days',
            });
          }
          dryStart = -1;
        }
      }
    }

    // Check if dry spell extends to the end of array
    if (dryStart !== -1) {
      const dryDuration = dailyWeather.length - dryStart;
      if (dryDuration >= 5) {
        const startDate = dailyWeather[dryStart].date;
        const endDate = dailyWeather[dailyWeather.length - 1].date;
        events.push({
          id: `dry_${startDate}_${endDate}`,
          type: 'dry_spell',
          name: `Extended Dry Spell (${dryDuration} Days)`,
          startDate,
          endDate,
          peakDate: dailyWeather[Math.floor((dryStart + dailyWeather.length - 1) / 2)].date,
          totalAmount: dryDuration,
          peakValue: dryDuration,
          probability: 80,
          confidence: 'high',
          summary: `Continuous ${dryDuration}-day dry spell with negligible rainfall`,
          unit: 'days',
        });
      }
    }

    // 3. Extract Heat Events (Tmax >= 34°C)
    for (let h = 0; h < dailyWeather.length; h++) {
      const day = dailyWeather[h];
      if (day.tMax >= 34.0) {
        let heatEnd = h;
        let peakTemp = day.tMax;
        let peakDate = day.date;

        while (heatEnd + 1 < dailyWeather.length && dailyWeather[heatEnd + 1].tMax >= 34.0) {
          heatEnd++;
          if (dailyWeather[heatEnd].tMax > peakTemp) {
            peakTemp = dailyWeather[heatEnd].tMax;
            peakDate = dailyWeather[heatEnd].date;
          }
        }

        const startDate = day.date;
        const endDate = dailyWeather[heatEnd].date;
        const duration = heatEnd - h + 1;

        events.push({
          id: `heat_${startDate}_${endDate}`,
          type: 'heat',
          name: duration > 1 ? `Heat Wave (${duration} Days)` : 'High Temperature Spike',
          startDate,
          endDate,
          peakDate,
          totalAmount: Number(peakTemp.toFixed(1)),
          peakValue: Number(peakTemp.toFixed(1)),
          probability: 80,
          confidence: 'high',
          summary: `Maximum temperatures reaching ${peakTemp.toFixed(1)}°C from ${startDate} to ${endDate}`,
          unit: '°C',
        });

        h = heatEnd;
      }
    }

    // 4. Extract Cold Events (Tmin <= 4°C - Frost Risk)
    for (let c = 0; c < dailyWeather.length; c++) {
      const day = dailyWeather[c];
      if (day.tMin <= 4.0) {
        let coldEnd = c;
        let minTemp = day.tMin;
        let peakDate = day.date;

        while (coldEnd + 1 < dailyWeather.length && dailyWeather[coldEnd + 1].tMin <= 4.0) {
          coldEnd++;
          if (dailyWeather[coldEnd].tMin < minTemp) {
            minTemp = dailyWeather[coldEnd].tMin;
            peakDate = dailyWeather[coldEnd].date;
          }
        }

        const startDate = day.date;
        const endDate = dailyWeather[coldEnd].date;

        events.push({
          id: `cold_${startDate}_${endDate}`,
          type: 'cold',
          name: minTemp <= 2.0 ? 'Ground Frost Warning' : 'Cold Wave Advisory',
          startDate,
          endDate,
          peakDate,
          totalAmount: Number(minTemp.toFixed(1)),
          peakValue: Number(minTemp.toFixed(1)),
          probability: 75,
          confidence: 'medium',
          summary: `Minimum temperatures dropping to ${minTemp.toFixed(1)}°C from ${startDate} to ${endDate}`,
          unit: '°C',
        });

        c = coldEnd;
      }
    }

    // Sort all events chronologically by startDate
    return events.sort((a, b) => a.startDate.localeCompare(b.startDate));
  }

  private static computeConfidence(probability: number): ConfidenceLevel {
    if (probability >= 80) return 'high';
    if (probability >= 50) return 'medium';
    return 'low';
  }
}
