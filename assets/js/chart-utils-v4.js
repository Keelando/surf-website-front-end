/* -----------------------------
   Chart Utilities
   Shared formatting and config functions
   ----------------------------- */

/**
 * Fetch with timeout and retry logic
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options plus timeout/retry config
 * @param {number} options.timeout - Timeout in milliseconds (default: 10000)
 * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
 * @param {number} options.retryDelay - Base delay between retries in ms (default: 1000)
 * @returns {Promise<any>} Parsed JSON response
 */
async function fetchWithTimeout(url, options = {}) {
  const timeout = options.timeout || 10000;
  const maxRetries = options.maxRetries || 3;
  const retryDelay = options.retryDelay || 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const fetchOptions = { ...options };
      delete fetchOptions.timeout;
      delete fetchOptions.maxRetries;
      delete fetchOptions.retryDelay;
      fetchOptions.signal = controller.signal;

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (attempt === maxRetries) {
        logger.error('ChartUtils', `Fetch failed after ${maxRetries} attempts`, error);
        throw error;
      }

      const delay = retryDelay * attempt;
      logger.warn('ChartUtils', `Fetch attempt ${attempt} failed, retrying in ${delay}ms...`, { message: error.message });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

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

/**
 * Get responsive legend bottom position based on screen width
 * Scales proportionally with grid bottom spacing for consistent visual gap
 */
function getResponsiveLegendBottom() {
  const width = window.innerWidth;

  if (width < 600) {
    return '10%';  // Mobile: higher up to stay closer to rotated labels
  } else if (width < 1000) {
    return '7%';   // Medium: middle ground
  } else {
    return '5%';   // Desktop: works well per user feedback
  }
}

/**
 * Display error message in chart container
 * @param {HTMLElement|string} container - DOM element or element ID
 * @param {string} chartName - Name of the chart for error message
 * @param {Error} error - The error object
 */
function showChartError(container, chartName, error) {
  const element = typeof container === 'string'
    ? document.getElementById(container)
    : container;

  if (!element) {
    logger.error('ChartUtils', `Chart container not found: ${container}`);
    return;
  }

  logger.error('ChartUtils', `Error rendering ${chartName}`, error);

  element.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; height: 100%; min-height: 200px; padding: 2rem; text-align: center;">
      <div>
        <div style="color: #e53935; font-size: 1.2rem; margin-bottom: 0.5rem;">⚠️ Chart Error</div>
        <div style="color: #666; font-size: 0.9rem;">Unable to load ${chartName}</div>
        <div style="color: #999; font-size: 0.8rem; margin-top: 0.5rem;">Check console for details</div>
      </div>
    </div>
  `;
}

/**
 * Safely render chart with error handling
 * @param {Function} renderFn - Chart rendering function
 * @param {HTMLElement|string} container - DOM element or element ID
 * @param {string} chartName - Name of the chart for error messages
 * @param {...any} args - Arguments to pass to renderFn
 */
function safeRenderChart(renderFn, container, chartName, ...args) {
  try {
    renderFn(...args);
  } catch (error) {
    showChartError(container, chartName, error);
  }
}
