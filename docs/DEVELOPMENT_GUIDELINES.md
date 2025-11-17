# Development Guidelines

## File Permissions

### Critical: Set Permissions on File Creation

**Problem**: Files created via Write tool default to `600` permissions (owner read/write only), which prevents the web server from serving them.

**Solution**: Always set permissions to `644` immediately after creating any web-accessible file.

### Standard Practice

When creating new files in the web directory, follow this pattern:

```bash
# After creating a file with Write tool:
chmod 644 /path/to/new/file.js
chmod 644 /path/to/new/file.css
chmod 644 /path/to/new/file.html
```

### Required Permissions by File Type

- **JavaScript files** (`.js`): `644` (`-rw-r--r--`)
- **CSS files** (`.css`): `644` (`-rw-r--r--`)
- **HTML files** (`.html`): `644` (`-rw-r--r--`)
- **JSON data files** (`.json`): `644` (`-rw-r--r--`)
- **Image files** (`.png`, `.jpg`, `.ico`): `644` (`-rw-r--r--`)
- **Markdown docs** (`.md`): `644` (`-rw-r--r--`)
- **Directories**: `755` (`drwxr-xr-x`)

### Verification Command

After creating files, verify permissions:

```bash
ls -lh /path/to/file
```

Expected output: `-rw-r--r--` (644)

### Batch Fix Command

If multiple files have wrong permissions:

```bash
# Fix all JS files
find /home/keelando/site/assets/js -type f -name "*.js" -exec chmod 644 {} \;

# Fix all CSS files
find /home/keelando/site/assets/css -type f -name "*.css" -exec chmod 644 {} \;

# Fix all HTML files
find /home/keelando/site -maxdepth 1 -type f -name "*.html" -exec chmod 644 {} \;
```

## Historical Issues

### 2025-11-17: Logger.js Permission Issue
- **File**: `/home/keelando/site/assets/js/logger.js`
- **Problem**: Created with `600` permissions, web server couldn't serve it
- **Symptom**: `ReferenceError: logger is not defined` in browser console
- **Solution**: `chmod 644 /home/keelando/site/assets/js/logger.js`
- **Lesson**: Always set permissions immediately after file creation

## Code Quality Standards

### Logging
- Use centralized logger (`logger.debug()`, `logger.info()`, `logger.warn()`, `logger.error()`)
- Never use raw `console.*` statements (except in logger.js itself)
- Always provide context as first parameter: `logger.error('ComponentName', 'Error message', error)`

### JavaScript Best Practices
- Use strict mode when appropriate
- Prefer `const` and `let` over `var`
- Use template literals for string interpolation
- Handle errors gracefully with try/catch
- Validate function parameters
- Use JSDoc comments for public functions

### Mobile Responsiveness
- Test responsive sampling for visual elements (e.g., wind arrows: 6h mobile, 3h desktop)
- Use `window.innerWidth < 600` as mobile breakpoint
- Always test on mobile before deploying

### Wind Arrow Rotation (CRITICAL - Easy to Mess Up!)

**Important**: Wind arrow rotation is tricky and easy to get wrong. Document carefully!

#### Arrow Symbol
Custom centered arrow: `'path://M0,12 L-4,-8 L0,-6 L4,-8 Z'`
- Default orientation: Arrow points **DOWN** (South) at 0° rotation
- Centered at origin (0,0) to prevent offset during rotation
- Arrow point at (0,12), base at top

#### Meteorological Convention
Wind direction indicates where wind is **COMING FROM**:
- 0° = North (wind coming from North, blowing toward South)
- 90° = East (wind coming from East, blowing toward West)
- 180° = South (wind coming from South, blowing toward North)
- 270° = West (wind coming from West, blowing toward East)

#### Display Convention
Use meteorological direction **directly** (arrow points down by default):

```javascript
symbolRotate: direction  // Use direction value directly
```

**Note**: NO +180° needed because our arrow points DOWN by default, matching the meteorological convention.

#### Expected Behavior
**Test these cardinal directions to verify rotation is correct:**

| Wind Direction | From → To | Arrow Should Point | Rotation | Result |
|----------------|-----------|-------------------|----------|---------|
| 0° (North) | N → S | **DOWN** (↓) | 0° | DOWN |
| 90° (East) | E → W | **LEFT** (←) | 90° | LEFT |
| 180° (South) | S → N | **UP** (↑) | 180° | UP |
| 270° (West) | W → E | **RIGHT** (→) | 270° | RIGHT |

**CRITICAL RULE**: **0 degrees North = arrow points straight DOWN** ↓

#### ECharts Rotation Convention
In ECharts (SVG/Canvas coordinates):
- Y-axis increases downward
- Rotation is clockwise
- Our arrow points DOWN by default
- 0° rotation = arrow points DOWN
- 90° rotation = arrow points LEFT
- 180° rotation = arrow points UP
- 270° rotation = arrow points RIGHT

#### Common Mistakes
❌ **Wrong**: Adding 180° to the direction
```javascript
symbolRotate: (direction + 180) % 360  // WRONG - arrow already points down
```

❌ **Wrong**: Using arrow that points UP by default
```javascript
symbol: 'path://M0,-12 L-4,8 L0,6 L4,8 Z'  // Points UP, needs +180°
```

✅ **Correct**: Use direction directly with DOWN-pointing arrow
```javascript
symbol: 'path://M0,12 L-4,-8 L0,-6 L4,-8 Z',  // Points DOWN
symbolRotate: direction  // Use directly, no modification needed
```

**Key Principle**: Match the buoy card implementation in `main.js:getDirectionalArrow()`

#### Testing
Always test with real wind data and verify:
1. North wind (0°) → Arrow points down
2. East wind (90°) → Arrow points left
3. South wind (180°) → Arrow points up
4. West wind (270°) → Arrow points right

#### File Location
Implementation: `/home/keelando/site/assets/js/wind-chart-v4.js` (line 44)

## Git Workflow

### Committing Changes
- Only commit when explicitly requested by user
- Write clear, descriptive commit messages
- Follow conventional commit format when appropriate
- Include co-author attribution as specified in git guidelines

## File Organization

### Directory Structure
```
/home/keelando/site/
├── assets/
│   ├── js/          # JavaScript modules
│   └── css/         # Stylesheets
├── data/            # JSON data files
├── docs/            # Documentation and planning
└── *.html           # HTML pages (root level)
```

### Documentation Location
- Implementation docs: `/docs/`
- Future enhancements: `/docs/FUTURE_ENHANCEMENTS.md`
- Development guidelines: `/docs/DEVELOPMENT_GUIDELINES.md` (this file)
- Planning/analysis: Keep in `/docs/` to avoid root clutter

## Testing Checklist

Before deploying changes:
- [ ] Check file permissions (`ls -lh`)
- [ ] Verify no console.* statements (except in logger.js)
- [ ] Test on desktop browser
- [ ] Test on mobile browser or responsive mode
- [ ] Hard refresh browser (Ctrl+Shift+R / Cmd+Shift+R)
- [ ] Check browser console for errors
- [ ] Verify all charts/features load correctly
