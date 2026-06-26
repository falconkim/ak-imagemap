# Image Map Editor Development Tasks

## 1. Project Setup
- [x] Initialize `package.json` with dependencies (Electron, Vite)
- [x] Write `vite.config.js` and IPC bridge scripts (`main.js`, `preload.js`)
- [x] Install packages using `npm install --ignore-scripts`
- [x] Perform package audit and verify safe configuration

## 2. Layout & Styling (CSS)
- [x] Create `index.html` structure with toolbar, 3-panel workspace, and status bar
- [x] Create `src/css/style.css` with a premium dark/glassmorphic design system

## 3. Network & Utilities
- [x] Create `src/js/network.js` for HTTP image checks and error reporting
- [x] Create `src/js/parser.js` for HTML/JSON import-export parsing and RWD script generator

## 4. Canvas Drawing Core
- [x] Create `src/js/canvas.js` drawing engine
  - [x] Canvas rendering, image loading, Zoom & Pan (Space + Drag)
  - [x] Rect, Circle, and Poly drawing interactions
  - [x] Selection, movement, and resizing handles
  - [x] Grid toggles and Snap coordinates logic
  - [x] Keyboard Arrow Key Nudge (1px shift, 10px shift with Shift key)
  - [x] History Manager (Undo/Redo up to 30 actions)

## 5. App Integration & Layer Management
- [x] Implement `src/js/app.js` main logic
  - [x] Toolbar state binding (draw tool active states, toggle grid, zoom, reset)
  - [x] Layer list panel (list areas, select, double-click rename, delete via key)
  - [x] Property panel (href, target, alt synchronization)
  - [x] Export HTML / JSON save & load dialog trigger integration

## 6. Review & Testing
- [x] Test local and network image loading and error displaying
- [x] Verify drawing accuracy, shape resizing, and coordinate scaling
- [x] Verify Undo/Redo history stack bounds
- [x] Test code exporting options (RWD check, HTML, JSON import/export)
- [x] Verify that final app launches and displays clean UX

## 7. Project Review & Results
- **Layout & CSS**: Premium dark-theme glassmorphic design implemented with custom fonts (Outfit & JetBrains Mono) and Remix Icons.
- **Canvas Engine**: Canvas-based render, SVG-based editing overlay, 3 shapes (Rect, Circle, Poly) with active resize handles, Undo/Redo history stack, Grid Snapping, and Keyboard Nudges are fully functional.
- **Network Handler**: Main-process proxy fetching bypasses CORS restrictions and yields detailed HTTP error reports (404, 403, 500, etc.).
- **Data Integrations**: Seamless IPC bridge to native Open/Save dialogs for project files (JSON) and exported pages (HTML) with optional responsive scripts.
- **Launcher Validation**: Confirmed successful dev startup (`RUNNING` status) by adding command-line switches to bypass GPU and sandbox crashes. Packaging configuration compiles fully.

## 8. Enhancements (User Requests)
- [x] Reduce header and sidebar menu text sizes for a more compact UI
- [x] Implement hover trigger on shapes to display pulsing/blinking resize handles
- [x] Fix canvas viewport flex-centering overflow by absolutely positioning the canvas container
- [x] Maximize image width fit on load (fit to viewport width)
- [x] Implement Ctrl + Drag copying of image map areas with real-time coordinate updates
- [x] Add dragging/clicking navigator minimap frame to pan canvas image
- [x] Change canvas zoom to Ctrl + Wheel and default scroll wheel to pan canvas
- [x] Fix resize handles selection click issue to enable resizing immediately
- [x] Change upper menu font to Windows default system font, size 12px, white-space nowrap
- [x] Add "Width Fit" button in the upper toolbar next to Zoom Fit

## 9. Web Compatibility (Web Mode Support)
- [ ] Add hidden file inputs in `index.html` for web mode fallback
- [ ] Implement browser fallback download and upload file readers in `app.js`
- [ ] Implement browser fetch fallback with CORS warnings in `network.js`

## 10. Desktop Bug Fixes & Copy-Paste Enhancement
- [x] Fix shape dragging/resizing freeze issue (prevent DOM destruction on mousedown/hover)
  - [x] Add `skipRender` parameter to `selectArea` to prevent `renderShapes` on mousedown
  - [x] Guard `mouseenter` and `mouseleave` shape group listeners to prevent clearing SVG while dragging/resizing
- [x] Fix Ctrl + Drag copy function
  - [x] Create/append copied shape clone at original coordinates and keep dragging original shape (ensuring smooth visual feedback and no DOM destruction)
