# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Salish Sea Wave Conditions** is a static marine data visualization website that displays real-time wave, wind, temperature, and storm surge conditions for the Salish Sea region (BC coast). The site pulls data from Environment Canada and NOAA buoys and presents it through interactive charts and cards.

The site is a static HTML/CSS/JavaScript application with no build process - data files are generated externally and placed in the `/data` directory.

## Data Architecture

### Data Sources and Flow

The site consumes **pre-generated JSON files** that are placed in the `/data` directory (likely via external scripts or cron jobs):

- **`/data/latest_buoy_v2.json`** - Current buoy conditions for all stations
- **`/data/buoy_timeseries_24h.json`** - 24-hour historical data for charts
- **`/data/storm_surge/combined_forecast.json`** - Multi-station storm surge forecasts
- **`/data/storm_surge/Point_Atkinson.json`** - Individual station forecast
- **`/data/storm_surge/Crescent_Beach_Channel.json`** - Individual station forecast

These files are auto-generated and git-ignored (see `.gitignore`). The frontend fetches these files with cache-busting query params (`?t=${Date.now()}`).

### Buoy Configuration

Buoys are displayed in a specific order defined in `assets/js/main.js:6-13`:

1. **4600146** - Halibut Bank (Environment Canada)
2. **4600304** - English Bay (Environment Canada)
3. **4600303** - Southern Georgia Strait (Environment Canada)
4. **4600131** - Sentry Shoal (Environment Canada)
5. **46087** - Neah Bay (NOAA)
6. **46088** - New Dungeness / Hein Bank (NOAA)

**Important distinctions:**
- **NOAA buoys** (46087, 46088) provide separated swell and wind wave data
- **Environment Canada buoys** provide combined significant wave height only
- **Neah Bay (46087)** displays swell conditions (open ocean exposure)
- **New Dungeness (46088)** gets special dual-chart treatment showing wave height components AND period components separately

## Code Structure

### Frontend Components

**`index.html`**
- Main HTML structure
- Loads ECharts library from CDN
- Defines buoy cards container, chart sections, and storm surge section
- SEO optimized with meta tags for Salish Sea / Halibut Bank keywords
- Loads chart modules in specific order: utilities → chart modules → orchestrator

**`assets/js/main.js`**
- Loads and displays current buoy conditions as cards
- Handles expandable detailed wave data for NOAA buoys
- Auto-refreshes every 5 minutes
- Contains source links mapping (lines 16-23) to Environment Canada/NOAA source pages

**Chart Modules (Modular Architecture)**

The chart system is broken into focused modules for maintainability:

**`assets/js/chart-utils.js`**
- Shared utility functions used by all chart modules
- `sanitizeSeriesData()` - Converts invalid values to null for ECharts
- `formatCompactTimeLabel()` - Formats timestamps for chart axes
- `formatTimeAxis()` - Formats timestamps for tooltips
- `getResponsiveGridConfig()` - Returns responsive chart grid configuration

**`assets/js/wave-chart.js`**
- Wave height and period visualization
- `renderWaveChart()` - Main entry point, routes to appropriate renderer
- `renderNewDungenessCharts()` - **Special dual-chart rendering for buoy 46088** (wave height components + period components)
- `renderStandardWaveChart()` - Standard single chart for all other buoys
- **Neah Bay (46087)** displays swell data instead of significant wave height

**`assets/js/wind-chart.js`**
- Wind speed and gust visualization
- `renderWindChart()` - Renders wind speed and gust as line chart with area fill

**`assets/js/temperature-chart.js`**
- Air and sea temperature visualization
- `renderTemperatureChart()` - Renders dual temperature lines

**`assets/js/comparison-chart.js`**
- Multi-buoy wave height comparison
- `renderComparisonChart()` - Shows all 4 Canadian buoys on single chart
- Includes reference lines at 0.7m and 1.2m thresholds
- Buoy colors defined: Halibut Bank (blue), English Bay (green), S. Georgia Strait (orange), Sentry Shoal (red)

**`assets/js/wave-table.js`**
- 24-hour wave height summary table
- `generateWaveHeightTable()` - Builds hourly table for all buoys
- **Special handling**: Uses swell_height for Neah Bay (46087), wave_height_sig for all others

**`assets/js/charts.js`**
- Main orchestrator (only ~100 lines)
- Loads data from `/data/buoy_timeseries_24h.json`
- Initializes all chart instances
- Coordinates chart updates when buoy selection changes
- Auto-refreshes every 15 minutes
- Manages event listeners and resize handling

**`assets/js/storm_surge_chart.js`**
- Multi-station storm surge forecast selector and chart
- Station order defined at lines 9-12
- Auto-refreshes every 2 hours

**`assets/css/style.css`**
- Responsive buoy card layouts
- Special styling for NOAA vs Environment Canada buoys (different border colors)
- Chart containers and table styling

## Development

### ⚠️ LIVE PRODUCTION ENVIRONMENT

**IMPORTANT**: The `/home/keelando/site` directory is being served **LIVE to production**. Any edits you make to files in this directory are **immediately reflected on the live website** without caching.

- There is no staging environment
- Changes are deployed instantly
- Test carefully before making edits
- The site is in beta, so this workflow is acceptable for now

