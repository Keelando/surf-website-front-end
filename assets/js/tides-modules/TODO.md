# Tide Display Module TODO

## High Priority

### Fix "Now" Dot Interpolation on Charts
**Status:** Pending
**Date Added:** 2026-01-12

Since we scrapped the custom calibration calculations for geodetic stations (now taking Surrey data at face value), the "Now" dot logic on the tide charts should be simplified to use straightforward interpolation.

**What needs to be done:**
- Review `chart-renderer.js` for the "Now" marker/dot logic
- Make interpolation self-consistent across all station types
- Remove any legacy calibration logic that might be affecting the current position marker
- Ensure geodetic and DFO stations use consistent interpolation methods

**Related Files:**
- `/home/keelando/site/assets/js/tides-modules/chart-renderer.js`
- Geodetic stations: `crescent_beach_ocean`, `crescent_channel_ocean`

---

## Completed Items

### Storm Surge Card Alignment (2026-01-12)
- ✅ Fixed geodetic station labels to show "Residual" instead of misleading labels
- ✅ Separated geodetic (Surrey) and DFO data paths completely
- ✅ Added "Today's Peak Tide Forecast" to all applicable stations
- ✅ Created reusable `generatePeakForecastHtml()` helper function