- [x] Implement Ctrl + C / Ctrl + V copy-paste functionality
  - [x] Support keyboard shortcuts (Ctrl+C to copy selected shape, Ctrl+V to paste)
  - [x] Shift coords of pasted shape by +10px horizontally (X-axis) relative to the original/previous shape
  - [x] Push to history and select the pasted shape

## 11. CSS-based Resize Handles Visibility & In-Place Selection (Robust Drag & Drop)
- [x] Modify `renderShapes()` in `canvas.js` to always append resize handles for all shapes
- [x] Update `src/css/style.css` to hide `.resize-handle` by default and display them only under `.area-group.selected` or `.area-group.hovered`
- [x] Update `selectArea()` in `canvas.js` to update classes in-place instead of calling `renderShapes()`
- [x] Update hover events in `canvas.js` to toggle `.hovered` class in-place instead of calling `renderShapes()`
- [x] Clean up viewport deselect handler to use `selectArea(null)`

## 12. Support Loading HTML Projects & Live HTML Editing
- [x] Implement `file:resolveImage` IPC handler in `main.js` to resolve and read local image paths relative to the HTML project file
- [x] Expose `resolveImage` API in `preload.js`
- [x] Create `parseHTML(htmlContent)` in `src/js/parser.js` using `DOMParser` to extract map ID, areas, and image source
- [x] Update `app.js` project loader to support loading HTML files (with remote URL, local path, and base64 handling, plus manual image picker fallback)
- [x] Make HTML code block editable by replacing `#code-output` with a styled `<textarea>` and adding an "Apply" button in the panel header
- [x] Add Ctrl + Enter shortcut and "Apply" button handler in `app.js` to parse editable code and sync coordinates/shapes back to the canvas in real-time
- [x] Verify HTML loading and live HTML editing functionality

## 13. Preserve Remote Image URLs on Import/Export
- [x] Update `updateCode` in `app.js` to use `currentImageInfo.path` if it is a remote URL or data URL, ensuring it is preserved in the live HTML code panel
- [x] Update `btnExportHtml` listener in `app.js` to also use `currentImageInfo.path` for remote/data URLs when saving HTML files
- [x] Verify that importing an HTML file with a remote image URL correctly displays the image and preserves the URL in the live code panel and exported file

## 14. Installer Existing Install Check & Update Message
- [x] Create custom NSIS script `installer.nsh` in project root with `customInit` macro to detect existing application registry entry and show an update prompt
- [x] Update `build` configuration in `package.json` to include `"nsis"` block referencing `installer.nsh` and setting `oneClick: false`
- [x] Verify electron-builder configuration is correct

## 15. GitHub Open-Source Preparation
- [x] Create `.gitignore` file to exclude build directories, node_modules, app data, logs, and temporary developer files
- [x] Create a comprehensive, user-friendly `README.md` detailing the project, features, system requirements, usage, and build instructions
- [x] Document what to upload/commit and what to ignore for security and repository hygiene

## 16. UI Enhancements (Navigator Controls & Resizable Right Panel)
- [x] Add zoom-in, zoom-out, and 1:1 scale buttons to the left panel navigator header
- [x] Implement aspect-ratio based dynamic vertical height scaling for the navigator section
- [x] Add right-panel resizer handle to allow dragging and adjusting its width dynamically (clamped between 250px and 600px)
- [x] Verify layout resizing keeps canvas rendering and coordinate overlays fully synchronized

## 17. Final Bug Fixes (Minimap Zoom Align, Compact Toolbar, Close Prompt)
- [x] 17-1. Correct Navigator Minimap:
  - [x] Remove `width: 100%` and `height: 100%` from `.minimap-content` in `style.css` so that it respects size matching image aspect ratio
  - [x] Verify that zoom controls (In, Out, 1:1) scale the image properly and viewport box adjusts in-place
- [x] 17-2. Responsive Toolbar Design:
  - [x] Add `@media` queries in `style.css` for screen widths `<= 1350px` and `<= 1150px`
  - [x] Under 1350px: shrink paddings, font size to 10px-11px, map ID input width
  - [x] Under 1150px: hide logo text and text labels on buttons (showing only icons with standard hover tooltips), hide "Map ID" label to fit compact screens perfectly
- [x] 17-3. Unsaved Work Close Dialog Tracking:
  - [x] Declare and track `isDirty` state in `app.js` (set to `true` on area/property additions or edits if `isLoading === false`, reset to `false` on load/save/new)
  - [x] Add `beforeunload` browser fallback dirty confirmation check
  - [x] Integrate IPC listeners: `window.api.onCheckDirty` (replies with `{ isDirty }`) and `window.api.onTriggerSaveAndClose` (calls `triggerSaveProject()`, then `window.api.forceClose()`)
  - [x] Verify save callbacks and dialog choice outputs in `main.js` (including '저장하고 종료', '저장하지 않고 종료', and '취소')
