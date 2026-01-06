/**
 * Sunlight Times Module
 * Handles loading and displaying sunrise/sunset data
 */

/**
 * Sunlight data store
 */
class SunlightDataStore {
  constructor() {
    this.sunlightTimesData = null;
  }

  /**
   * Load sunlight times data from JSON
   *
   * @returns {Promise<void>}
   */
  async load() {
    try {
      const response = await fetch(`/data/sunlight_times.json?t=${Date.now()}`);
      this.sunlightTimesData = await response.json();
    } catch (error) {
      console.warn('Could not load sunlight times:', error);
      this.sunlightTimesData = null;
    }
  }

  /**
   * Get sunlight times for a specific station and date
   *
   * @param {string} stationKey - Station identifier
   * @param {string} dateStr - Date in YYYY-MM-DD format
   * @returns {Object|null} Sunlight times or null if not found
   */
  getForDate(stationKey, dateStr) {
    if (!this.sunlightTimesData || !this.sunlightTimesData.stations || !this.sunlightTimesData.stations[stationKey]) {
      return null;
    }

    const station = this.sunlightTimesData.stations[stationKey];
    return station.days[dateStr] || null;
  }
}

/**
 * Display sunlight times for a station
 *
 * @param {string} stationKey - Station identifier
 * @param {number} dayOffset - Day offset (0=today, 1=tomorrow, 2=day after)
 * @param {SunlightDataStore} sunlightStore - Sunlight data store
 * @param {Function} updateChartCallback - Callback to update chart when day changes
 * @returns {void}
 */