### Web Server Configuration

The site is served in production by **Caddy** on port 8090 from `/home/keelando/site`. Configuration is located at `/etc/caddy/Caddyfile`.

**Current Cache Policy:**
- **All files**: No caching enabled for development (`no-store, no-cache, must-revalidate`)
- **Compression**: gzip and zstd enabled

Changes to any files (CSS, JS, HTML, images) are immediately visible after refresh.

### Running the Site Locally

This is a **static site** with no build process. To develop:

```bash
# Serve locally (any static server works)
python3 -m http.server 8000
# or
npx serve .
```

Then navigate to `http://localhost:8000`

### Data Refresh

Data files are auto-generated externally and placed in `/data`. The frontend automatically fetches updated files based on these intervals:

- Buoy cards: every 5 minutes
- Charts: every 15 minutes
- Storm surge: every 2 hours

### Testing with Local Data

To test with sample data, create mock JSON files matching the expected structure:

```javascript
// data/latest_buoy_v2.json
{
  "4600146": {
    "name": "Halibut Bank",
    "observation_time": "2024-10-25T18:30:00Z",
    "wave_height_sig": 1.2,
    "wave_period_avg": 5,
    "wind_speed": 15,
    "wind_gust": 20,
    // ... other fields
  }
}
```

## Key Implementation Details

### Chart Module Architecture

The chart system uses a modular architecture where each visualization has its own file:

- **wave-chart.js**: Contains all wave rendering logic
  - `renderWaveChart()` routes to the appropriate renderer based on buoy ID
  - New Dungeness (46088) triggers `renderNewDungenessCharts()` for dual-chart mode
    - Chart 1: Wind waves + swell height + total significant height
    - Chart 2: Wind wave period + swell period + average period
  - Neah Bay (46087) uses swell data (open ocean) via `renderStandardWaveChart()`
  - All Environment Canada buoys use significant wave height
- **wind-chart.js**, **temperature-chart.js**: Simple, focused chart renderers
- **comparison-chart.js**: Multi-buoy overlay chart with threshold reference lines
- **wave-table.js**: Table generation with special Neah Bay handling
- **charts.js**: Lightweight orchestrator that coordinates all modules

### Time Zone Handling

All timestamps display in **Pacific Time** (America/Vancouver) using 24-hour format without "PT" label. This is handled via:

```javascript
toLocaleString("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Vancouver"
})
```

### Null Handling and Data Gaps

Charts use `connectNulls: false` to show gaps in data. The `sanitizeSeriesData()` function (charts.js:12-20) converts null/NaN/"MM" values to `[timestamp, null]` for ECharts.

## Common Tasks

### Adding a New Buoy

1. Add buoy ID to order array in `main.js:6-13`
2. Add source link to `sourceLinks` object in `main.js:16-23`
3. Add buoy ID to chart selector in `index.html:40-47`
4. Add column to wave height table in `charts.js:711` and table HTML at `charts.js:740-750`
5. Update comparison chart colors if needed in `charts.js:603-608`

### Adding a New Storm Surge Station

1. Ensure data file exists at `/data/storm_surge/{Station_Name}.json`
2. Add station to `combined_forecast.json`
3. Add station ID to `STATION_ORDER` in `storm_surge_chart.js:9-12`

### Modifying Chart Appearance

Chart configurations use ECharts options. The modular structure makes changes easier:

- **Grid/responsive sizing**: Modify `getResponsiveGridConfig()` in `chart-utils.js`
- **Colors**: Update per-series colors in individual chart modules
  - Comparison chart colors: `comparison-chart.js` (buoyColors object)
  - Wave/wind/temp colors: in respective chart module files
- **Axis formatting**: Modify `formatCompactTimeLabel()` and `formatTimeAxis()` in `chart-utils.js`
- **Chart-specific options**: Edit the relevant module file (e.g., `wave-chart.js` for wave chart tweaks)

### Updating Refresh Intervals

- Buoy cards: `main.js` (currently 5 min)
- Charts: `charts.js` (currently 15 min)
- Storm surge: `storm_surge_chart.js` (currently 2 hours)

## Important Gotchas

1. **Data files are git-ignored** - don't commit `/data/*.json` files
2. **Chart module loading order matters** - in `index.html`, modules must load in this order:
   - First: `chart-utils.js` (utilities)
   - Then: all chart modules (`wave-chart.js`, `wind-chart.js`, etc.)
   - Last: `charts.js` (orchestrator that uses the modules)
3. **New Dungeness (46088) has special dual-chart rendering** - handled in `wave-chart.js` via `renderNewDungenessCharts()`
4. **NOAA vs Environment Canada buoys have different data structures** - NOAA provides separated swell/wind waves, Env Canada only provides combined significant wave height
5. **Neah Bay uses swell_height, not wave_height_sig** - handled specially in both `wave-chart.js` and `wave-table.js`
6. **Cache busting is critical** - always use `?t=${Date.now()}` when fetching data files
7. **No backend/build process exists in this repo** - data generation happens elsewhere
8. **Chart modules use global functions** - each module exports functions to global scope (no module system), so function names must be unique across all chart files
