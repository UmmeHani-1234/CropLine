# CropLine

**CropLine** is a mobile-first, stage-aware weather advisory web application for farmers.

A farmer's field has a life story, from sowing to harvest. The weather forecast is a set of events about to land on that story. CropLine computes exactly **where** each weather event lands on the crop's life and **how much** it will help or hurt.

The same 70 mm of rain is good at tillering, damaging at flowering, and a loss at harvest. That collision of **forecast event × crop stage × soil type** is the core calculation engine of CropLine.

---

## Core Engine Architecture

1. **Stage Engine**: Computes accumulated Growing Degree Days (GDD) from historical daily temperatures + forecast days to calculate active and projected crop stages.
2. **Event Extractor**: Extracts discrete meteorological events (`heavy_rain`, `moderate_rain`, `light_rain`, `dry_spell`, `heat`, `cold`) using IMD standards and probability-derived confidence ratings.
3. **Collision Scorer**: Scores the impact level (`beneficial`, `none`, `low`, `medium`, `high`, `critical`) of events colliding with the active stage, applying soil texture modifiers (clay waterlogging risk vs. sand drought sensitivity).
4. **Action-Window Finder**: Finds operational windows for spraying, fertilizing, harvesting, and smart irrigation (skip vs. due).
5. **Verdict Writer**: Template and rule-based plain-language guidance with specific metrics, confidence ratings, and structured decision strip items ("Do today", "Don't do", "Wait for").

---

## Agronomy Data Architecture

All agronomic thresholds are versioned in `src/data/`:
- `src/data/crops/wheat.json`
- `src/data/rain-classes.json` (IMD standards)
- `src/data/soils.json`
- `src/data/impact-matrix.json`
- `src/data/advice-templates.json`

Every threshold includes a `source` field and `verified: false` flag, displaying a prototype advisory notice in the UI whenever unverified values influence advice.

---

## Getting Started

### Installation
```bash
npm install
```

### Running Tests
```bash
npm run test:run
```

### Development Server
```bash
npm run dev
```
