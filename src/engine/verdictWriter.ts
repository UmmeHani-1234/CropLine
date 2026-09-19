import { CropTimeline, CollisionResult, ActionWindow, Verdict, DecisionStrip, DecisionItem, ImpactLevel, ConfidenceLevel } from './types';
import { AgronomyDataLoader } from './dataLoader';

export class VerdictWriter {
  /**
   * Compose the plain-language verdict paragraph, decision strip items, and severity styling.
   */
  public static composeVerdict(params: {
    timeline: CropTimeline;
    collisions: CollisionResult[];
    actionWindows: ActionWindow[];
  }): Verdict {
    const { timeline, collisions, actionWindows } = params;
    const currentStage = timeline.currentStage;
    const templates = AgronomyDataLoader.getAdviceTemplates();
    const enDict = templates.translations.en;

    // 1. Find the primary collision event (the most severe upcoming event in the next 10 days)
    const upcomingCollisions = collisions.filter((c) => c.event.endDate >= timeline.currentDate);
    const sortedCollisions = [...upcomingCollisions].sort((a, b) => {
      // Prioritize critical -> high -> medium -> beneficial -> low -> none
      const rank: Record<ImpactLevel, number> = {
        critical: 5,
        high: 4,
        medium: 3,
        beneficial: 2,
        low: 1,
        none: 0,
      };
      return rank[b.finalImpactLevel] - rank[a.finalImpactLevel];
    });

    const primaryCollision = sortedCollisions[0];

    // 2. Build Plain Language Paragraph
    let primaryImpactLevel: ImpactLevel = 'none';
    let headline = `Normal Care at ${currentStage.name}`;
    let paragraph = '';
    let ruleId = 'RULE_FAVORABLE_BASELINE';
    let confidence: ConfidenceLevel = 'high';
    const numbers: Verdict['numbers'] = {};

    if (primaryCollision) {
      primaryImpactLevel = primaryCollision.finalImpactLevel;
      headline = primaryCollision.headline;
      ruleId = primaryCollision.ruleId;
      confidence = primaryCollision.event.confidence;

      const timingText = this.formatEventTiming(primaryCollision.event.startDate, primaryCollision.event.endDate, timeline.currentDate);
      const confText = enDict.confidence[confidence] || `${confidence} confidence`;

      let amountText = `${primaryCollision.event.totalAmount} ${primaryCollision.event.unit}`;
      if (primaryCollision.event.type === 'heavy_rain' || primaryCollision.event.type === 'moderate_rain') {
        const peakVal = primaryCollision.event.peakValue;
        const totalVal = primaryCollision.event.totalAmount;
        amountText = peakVal === totalVal ? `${totalVal} mm` : `${peakVal}-${totalVal} mm`;
        numbers.eventAmount = amountText;
        numbers.timingText = timingText;
      } else if (primaryCollision.event.type === 'dry_spell') {
        amountText = `${primaryCollision.event.totalAmount} days`;
        numbers.eventAmount = amountText;
        numbers.timingText = timingText;
      } else if (primaryCollision.event.type === 'heat') {
        amountText = `highs of ${primaryCollision.event.peakValue}°C`;
        numbers.temperature = `${primaryCollision.event.peakValue}°C`;
        numbers.timingText = timingText;
      }

      // Sentence 1: Stage announcement
      // Sentence 2: Event forecast with numbers and confidence
      // Sentence 3: Impact explanation for this stage
      // Sentence 4: Actionable directive
      paragraph = `Your ${timeline.crop.name.toLowerCase()} is at ${currentStage.name.toLowerCase()}. ${primaryCollision.event.name} is expected ${timingText}, ${amountText}, ${confText}. ${primaryCollision.description} ${primaryCollision.advisory}`;
    } else {
      paragraph = `Your ${timeline.crop.name.toLowerCase()} is at ${currentStage.name.toLowerCase()}. Weather conditions are stable and favorable for the next 7 days. Continue standard crop care.`;
    }

    // 3. Assemble Decision Strip ("Do today", "Don't do", "Wait for")
    const decisionStrip = this.buildDecisionStrip(actionWindows, primaryCollision);

    const unverifiedAgronomy = timeline.unverifiedAgronomy || (primaryCollision ? primaryCollision.unverifiedAgronomy : false);

    return {
      cropName: timeline.crop.name,
      stageName: currentStage.name,
      stageShortName: currentStage.shortName,
      primaryImpactLevel,
      headline,
      paragraph,
      ruleId,
      confidence,
      numbers,
      decisionStrip,
      unverifiedAgronomy,
      i18nKey: primaryCollision ? `verdicts.${primaryCollision.finalImpactLevel.toUpperCase()}` : 'verdicts.FAVORABLE_CONDITIONS',
    };
  }

