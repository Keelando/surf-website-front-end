/**
 * Warning Banner Module
 * Displays marine weather warnings from Environment Canada
 *
 * Features:
 * - Dismissible warnings with X button
 * - State persisted across pages (localStorage)
 * - Auto-expires after 24 hours
 *
 * Usage:
 *   1. Include this script in your HTML
 *   2. Add a <div id="warning-banner-container"></div> element where you want warnings to appear
 *   3. Call displayWarningBanners() after page load
 */

// Configuration
const STORAGE_KEY = 'dismissed_marine_warnings';
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate unique ID for a warning
 * @param {Object} warning - Warning object
 * @returns {string} Unique warning ID
 */
function getWarningId(warning) {
  // Use zone, type, and issued time to create unique ID
  const issued = warning.issued_utc || 'unknown';
  return `${warning.zone_key}_${warning.type}_${issued}`;
}

/**
 * Check if warning has been dismissed
 * @param {string} warningId - Warning ID
 * @returns {boolean} True if dismissed and not expired
 */
function isWarningDismissed(warningId) {
  try {
    const dismissed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const dismissedTime = dismissed[warningId];

    if (!dismissedTime) return false;

    // Check if dismissal has expired
    const elapsed = Date.now() - dismissedTime;
    if (elapsed > DISMISS_DURATION_MS) {
      // Expired - clean up
      delete dismissed[warningId];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dismissed));
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error checking dismissed warnings:', error);
    return false;
  }
}

/**
 * Dismiss a warning
 * @param {string} warningId - Warning ID to dismiss
 */
function dismissWarning(warningId) {
  try {
    const dismissed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    dismissed[warningId] = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dismissed));

    // Remove warning banner from DOM
    const banner = document.querySelector(`[data-warning-id="${warningId}"]`);
    if (banner) {
      banner.style.opacity = '0';
      banner.style.transition = 'opacity 0.3s ease';

      setTimeout(() => {
        banner.remove();

        // Hide container if no warnings left
        const container = document.getElementById('warning-banner-container');
        if (container && container.querySelectorAll('.warning-banner').length === 0) {
          container.style.display = 'none';
        }
      }, 300);
    }
  } catch (error) {
    console.error('Error dismissing warning:', error);
  }
}

/**
 * Fetch and display warning banners
 * @param {string} containerId - ID of container element (default: 'warning-banner-container')
 */
async function displayWarningBanners(containerId = 'warning-banner-container') {
  const container = document.getElementById(containerId);

  if (!container) {
    console.warn(`Warning banner container '${containerId}' not found`);
    return;
  }

  try {
    const response = await fetch('/data/marine_forecast.json');
    if (!response.ok) {
      console.warn('Marine forecast data not available');
      return;
    }

    const data = await response.json();
    const warnings = collectActiveWarnings(data);

    // Filter out dismissed warnings
    const activeWarnings = warnings.filter(warning => {
      const warningId = getWarningId(warning);
      return !isWarningDismissed(warningId);
    });

    if (activeWarnings.length === 0) {
      // No active warnings - hide container
      container.style.display = 'none';
      return;
    }

    // Build and display warning banners
    container.innerHTML = activeWarnings.map(w => createWarningBanner(w)).join('');
    container.style.display = 'block';

    // Attach dismiss handlers
    activeWarnings.forEach(warning => {
      const warningId = getWarningId(warning);
      const dismissBtn = container.querySelector(`[data-warning-id="${warningId}"] .warning-dismiss-btn`);

      if (dismissBtn) {
        dismissBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          dismissWarning(warningId);
        });
      }
    });

  } catch (error) {
    console.error('Error loading marine forecast warnings:', error);
    container.style.display = 'none';
  }
}

/**
 * Collect all active warnings from forecast data
 * @param {Object} data - Marine forecast data
 * @returns {Array} Array of warning objects
 */
function collectActiveWarnings(data) {
  const warnings = [];

  if (!data.locations) return warnings;

  for (const [zoneKey, zoneData] of Object.entries(data.locations)) {
    if (zoneData.warnings && Array.isArray(zoneData.warnings)) {
      zoneData.warnings.forEach(warning => {
        if (warning.status === 'IN EFFECT') {
          warnings.push({
            ...warning,
            zone_key: zoneKey,
            zone_name: zoneData.zone_name || warning.location
          });
        }
      });
    }
  }

  // Sort by severity (Storm > Gale > Strong Wind)
  warnings.sort((a, b) => {
    const severityOrder = {
      'Storm warning': 1,
      'Storm': 1,
      'Gale warning': 2,
      'Gale': 2,
      'Strong wind warning': 3,
      'Strong wind': 3
    };

    const aSeverity = severityOrder[a.type] || 99;
    const bSeverity = severityOrder[b.type] || 99;

    return aSeverity - bSeverity;
  });

  return warnings;
}

/**
 * Create HTML for a warning banner
 * @param {Object} warning - Warning object
 * @returns {string} HTML string
 */
function createWarningBanner(warning) {
  const severityClass = getWarningSeverityClass(warning.type);
  const icon = getWarningIcon(warning.type);
  const warningId = getWarningId(warning);

  // Link to specific zone section on forecasts page
  const forecastLink = `/forecasts.html#${warning.zone_key}`;

  return `
    <div class="warning-banner ${severityClass}" data-warning-id="${warningId}">
      <div class="warning-banner-content">
        <span class="warning-icon" aria-hidden="true">${icon}</span>
        <div class="warning-text">
          <strong>${warning.type.toUpperCase()}</strong> in effect for ${warning.zone_name}
        </div>
        <a href="${forecastLink}" class="warning-details-link">View Forecast →</a>
        <button class="warning-dismiss-btn" aria-label="Dismiss warning" title="Dismiss for 24 hours">×</button>
      </div>
    </div>
  `;
}

/**
 * Get CSS class for warning severity
 * @param {string} type - Warning type
 * @returns {string} CSS class name
 */
function getWarningSeverityClass(type) {
  const typeLower = type.toLowerCase();

  if (typeLower.includes('storm')) return 'warning-storm';
  if (typeLower.includes('gale')) return 'warning-gale';
  if (typeLower.includes('strong wind')) return 'warning-strong-wind';

  return 'warning-default';
}

/**
 * Get icon for warning type
 * @param {string} type - Warning type
 * @returns {string} Icon emoji
 */
function getWarningIcon(type) {
  const typeLower = type.toLowerCase();

  if (typeLower.includes('storm')) return '⚠️';
  if (typeLower.includes('gale')) return '💨';
  if (typeLower.includes('strong wind')) return '🌬️';

  return '⚠️';
}

// Auto-initialize if container exists on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('warning-banner-container')) {
      displayWarningBanners();
    }
  });
} else {
  // DOM already loaded
  if (document.getElementById('warning-banner-container')) {
    displayWarningBanners();
  }
}
