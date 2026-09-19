import { WeatherEvent, CropTimeline, SoilType, CollisionResult, ImpactLevel, CropStage } from './types';
import { AgronomyDataLoader } from './dataLoader';
import { StageEngine } from './stageEngine';

export class CollisionScorer {
  private static impactLevelsOrder: ImpactLevel[] = ['beneficial', 'none', 'low', 'medium', 'high', 'critical'];

  /**
   * Score the agronomic impact of a single weather event landing on a crop timeline with given soil.
   */
  public static scoreEventCollision(params: {
    event: WeatherEvent;
    timeline: CropTimeline;
    soil?: SoilType;
  }): CollisionResult {
    const { event, timeline } = params;
    const soil = params.soil || AgronomyDataLoader.getSoil('loam');
    const cropId = timeline.crop.id;

    // 1. Determine which crop stage the event lands on (using event peakDate)
    const activeStage = StageEngine.getStageOnDate(timeline, event.peakDate);

    // 2. Query impact matrix
    const matrix = AgronomyDataLoader.getImpactMatrix();
    const cropMatrix = (matrix.crops as any)[cropId]?.stages?.[activeStage.id];
    const baseEntry = cropMatrix?.[event.type];

    let baseImpactLevel: ImpactLevel = baseEntry ? baseEntry.impactLevel : 'low';
    let severityScore: number = baseEntry ? baseEntry.score : 1;
    let ruleId: string = baseEntry ? baseEntry.ruleId : `RULE_GENERIC_${cropId.toUpperCase()}_${activeStage.id.toUpperCase()}_${event.type.toUpperCase()}`;
    let headline: string = baseEntry ? baseEntry.headline : `${event.name} at ${activeStage.name}`;
    let advisory: string = baseEntry ? baseEntry.advisory : 'Monitor field conditions closely.';
    let summaryTemplate: string = baseEntry ? baseEntry.summaryTemplate : `${event.summary} during ${activeStage.name}.`;

    // 3. Apply Soil Modifiers
    let soilModifierApplied: string | undefined = undefined;
    let finalImpactLevel: ImpactLevel = baseImpactLevel;

    if (event.type === 'heavy_rain' || event.type === 'moderate_rain') {
      // Clay / Black soil increases waterlogging severity
      if (soil.waterloggingRiskModifier > 0 && finalImpactLevel !== 'beneficial' && finalImpactLevel !== 'critical') {
        if (finalImpactLevel === 'medium') finalImpactLevel = 'high';
        else if (finalImpactLevel === 'high') finalImpactLevel = 'critical';
        else if (finalImpactLevel === 'low') finalImpactLevel = 'medium';
        soilModifierApplied = `${soil.name}: High clay content reduces drainage, raising waterlogging severity.`;
      } else if (soil.waterloggingRiskModifier < 0 && finalImpactLevel !== 'beneficial') {
        // Sand soil drains rapidly, reducing heavy rain standing water risk
        if (finalImpactLevel === 'critical' && activeStage.id !== 'maturity_harvest') finalImpactLevel = 'high';
        else if (finalImpactLevel === 'high') finalImpactLevel = 'medium';
        soilModifierApplied = `${soil.name}: High percolation reduces surface waterlogging duration.`;
      }
    } else if (event.type === 'dry_spell') {
      // Sand soil has low WHC, escalating drought severity
      if (soil.droughtRiskModifier > 0) {
        if (finalImpactLevel === 'medium') finalImpactLevel = 'high';
        else if (finalImpactLevel === 'high') finalImpactLevel = 'critical';
        soilModifierApplied = `${soil.name}: Low water holding capacity accelerates moisture depletion under dry spell.`;
      } else if (soil.droughtRiskModifier < 0) {
        // Clay soil holds water longer
        if (finalImpactLevel === 'critical' && activeStage.id !== 'crown_root_initiation') finalImpactLevel = 'high';
        soilModifierApplied = `${soil.name}: High water retention buffers against early drought stress.`;
      }
    }

    // 4. Check for special "Beneficial Rain" scenarios:
    // e.g. Moderate or light rain after moisture stress at tillering or jointing
    const isBeneficial = finalImpactLevel === 'beneficial';

    // 5. Interpolate template parameters
    const description = this.interpolateTemplate(summaryTemplate, {
      cropName: timeline.crop.name,
      stageName: activeStage.name,
      amount: event.totalAmount.toString(),
      durationDays: event.totalAmount.toString(),
      peakTemp: event.peakValue.toString(),
      minTemp: event.peakValue.toString(),
      startDate: event.startDate,
      endDate: event.endDate,
      soilName: soil.name,
    });

    const unverifiedAgronomy = !timeline.crop.verified || !activeStage.verified || !soil.verified || !matrix.verified;

    return {
      event,
      stage: activeStage,
      baseImpactLevel,
      finalImpactLevel,
      severityScore,
      soilModifierApplied,
      ruleId,
      headline,
      description,
      advisory,
      isBeneficial,
      unverifiedAgronomy,
    };
  }

  /**
   * Score collisions for all extracted weather events.
   */
  public static scoreAllCollisions(params: {
    events: WeatherEvent[];
    timeline: CropTimeline;
    soil?: SoilType;
  }): CollisionResult[] {
    return params.events.map((event) => this.scoreEventCollision({ event, timeline: params.timeline, soil: params.soil }));
  }

  private static interpolateTemplate(template: string, vars: Record<string, string>): string {
    let result = template;
    for (const [key, val] of Object.entries(vars)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
    }
    return result;
  }
}
