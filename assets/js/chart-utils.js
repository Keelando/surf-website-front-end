/* -----------------------------
   Chart Utilities
   Shared formatting and config functions
   ----------------------------- */

/**
 * Sanitize series data for ECharts
 * Converts invalid values (null, NaN, "MM") to [timestamp, null]
 */
function sanitizeSeriesData(dataArray) {
  return dataArray.map(d => {
    const y = parseFloat(d.value);
    if (isNaN(y) || d.value == null || d.value === "MM") {
      return [new Date(d.time).getTime(), null];
    }
    return [new Date(d.time).getTime(), y];
  });
}

/**
 * Format time as compact label for chart axes
 * Example: "Mon 14h"
 */
function formatCompactTimeLabel(isoString) {
  const d = new Date(isoString);
  const dayOfWeek = d.toLocaleString("en-US", {
    weekday: "short",
    timeZone: "America/Vancouver",
  });
  const hour = d.toLocaleString("en-US", {
    hour: "2-digit",
    hour12: false,
    timeZone: "America/Vancouver",
  });
  return `${dayOfWeek} ${hour}h`;
}

/**
 * Format time for tooltips and detailed displays
 * Example: "Oct 25 14:30"
 */
function formatTimeAxis(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Vancouver",
  });
}

/**
 * Get responsive grid configuration based on screen width
 * @param {boolean} isComparisonChart - Whether this is for the comparison chart (needs more bottom space)
 */
function getResponsiveGridConfig(isComparisonChart = false) {
  const width = window.innerWidth;

  if (width < 600) {
    return {
      left: '8%',
      right: '8%',
      top: '15%',
      bottom: isComparisonChart ? '28%' : '22%',
      containLabel: true
    };
  } else if (width < 1000) {
    return {
      left: '10%',
      right: '10%',
      top: '12%',
      bottom: isComparisonChart ? '20%' : '16%',
      containLabel: true
    };
  } else {
    return {
      left: '8%',
      right: '8%',
      top: '10%',
      bottom: isComparisonChart ? '18%' : '14%',
      containLabel: true
    };
  }
}
