import { useState, useMemo } from 'react';
import { runCropLineEngine, AgronomyDataLoader, ImpactLevel, DailyWeather } from './engine';
import stormFixture from './engine/__tests__/fixtures/stormForecast.json';
import drySpellFixture from './engine/__tests__/fixtures/drySpellForecast.json';
import { 
  AlertTriangle, 
  Droplets, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  Layers, 
  Sprout, 
  Settings,
  TrendingUp,
  XCircle
} from 'lucide-react';

const PRESET_SCENARIOS: { name: string; desc: string; sowingDate: string; currentDate: string; soilId: string; weather: DailyWeather[] }[] = [
  {
    name: 'Heavy Storm at Flowering (High Risk)',
    desc: 'Wheat in peak anthesis collides with a 78mm heavy rain event.',
    sowingDate: '2025-11-15',
    currentDate: '2026-02-11',
    soilId: 'clay',
    weather: stormFixture as DailyWeather[],
  },
  {
    name: 'Beneficial Rain at Tillering',
    desc: 'Vegetative tillering receives moderate rain after low moisture.',
    sowingDate: '2026-01-05',
    currentDate: '2026-02-11',
    soilId: 'loam',
    weather: [
      { date: '2026-02-11', tMax: 22, tMin: 10, precipitationSum: 0, isHistorical: true },
      { date: '2026-02-12', tMax: 21, tMin: 12, precipitationSum: 22.5, precipitationProbabilityMax: 85, isHistorical: false },
      { date: '2026-02-13', tMax: 23, tMin: 11, precipitationSum: 5.0, precipitationProbabilityMax: 40, isHistorical: false },
      { date: '2026-02-14', tMax: 24, tMin: 10, precipitationSum: 0, isHistorical: false },
    ],
  },
  {
    name: 'Dry Spell & Heat Spike at Grain Filling',
    desc: 'Kernel development facing terminal heat and consecutive dry days.',
    sowingDate: '2025-11-01',
    currentDate: '2026-03-01',
    soilId: 'sand',
    weather: drySpellFixture as DailyWeather[],
  },
  {
    name: 'Pre-Harvest Rain (Critical Sprouting Loss)',
    desc: 'Standing mature wheat threatened by heavy rain before harvest.',
    sowingDate: '2025-09-01',
    currentDate: '2026-02-11',
    soilId: 'loam',
    weather: stormFixture as DailyWeather[],
  }
];

