# Project Lessons & Troubleshooting

## 1. Electron Startup GPU & Sandbox Crash on Windows
- **Issue:** Launching Electron with `electron .` resulted in `GPU process exited unexpectedly: exit_code=-2147483645` and `GPU process isn't usable. Goodbye.`
- **Root Cause:** Chromium's sandbox or GPU process failed to initialize properly, which is common in virtualized, remote desktop, or GPU-restricted environments.
- **Solution:** 
  1. Appended command line switches to disable sandbox, GPU acceleration, and software rasterizers directly in `main.js`:
     ```javascript
     app.commandLine.appendSwitch('no-sandbox');
     app.commandLine.appendSwitch('disable-gpu');
     app.commandLine.appendSwitch('disable-software-rasterizer');
     app.disableHardwareAcceleration();
     ```
  2. Modified the developer run scripts in `package.json` to explicitly launch Electron with the safety flags:
     ```json
     "electron:dev": "electron . --no-sandbox --disable-gpu --disable-software-rasterizer"
     ```
  3. This ensures maximum compatibility across all testing environments (VMs, cloud environments, headless instances, etc.).

## 2. Canvas Zooming and Panning Coordinate Mapping
- **Challenge:** Mapping mouse clicks back to natural image pixel coordinates after arbitrary translation (`offsetX`, `offsetY`) and zoom scaling (`scale`).
- **Solution:** Instead of manually transforming every coordinate during rendering, apply CSS 2D Transforms (`transform: translate(offsetX, offsetY) scale(scale);`) to the parent container holding both the canvas and the SVG overlay.
- **Mouse Event Mapping Formula:**
  ```javascript
  const rect = container.getBoundingClientRect();
  const naturalX = (clientX - rect.left) / scale;
  const naturalY = (clientY - rect.top) / scale;
  ```
  This is extremely performant (hardware accelerated) and ensures that coordinates are always matched exactly to the natural image resolution regardless of scaling.

## 3. DOM Destruction During Active Drag & Drop Actions
- **Issue:** Moving or resizing a shape would immediately freeze or fail after moving 1px.
- **Root Cause:** Clicking or hover state changes on the elements triggered functions (like `selectArea` or mouse hover events) that rebuilt the entire SVG overlay (`this.svg.innerHTML = ''`). Since the browser cancels the drag-and-drop session immediately if the element that received `mousedown` is removed from the DOM, this destroyed the mouse-tracking state.
- **Elegant Solution (In-Place CSS Class Toggling)**:
  1. **Always Render Handles in DOM**: Avoid dynamically adding/removing handle elements on hover or selection in Javascript. Instead, render handles for *all* shapes inside the group elements in `renderShapes()`.
  2. **Control Visibility in CSS**: Hide handles by default (`display: none` on `.resize-handle`), and display them only when the group is hovered or selected (`.area-group.hovered .resize-handle`, `.area-group.selected .resize-handle { display: block; }`).
  3. **In-place Selection Update**: Modify `selectArea(id)` to update the `.selected` class on the shape and group elements in-place (`group.classList.toggle('selected', isSelected)`) instead of resetting `innerHTML` and rebuilding the DOM.
  4. **In-place Hover Update**: Update `mouseenter` and `mouseleave` listeners to toggle the `.hovered` class on the group element in-place.
  5. **Result**: The clicked elements are *never* destroyed or recreated on click, hover, or drag start. Toggling selection and hover states is now instantaneous, GPU-accelerated, and 100% robust, preserving browser pointer capture perfectly.

## 4. HTML Project Importing & Live Bidirectional Code Editing
- **HTML Parsing**: Using browser-native `DOMParser` in the renderer, we extract `<map>` and `<area>` properties to seamlessly reconstruct coordinates and links. This allows importing standard/external HTML image maps even if they lack specialized editor tags (using standard `coords` as fallback for `data-coords`).
- **Relative Path Resolution**: Relative image sources in imported HTML maps (e.g. `src="image.png"`) are resolved in the desktop app via an Electron main process handler using Node's `path.resolve(path.dirname(htmlPath), imageSrc)` and read as base64 URLs for sandbox-friendly loading.
- **Bidirectional Live Editing**: Replacing the read-only preview with a `<textarea>` and adding a debounced/manual "Apply Code" handler (triggered by clicking the Play icon or pressing `Ctrl + Enter` in the textarea) allows editing HTML code on the fly and immediately reflecting it on the drawing canvas without interrupting user typing with cursor-jumps.
- **Zoomable Navigator Coordinate Mapping**: To support zooming the thumbnail itself, we wrap it in a `#minimap-content` container. We dynamically calculate and apply a scale and translation transform (`translate(dx, dy) scale(s)`) to center the active viewport box. Clicks on the zoomed thumbnail are mapped back to image coordinates using the inverse transform: `u = (clientX - left - dx) / s`. This resolves aspect-ratio issues for extremely portrait/tall images by keeping the active area centered and magnification sharp.

## 5. Electron Production Build Local Testing
- **Challenge**: Standard checks like `!app.isPackaged` evaluate to `true` during developer runs (`electron .`), forcing the application to attempt loading `http://localhost:5173/`, resulting in connection errors unless the Vite dev server is running.
- **Solution**: Refactored the environment evaluation to:
  ```javascript
  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';
  ```
  Setting `NODE_ENV=production` when running `npm run electron:dev` redirects Electron to load assets directly from `dist/index.html`. This enables instant and seamless end-to-end local validation of compiled production builds.
