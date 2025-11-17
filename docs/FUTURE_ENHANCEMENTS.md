# Future Enhancements

## Wave Direction Arrows

### Overview
Add directional arrows to wave charts similar to the wind chart implementation. This will provide visual indication of wave direction alongside wave height and period data.

### Implementation Notes

#### Standard Wave Charts
For single-component wave charts (most Canadian buoys), add direction arrows positioned at the wave height line:
- Use the same arrow symbol as wind chart: `'path://M0,-12 L-4,8 L0,6 L4,8 Z'`
- Position arrows at the significant wave height values
- Rotate arrows based on wave direction (meteorological convention: FROM direction)
- Apply +90° rotation offset for waves (pointing perpendicular to wind convention)
- Use responsive sampling (6h mobile, 3h desktop) to prevent overlap

#### Spectral Wave Charts (NOAA Buoys)
For multi-component wave charts (Neah Bay 46087, New Dungeness 46088), **special attention required**:
- **Challenge**: Three separate wave components (Wind Waves, Ocean Swell, Total)
- **Options**:
  1. Show arrows only for the dominant component (Ocean Swell for Neah Bay)
  2. Use different arrow colors/styles for each component
  3. Position arrows at different y-levels to avoid overlap
  4. Add a separate direction indicator chart below the wave height chart

#### Recommended Approach for Spectral Charts
Create a **third chart** specifically for wave directions:
- Chart 1: Wave Heights (existing)
- Chart 2: Wave Periods (existing)
- Chart 3: **Wave Directions** (new)
  - Line chart showing wind wave direction, swell direction, and peak direction
  - Use compass rose y-axis (0-360°)
  - Include directional arrows as scatter overlay
  - This avoids cluttering the height/period charts

### Files to Modify
- `/assets/js/wave-chart-v4.js` - Main wave chart rendering
- `/assets/js/comparison-chart-v4.js` - Comparison chart with multiple buoys
- `index.html` - Add direction chart container for spectral buoys

### References
- Wind direction implementation: `/assets/js/wind-chart-v4.js` (lines 6-52)
- Centered arrow symbol: `'path://M0,-12 L-4,8 L0,6 L4,8 Z'`
- Responsive sampling: `window.innerWidth < 600 ? 6 : 3`

### Priority
Medium - Enhancement for better data visualization, not critical functionality

### Dependencies
- Logger utility (already implemented)
- ECharts library (already available)
- Wave direction data (verify availability across all buoys)