  private static buildDecisionStrip(actionWindows: ActionWindow[], primaryCollision?: CollisionResult): DecisionStrip {
    const doToday: DecisionItem[] = [];
    const dontDo: DecisionItem[] = [];
    const waitFor: DecisionItem[] = [];

    // Map ActionWindows into their respective groups
    actionWindows.forEach((w) => {
      const item: DecisionItem = {
        id: w.id,
        text: `${w.title}: ${w.description}`,
        icon: this.getIconForWindowType(w.type),
        priority: w.suitabilityScore,
        actionWindowId: w.id,
        ruleId: w.ruleId,
      };

      if (w.category === 'do_today') doToday.push(item);
      else if (w.category === 'dont_do') dontDo.push(item);
      else if (w.category === 'wait_for') waitFor.push(item);
    });

    // If there's an active high/critical rain collision, add drainage action to doToday if not present
    if (primaryCollision && (primaryCollision.finalImpactLevel === 'high' || primaryCollision.finalImpactLevel === 'critical') && primaryCollision.event.type.includes('rain')) {
      if (!doToday.some((d) => d.id === 'drainage_prep')) {
        doToday.unshift({
          id: 'drainage_prep',
          text: 'Clear drainage furrows: Prepare field runoff before heavy precipitation arrives',
          icon: 'drainage',
          priority: 99,
          ruleId: 'RULE_PREPARE_DRAINAGE_HEAVY_RAIN',
        });
      }
    }

    // Fallbacks if empty
    if (doToday.length === 0) {
      doToday.push({
        id: 'standard_monitoring',
        text: 'Routine field scouting: Monitor vegetative growth and soil moisture status',
        icon: 'eye',
        priority: 50,
        ruleId: 'RULE_ROUTINE_MONITORING',
      });
    }

    if (dontDo.length === 0) {
      dontDo.push({
        id: 'no_unneeded_chemicals',
        text: 'Avoid unnecessary foliar sprays: Maintain natural canopy microclimate',
        icon: 'shield',
        priority: 30,
        ruleId: 'RULE_AVOID_UNNEEDED_SPRAYS',
      });
    }

    if (waitFor.length === 0) {
      waitFor.push({
        id: 'wait_next_forecast',
        text: 'Stable conditions: Monitor mid-week forecast update for weather shifts',
        icon: 'clock',
        priority: 20,
        ruleId: 'RULE_MONITOR_NEXT_WINDOW',
      });
    }

    return {
      doToday: doToday.sort((a, b) => b.priority - a.priority),
      dontDo: dontDo.sort((a, b) => b.priority - a.priority),
      waitFor: waitFor.sort((a, b) => b.priority - a.priority),
    };
  }

  private static formatEventTiming(startDate: string, endDate: string, currentDate: string): string {
    const s = new Date(startDate);
    const c = new Date(currentDate);
    const diffDays = Math.round((s.getTime() - c.getTime()) / (1000 * 60 * 60 * 24));

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const sDay = dayNames[s.getDay()];

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'tomorrow';
    if (diffDays === 2) return `this ${sDay}`;
    if (startDate === endDate) return `on ${sDay} (${startDate})`;
    return `from ${startDate} to ${endDate}`;
  }

  private static getIconForWindowType(type: ActionWindow['type']): string {
    switch (type) {
      case 'spray':
        return 'spray-can';
      case 'fertilize':
        return 'sprout';
      case 'harvest':
        return 'combine-harvester';
      case 'irrigate_skip':
        return 'droplet-off';
      case 'irrigate_due':
        return 'droplets';
      default:
        return 'alert-circle';
    }
  }
}