export default function App() {
  const [selectedScenarioIdx, setSelectedScenarioIdx] = useState(0);
  const [soilId, setSoilId] = useState(PRESET_SCENARIOS[0].soilId);
  const [calibrationDays, setCalibrationDays] = useState(0);
  const [sowingDate, setSowingDate] = useState(PRESET_SCENARIOS[0].sowingDate);
  const [currentDate, setCurrentDate] = useState(PRESET_SCENARIOS[0].currentDate);

  const scenario = PRESET_SCENARIOS[selectedScenarioIdx];
  const allSoils = useMemo(() => AgronomyDataLoader.getAllSoils(), []);

  const handleScenarioChange = (idx: number) => {
    setSelectedScenarioIdx(idx);
    const sc = PRESET_SCENARIOS[idx];
    setSoilId(sc.soilId);
    setSowingDate(sc.sowingDate);
    setCurrentDate(sc.currentDate);
    setCalibrationDays(0);
  };

  // Run the core calculation engine
  const engineOutput = useMemo(() => {
    return runCropLineEngine({
      cropId: 'wheat',
      soilId,
      sowingDate,
      currentDate,
      dailyWeather: scenario.weather,
      calibrationOffsetDays: calibrationDays,
    });
  }, [soilId, sowingDate, currentDate, scenario.weather, calibrationDays]);

  const { timeline, collisions, verdict } = engineOutput;

  // Impact level styling
  const getImpactBadge = (level: ImpactLevel) => {
    switch (level) {
      case 'beneficial':
        return { bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', label: 'Beneficial' };
      case 'none':
        return { bg: 'bg-stone-500/20 text-stone-400 border-stone-500/30', label: 'Neutral' };
      case 'low':
        return { bg: 'bg-blue-500/20 text-blue-400 border-blue-500/30', label: 'Low Impact' };
      case 'medium':
        return { bg: 'bg-amber-500/20 text-amber-400 border-amber-500/30', label: 'Moderate Concern' };
      case 'high':
        return { bg: 'bg-orange-500/20 text-orange-400 border-orange-500/30', label: 'High Risk' };
      case 'critical':
        return { bg: 'bg-rose-500/20 text-rose-400 border-rose-500/30', label: 'Critical Alert' };
    }
  };

  const verdictBadge = getImpactBadge(verdict.primaryImpactLevel);

  return (
    <div className="min-h-screen bg-[#111411] text-stone-200 antialiased pb-16">
      {/* Mobile-first Header */}
      <header className="sticky top-0 z-30 bg-[#171b16]/90 backdrop-blur-md border-b border-stone-800/60 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Sprout className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                CropLine
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.5 rounded">
                  v1 Core Engine
                </span>
              </h1>
              <p className="text-xs text-stone-400">Stage-Aware Weather Collision Engine</p>
            </div>
          </div>

          {/* Prototype Badge */}
          {verdict.unverifiedAgronomy && (
            <div className="flex items-center gap-1 text-[11px] text-amber-300/90 bg-amber-950/40 border border-amber-800/50 px-2 py-0.5 rounded-full" title="Prototype agronomy thresholds">
              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="hidden sm:inline">Unverified Agronomy</span>
              <span className="sm:hidden">Proto</span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Scenario Switcher Bar */}
        <section className="bg-stone-900/80 border border-stone-800/80 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Test Scenario
            </span>
            <span className="text-[11px] text-stone-500">Step 1 Validation</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {PRESET_SCENARIOS.map((sc, idx) => (
              <button
                key={sc.name}
                onClick={() => handleScenarioChange(idx)}
                className={`text-left p-2 rounded-lg text-xs transition border ${
                  selectedScenarioIdx === idx
                    ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200 shadow-sm'
                    : 'bg-stone-800/40 border-stone-800 text-stone-400 hover:bg-stone-800/80 hover:text-stone-300'
                }`}
              >
                <div className="font-semibold truncate">{sc.name.split(' (')[0]}</div>
                <div className="text-[10px] text-stone-400 truncate opacity-80">{sc.name.includes('(') ? sc.name.split('(')[1].replace(')', '') : 'Scenario'}</div>
              </button>
            ))}
          </div>
        </section>

        {/* 1. THE VERDICT (Hero Item) */}
        <section className={`rounded-2xl p-4 border transition shadow-lg ${
          verdict.primaryImpactLevel === 'critical' 
            ? 'bg-rose-950/20 border-rose-600/40' 
            : verdict.primaryImpactLevel === 'high' 
            ? 'bg-orange-950/20 border-orange-500/40' 
            : verdict.primaryImpactLevel === 'beneficial'
            ? 'bg-emerald-950/20 border-emerald-500/40'
            : 'bg-stone-900/90 border-stone-800'
        }`}>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${verdictBadge.bg}`}>
                {verdictBadge.label}
              </span>
              <span className="text-xs text-stone-400 font-medium">
                Stage: <strong className="text-stone-200">{verdict.stageShortName}</strong>
              </span>
            </div>
            <span className="text-[11px] text-stone-500 font-mono">
              {verdict.ruleId}
            </span>
          </div>

          <h2 className="text-lg font-bold text-white leading-snug mb-2">
            {verdict.headline}
          </h2>

          <p className="text-sm text-stone-300 leading-relaxed">
            {verdict.paragraph}
          </p>

          <div className="mt-3 pt-3 border-t border-stone-800/60 flex items-center justify-between text-[11px] text-stone-400">
            <span>Forecast Confidence: <strong className="text-stone-200 capitalize">{verdict.confidence}</strong></span>
            <span>Crop: <strong>Wheat (Triticum aestivum)</strong></span>
          </div>
        </section>

        {/* 2. CROP PHENOLOGY & GDD TIMELINE SUMMARY */}
        <section className="bg-stone-900/80 border border-stone-800/80 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-900/30 text-emerald-400">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Crop Phenology & GDD</h3>
                <p className="text-[11px] text-stone-400">GDD Accumulated: <span className="font-mono font-semibold text-emerald-300">{timeline.accumulatedGddToday} GDD</span></p>
              </div>
            </div>
            <span className="text-xs font-medium bg-stone-800 text-stone-300 px-2 py-1 rounded-md">
              Day {Math.round((new Date(currentDate).getTime() - new Date(sowingDate).getTime()) / (1000 * 60 * 60 * 24))} of Season
            </span>
          </div>

          {/* Active Stage Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-stone-400">
              <span>Active: <strong className="text-stone-200">{timeline.currentStage.name}</strong></span>
              <span>{timeline.stageProgressPercent}% complete</span>
            </div>
            <div className="h-2 w-full bg-stone-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500 rounded-full" 
                style={{ width: `${timeline.stageProgressPercent}%` }}
              />
            </div>
          </div>

          {/* Stage Sequence Ribbon */}
          <div className="space-y-1.5 pt-1">
            <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Projected Stage Timeline</div>
            <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
              {timeline.allStages.map((st) => (
                <div 
                  key={st.stage.id} 
                  className={`flex items-center justify-between text-xs p-1.5 rounded-lg border ${
                    st.isCurrent 
                      ? 'bg-emerald-950/40 border-emerald-500/50 text-white font-medium' 
                      : st.isPast 
                      ? 'bg-stone-900/40 border-stone-800/40 text-stone-500' 
                      : 'bg-stone-900/60 border-stone-800 text-stone-400'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${st.isCurrent ? 'bg-emerald-400 animate-pulse' : st.isPast ? 'bg-stone-600' : 'bg-stone-700'}`} />
                    <span>{st.stage.name}</span>
                  </div>
                  <span className="font-mono text-[11px] text-stone-400">{st.startDate} → {st.endDate}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3. DECISION STRIP */}
        <section className="bg-stone-900/80 border border-stone-800/80 rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            Decision Strip (Action Windows)
          </h3>

          {/* Do Today */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Do Today
            </div>
            <div className="space-y-1">
              {verdict.decisionStrip.doToday.map((item) => (
                <div key={item.id} className="text-xs bg-emerald-950/30 border border-emerald-800/40 rounded-lg p-2 text-stone-200">
                  {item.text}
                </div>
              ))}
            </div>
          </div>

          {/* Don't Do */}
          <div className="space-y-1.5 pt-1">
            <div className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5" />
              Don't Do
            </div>
            <div className="space-y-1">
              {verdict.decisionStrip.dontDo.map((item) => (
                <div key={item.id} className="text-xs bg-rose-950/30 border border-rose-800/40 rounded-lg p-2 text-stone-200">
                  {item.text}
                </div>
              ))}
            </div>
          </div>

          {/* Wait For */}
          <div className="space-y-1.5 pt-1">
            <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Wait For
            </div>
            <div className="space-y-1">
              {verdict.decisionStrip.waitFor.map((item) => (
                <div key={item.id} className="text-xs bg-amber-950/30 border border-amber-800/40 rounded-lg p-2 text-stone-200">
                  {item.text}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 4. WEATHER EVENTS & COLLISION MATRIX RESULTS */}
        <section className="bg-stone-900/80 border border-stone-800/80 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Droplets className="w-4 h-4 text-blue-400" />
              Weather Events × Stage Collisions
            </h3>
            <span className="text-[11px] text-stone-400">{collisions.length} Collisions Scored</span>
          </div>

          <div className="space-y-2">
            {collisions.map((c) => {
              const badge = getImpactBadge(c.finalImpactLevel);
              return (
                <div key={c.event.id} className="bg-stone-800/40 border border-stone-800 rounded-xl p-3 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">{c.event.name}</span>
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${badge.bg}`}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="text-stone-300">{c.description}</div>
                  <div className="flex flex-wrap gap-2 text-[10px] text-stone-400 pt-1">
                    <span>Dates: <strong>{c.event.startDate} → {c.event.endDate}</strong></span>
                    <span>Stage Hit: <strong className="text-stone-300">{c.stage.name}</strong></span>
                    {c.soilModifierApplied && (
                      <span className="text-amber-300/80">Soil Effect: {c.soilModifierApplied}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 5. LIVE CALIBRATION & SOIL CONTROLS */}
        <section className="bg-stone-900/80 border border-stone-800/80 rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Settings className="w-4 h-4 text-stone-400" />
            Live Calibration Controls
          </h3>

          <div className="space-y-3 text-xs">
            {/* Soil Type Select */}
            <div>
              <label className="block text-stone-400 mb-1">Soil Texture (Hydrology Modifier):</label>
              <select 
                value={soilId} 
                onChange={(e) => setSoilId(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              >
                {allSoils.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (Infiltration: {s.infiltrationRateMmPerHour} mm/h)
                  </option>
                ))}
              </select>
            </div>

            {/* Farm Ahead / Behind Shift Slider */}
            <div>
              <div className="flex justify-between text-stone-400 mb-1">
                <span>Crop Progress Calibration (Compare Shift):</span>
                <span className="font-mono font-bold text-emerald-400">
                  {calibrationDays === 0 ? 'On Track (0d)' : calibrationDays > 0 ? `+${calibrationDays}d Ahead` : `${calibrationDays}d Behind`}
                </span>
              </div>
              <input 
                type="range" 
                min="-20" 
                max="20" 
                step="1"
                value={calibrationDays}
                onChange={(e) => setCalibrationDays(parseInt(e.target.value))}
                className="w-full accent-emerald-500 bg-stone-800 h-2 rounded-lg cursor-pointer"
              />
              <p className="text-[10px] text-stone-500 mt-1">
                Adjusting this shifts the GDD timeline and re-scores collisions in real-time.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