export function displaySunlightTimes(stationKey, dayOffset, sunlightStore, updateChartCallback) {
  const container = document.getElementById('sunlight-widget');
  if (!container) return;

  // Get target date in Pacific timezone based on offset
  const pacific = 'America/Vancouver';
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: pacific,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(now);
  const year = parseInt(parts.find(p => p.type === 'year').value);
  const month = parseInt(parts.find(p => p.type === 'month').value);
  const day = parseInt(parts.find(p => p.type === 'day').value);

  // Create target date and apply offset
  const targetDate = new Date(year, month - 1, day);
  targetDate.setDate(targetDate.getDate() + dayOffset);

  const targetYear = targetDate.getFullYear();
  const targetMonth = targetDate.getMonth() + 1;
  const targetDay = targetDate.getDate();
  const targetDateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;

  // Get sunlight times for the target date
  const sunlight = sunlightStore.getForDate(stationKey, targetDateStr);

  // Check if we have sunlight data for this station
  if (!sunlight) {
    container.style.display = 'none';
    return;
  }

  // Parse times
  const firstLight = new Date(sunlight.first_light);
  const sunrise = new Date(sunlight.sunrise);
  const sunset = new Date(sunlight.sunset);
  const lastLight = new Date(sunlight.last_light);

  // Format to local time
  const timeOptions = { hour: 'numeric', minute: '2-digit', timeZone: 'America/Vancouver' };
  const firstLightStr = firstLight.toLocaleTimeString('en-US', timeOptions);
  const sunriseStr = sunrise.toLocaleTimeString('en-US', timeOptions);
  const sunsetStr = sunset.toLocaleTimeString('en-US', timeOptions);
  const lastLightStr = lastLight.toLocaleTimeString('en-US', timeOptions);

  // Calculate daylight duration
  const daylightDurationMs = sunset - sunrise;
  const hours = Math.floor(daylightDurationMs / (1000 * 60 * 60));
  const minutes = Math.floor((daylightDurationMs % (1000 * 60 * 60)) / (1000 * 60));
  const daylightDuration = `${hours}h ${minutes}m`;

  // Format date label for heading
  const dateStr = targetDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
  let dayLabel = '';
  if (dayOffset === 0) {
    dayLabel = `Today (${dateStr})`;
  } else if (dayOffset === 1) {
    dayLabel = `Tomorrow (${dateStr})`;
  } else {
    dayLabel = dateStr;
  }

  // Build modern card-based layout
  container.innerHTML = `
    <div class="tide-data-group">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
        <h3 style="margin: 0;">Sunlight Times for ${dayLabel}</h3>
        <div class="chart-nav-buttons" style="display: flex; gap: 0.5rem;">
          <button id="sunlight-prev-day-btn" title="Previous day" style="padding: 0.5rem 1rem; background: #0077be; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem;">◀</button>
          <button id="sunlight-next-day-btn" title="Next day" style="padding: 0.5rem 1rem; background: #0077be; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem;">▶</button>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 1rem;">

        <!-- First Light Card -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="font-size: 1.5rem; margin-bottom: 0.25rem;">🌅</div>
          <div style="font-size: 0.85rem; opacity: 0.9; margin-bottom: 0.25rem;">First Light</div>
          <div style="font-size: 1.3rem; font-weight: bold;">${firstLightStr}</div>
          <div style="font-size: 0.75rem; opacity: 0.8; margin-top: 0.25rem;">Civil Dawn</div>
        </div>

        <!-- Sunrise Card -->
        <div style="background: linear-gradient(135deg, #d88ab8 0%, #d97685 100%); color: white; padding: 1rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="font-size: 1.5rem; margin-bottom: 0.25rem;">🌄</div>
          <div style="font-size: 0.85rem; opacity: 0.9; margin-bottom: 0.25rem;">Sunrise</div>
          <div style="font-size: 1.3rem; font-weight: bold;">${sunriseStr}</div>
          <div style="font-size: 0.75rem; opacity: 0.8; margin-top: 0.25rem;">Sun Above Horizon</div>
        </div>

        <!-- Sunset Card -->
        <div style="background: linear-gradient(135deg, #e8945f 0%, #f5c563 100%); color: white; padding: 1rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="font-size: 1.5rem; margin-bottom: 0.25rem;">🌇</div>
          <div style="font-size: 0.85rem; opacity: 0.9; margin-bottom: 0.25rem;">Sunset</div>
          <div style="font-size: 1.3rem; font-weight: bold;">${sunsetStr}</div>
          <div style="font-size: 0.75rem; opacity: 0.8; margin-top: 0.25rem;">Sun Below Horizon</div>
        </div>

        <!-- Last Light Card -->
        <div style="background: linear-gradient(135deg, #6ba3d4 0%, #5cb5d1 100%); color: white; padding: 1rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="font-size: 1.5rem; margin-bottom: 0.25rem;">🌆</div>
          <div style="font-size: 0.85rem; opacity: 0.9; margin-bottom: 0.25rem;">Last Light</div>
          <div style="font-size: 1.3rem; font-weight: bold;">${lastLightStr}</div>
          <div style="font-size: 0.75rem; opacity: 0.8; margin-top: 0.25rem;">Civil Dusk</div>
        </div>

      </div>

      <!-- Daylight Duration Summary -->
      <div style="margin-top: 1rem; padding: 0.75rem; background: #f7fafc; border-radius: 6px; border-left: 4px solid #0077be;">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <div style="font-size: 1.5rem;">☀️</div>
          <div>
            <div style="font-size: 0.85rem; color: #666;">Daylight Duration</div>
            <div style="font-size: 1.2rem; font-weight: bold; color: #0077be;">${daylightDuration}</div>
          </div>
        </div>
      </div>
    </div>
  `;

  container.style.display = 'block';

  // Add event listeners for sunlight day navigation buttons
  const sunlightPrevBtn = document.getElementById('sunlight-prev-day-btn');
  const sunlightNextBtn = document.getElementById('sunlight-next-day-btn');

  if (sunlightPrevBtn && sunlightNextBtn) {
    // Update button states
    sunlightPrevBtn.disabled = dayOffset === 0;
    sunlightNextBtn.disabled = dayOffset === 2; // We have 3 days of data (0-2)

    sunlightPrevBtn.style.opacity = dayOffset === 0 ? '0.3' : '1';
    sunlightNextBtn.style.opacity = dayOffset === 2 ? '0.3' : '1';
    sunlightPrevBtn.style.cursor = dayOffset === 0 ? 'not-allowed' : 'pointer';
    sunlightNextBtn.style.cursor = dayOffset === 2 ? 'not-allowed' : 'pointer';

    // Add click handlers
    sunlightPrevBtn.addEventListener('click', () => {
      if (dayOffset > 0) {
        updateChartCallback(-1); // decrement day
      }
    });

    sunlightNextBtn.addEventListener('click', () => {
      if (dayOffset < 2) {
        updateChartCallback(1); // increment day
      }
    });
  }
}

export { SunlightDataStore };