- [x] 17-4. Verification & Testing:
  - [x] Compile assets (`npm run build`) and run Electron (`npm run dev` or `npm run electron:dev`) to verify all three requested features
  - [x] Document final results in `tasks/todo.md` and capture any lessons in `tasks/lessons.md`

## 18. Project Review & Results (Iteration 2)
- **Navigator Minimap Zooming**: Removed the hardcoded percentage constraint on the minimap content wrapper in [style.css](file:///E:/NODE_ROOT/ak-imagemap/src/css/style.css), letting the Javascript size the thumbnail container to match the loaded image aspect ratio. The zoom buttons and clicking navigation calculations now center and pan the canvas accurately under custom `minimapScale` factors.
- **Responsive Toolbar**: Designed media query rules in [style.css](file:///E:/NODE_ROOT/ak-imagemap/src/css/style.css) targeting widths <= 1350px and <= 1150px. The toolbar scales compactly, and on narrow displays it hides the text labels to ensure no wrapping or clipping occurs.
- **Unsaved Changes Closing Dialog**: Configured standard `beforeunload` checks for web browser mode, and hooked window close interception inside [main.js](file:///E:/NODE_ROOT/ak-imagemap/main.js) to request dirty states. In [app.js](file:///E:/NODE_ROOT/ak-imagemap/src/js/app.js), the state `isDirty` is set to `true` upon any edits/additions (under canvas activity blocks and code applications) and reset to `false` upon project new/loads or successful saves. The close prompts correctly trigger saving and force-close IPC commands.
## 19. Minimap Width Fit & Responsive Toolbar Text (Iteration 3)
- [x] 19-1. Minimap Initial & Zoom Width Fit:
  - [x] Add the "Width Fit" button inside the navigator header controls in `index.html` (remix icon `ri-expand-left-right-line` or similar)
  - [x] Define the width fit scaling calculation: `widthFitScale = ratioX / fitRatio` inside `updateMinimapViewport()`
  - [x] Ensure that upon initial image load (`setupLoadedState()`), the minimap automatically sets its scale to this "width fit" scale
  - [x] Implement click listener for `btnNavZoomWidth` to apply "width fit" zoom scale to the navigator
- [x] 19-2. 1600px Toolbar Text Visibility:
  - [x] Update `style.css` media queries: hide text labels on buttons (both `.tool-btn span` and `.action-btn span`) and map ID label when screen width is `< 1600px` (i.e. `@media (max-width: 1600px)`)
  - [x] Keep text labels visible only when screen width is `>= 1600px`
- [x] 19-3. Verification & Testing:
  - [x] Build assets with `npm run build` and run Electron dev shell to test layout and scale functionalities

## 20. Project Review & Results (Iteration 3)
- **Minimap Width-Fit Default & Control**: Added the `btn-nav-zoom-width` button inside [index.html](file:///E:/NODE_ROOT/ak-imagemap/index.html) and registered its selection and event handling inside [app.js](file:///E:/NODE_ROOT/ak-imagemap/src/js/app.js). The width fit scale calculation (`ratioX / fitRatio`) calculates the exact multiplier needed to expand portrait thumbnails to fit the navigator container width. Setting `minimapScale` to this default on new image loads ensures it starts at width-fit, while the button lets users reapply this zoom level.
- **1600px Toolbar Text Breakpoint**: Modified the media queries in [style.css](file:///E:/NODE_ROOT/ak-imagemap/src/css/style.css) to hide button text labels and the Map ID input text label below 1600px screen width. This allows the application toolbar to occupy minimal horizontal space, preventing any overlapping on smaller monitors.
- **Build Verification**: Compiled assets successfully using Vite, producing clean production files in `dist/`.

## 21. GitHub Guide & Exclusion (Iteration 4)
- [x] 21-1. Create `GITHUB_GUIDE.md` containing the step-by-step GitHub upload guide, fork-and-pull-request model explanation, and PR code review methods.
- [x] 21-2. Exclude `GITHUB_GUIDE.md` in `.gitignore` so it is not pushed to the public repository.

## 22. Project Review & Results (Iteration 4)
- **Local GitHub Guide Creation**: Compiled the instructions regarding initial git initialization, staging rules, licensing, and pull request testing methods into a dedicated [GITHUB_GUIDE.md](file:///E:/NODE_ROOT/ak-imagemap/GITHUB_GUIDE.md) document at the root of the project.
- **Git Excludes List Integration**: Appended `GITHUB_GUIDE.md` to the [.gitignore](file:///E:/NODE_ROOT/ak-imagemap/.gitignore) rules, ensuring this local documentation reference is kept exclusively for local development and not uploaded publicly to GitHub.
