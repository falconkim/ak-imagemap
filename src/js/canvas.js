/**
 * Canvas drawing engine for handling shape drawing, editing, panning, zooming,
 * undo/redo operations, grid & snapping, and interactive handle manipulation.
 */

export class CanvasManager {
  constructor(canvasId, svgId, containerId, viewportId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.svg = document.getElementById(svgId);
    this.container = document.getElementById(containerId);
    this.viewport = document.getElementById(viewportId);

    // Image state
    this.image = new Image();
    this.imageLoaded = false;
    this.imageInfo = { path: '', name: '', dataUrl: '', width: 0, height: 0 };

    // Canvas transformation state (Pan & Zoom)
    this.scale = 1.0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.minScale = 0.1;
    this.maxScale = 4.0;

    // Grid and Snapping
    this.gridEnabled = false;
    this.snapEnabled = false;
    this.gridSize = 20;

    // Tool state
    this.currentTool = 'select'; // select, rect, circle, poly, hand
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };

    // Editor data state
    this.areas = []; // List of areas
    this.selectedAreaId = null;
    this.hoveredAreaId = null;
    
    // Undo/Redo stack
    this.history = [[]];
    this.historyIndex = 0;
    this.maxHistory = 30;

    // Drawing state
    this.activeDrawMode = false;
    this.drawStart = { x: 0, y: 0 };
    this.polyPoints = []; // Temporary points for poly tool
    this.guidelinePoint = null; // Guide point for poly tool

    // Interaction state (moving/resizing)
    this.isDragging = false;
    this.isResizing = false;
    this.resizeHandleIndex = null; // index of the active vertex/handle being dragged
    this.dragStartCoords = { x: 0, y: 0 };
    this.draggedShapeOriginal = null; // copy of the shape before drag

    // Callbacks
    this.onSelectionChangedCallback = null;
    this.onAreasChangedCallback = null;
    this.onStatusChangedCallback = null;

    // Initialize Event Listeners
    this.initEvents();
  }

  // --- Callbacks Bindings ---
  onSelectionChanged(callback) { this.onSelectionChangedCallback = callback; }
  onAreasChanged(callback) { this.onAreasChangedCallback = callback; }
  onStatusChanged(callback) { this.onStatusChangedCallback = callback; }

  // --- Image Loader ---
  loadImage(dataUrl, name, path = '') {
    this.imageInfo = { path, name, dataUrl, width: 0, height: 0 };
    this.image.src = dataUrl;
    
    return new Promise((resolve, reject) => {
      this.image.onload = () => {
        this.imageLoaded = true;
        this.imageInfo.width = this.image.naturalWidth;
        this.imageInfo.height = this.image.naturalHeight;

        // Resize Canvas to fit Natural Image Dimensions
        this.canvas.width = this.image.naturalWidth;
        this.canvas.height = this.image.naturalHeight;

        // Position SVG exactly over the Canvas
        this.svg.setAttribute('viewBox', `0 0 ${this.canvas.width} ${this.canvas.height}`);
        this.svg.setAttribute('width', this.canvas.width);
        this.svg.setAttribute('height', this.canvas.height);

        this.container.style.width = `${this.canvas.width}px`;
        this.container.style.height = `${this.canvas.height}px`;
        this.container.style.display = 'block';

        // Reset positions
        this.areas = [];
        this.selectedAreaId = null;
        this.history = [[]];
        this.historyIndex = 0;
        this.polyPoints = [];
        this.guidelinePoint = null;

        // Auto zoom-to-width-fit
        this.zoomWidthFit();
        this.redrawCanvas();
        this.renderShapes();
        
        if (this.onAreasChangedCallback) this.onAreasChangedCallback(this.areas);
        if (this.onSelectionChangedCallback) this.onSelectionChangedCallback(null);
        if (this.onStatusChangedCallback) this.onStatusChangedCallback('이미지 로드 완료');

        resolve(this.imageInfo);
      };
      this.image.onerror = (err) => {
        reject(err);
      };
    });
  }

  redrawCanvas() {
    if (!this.imageLoaded) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this.image, 0, 0);
  }

  // --- Zoom & Pan Management ---
  setZoom(newScale) {
    if (!this.imageLoaded) return;
    
    // Clamp scale
    const oldScale = this.scale;
    this.scale = Math.max(this.minScale, Math.min(this.maxScale, newScale));
    
    // Center-aware zoom adjustments
    const rect = this.viewport.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    this.offsetX = centerX - (centerX - this.offsetX) * (this.scale / oldScale);
    this.offsetY = centerY - (centerY - this.offsetY) * (this.scale / oldScale);

    this.applyTransform();
    this.renderShapes(); // Redraw handles for adjusted scale
  }

  zoomIn() { this.setZoom(this.scale + 0.1); }
  zoomOut() { this.setZoom(this.scale - 0.1); }
  zoom100() {
    this.scale = 1.0;
    this.zoomCenter();
  }

  zoomFit() {
    if (!this.imageLoaded) return;
    const viewW = this.viewport.clientWidth - 40;
    const viewH = this.viewport.clientHeight - 40;
    const imgW = this.canvas.width;
    const imgH = this.canvas.height;

    const scaleX = viewW / imgW;
    const scaleY = viewH / imgH;
    this.scale = Math.min(scaleX, scaleY, 1.0); // Don't upscale past 100% automatically

    this.zoomCenter();
  }

  zoomWidthFit() {
    if (!this.imageLoaded) return;
    const viewW = this.viewport.clientWidth;
    const imgW = this.canvas.width;

    this.scale = viewW / imgW;
    this.scale = Math.max(this.minScale, Math.min(this.maxScale, this.scale));

    this.offsetX = 0;
    const viewH = this.viewport.clientHeight;
    const imgH = this.canvas.height;
    
    if (imgH * this.scale < viewH) {
      this.offsetY = (viewH - imgH * this.scale) / 2;
    } else {
      this.offsetY = 0;
    }

    this.applyTransform();
    this.renderShapes();
  }

  zoomCenter() {
    const viewW = this.viewport.clientWidth;
    const viewH = this.viewport.clientHeight;
    this.offsetX = (viewW - this.canvas.width * this.scale) / 2;
    this.offsetY = (viewH - this.canvas.height * this.scale) / 2;
    this.applyTransform();
    this.renderShapes();
  }

  applyTransform() {
    this.container.style.transform = `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.scale})`;
    
    // Dispatch zoom status update
    const zoomLevelEl = document.getElementById('zoom-level');
    if (zoomLevelEl) {
      zoomLevelEl.textContent = `${Math.round(this.scale * 100)}%`;
    }
  }

  // --- Grid and Snap ---
  toggleGrid(forceState = null) {
    this.gridEnabled = forceState !== null ? forceState : !this.gridEnabled;
    const gridOverlay = document.getElementById('grid-overlay');
    if (gridOverlay) {
      gridOverlay.style.display = this.gridEnabled ? 'block' : 'none';
    }
    const btn = document.getElementById('btn-toggle-grid');
    if (btn) btn.classList.toggle('active', this.gridEnabled);
  }

  toggleSnap(forceState = null) {
    this.snapEnabled = forceState !== null ? forceState : !this.snapEnabled;
    const btn = document.getElementById('btn-toggle-snap');
    if (btn) btn.classList.toggle('active', this.snapEnabled);
  }

  getMouseCoords(e) {
    const rect = this.container.getBoundingClientRect();
    let x = (e.clientX - rect.left) / this.scale;
    let y = (e.clientY - rect.top) / this.scale;

    // Constrain to image boundaries
    x = Math.max(0, Math.min(this.canvas.width, x));
    y = Math.max(0, Math.min(this.canvas.height, y));

    if (this.snapEnabled) {
      x = Math.round(x / this.gridSize) * this.gridSize;
      y = Math.round(y / this.gridSize) * this.gridSize;
      
      // Re-constrain after snapping
      x = Math.max(0, Math.min(this.canvas.width, x));
      y = Math.max(0, Math.min(this.canvas.height, y));
    }

    return { x: Math.round(x), y: Math.round(y) };
  }

  // --- Tool Control ---
  setTool(tool) {
    this.currentTool = tool;
    
    // Reset temporary poly drawing if we switch tool
    if (tool !== 'poly' && this.polyPoints.length > 0) {
      this.polyPoints = [];
      this.guidelinePoint = null;
      this.renderShapes();
    }

    // Toggle viewport class states
    this.viewport.className = 'canvas-viewport';
    if (tool === 'rect') this.viewport.classList.add('draw-rect-mode');
    else if (tool === 'circle') this.viewport.classList.add('draw-circle-mode');
    else if (tool === 'poly') this.viewport.classList.add('draw-poly-mode');
    else if (tool === 'hand') this.viewport.classList.add('hand-tool-mode');

    // Highlight toolbar active tools
    const tools = ['select', 'rect', 'circle', 'poly', 'hand'];
    tools.forEach(t => {
      const btn = document.getElementById(`tool-${t}`);
      if (btn) btn.classList.toggle('active', t === tool);
    });

    if (this.onStatusChangedCallback) {
      const toolNames = { select: '선택 및 편집', rect: '사각형 그리기', circle: '원 그리기', poly: '다각형 그리기', hand: '화면 이동' };
      this.onStatusChangedCallback(`선택된 툴: ${toolNames[tool]}`);
    }
  }

  // --- History Manager (Undo / Redo) ---
  saveHistory() {
    // Truncate future index if we made a change after undo
    this.history = this.history.slice(0, this.historyIndex + 1);
    
    // Clone areas list
    const areasClone = this.areas.map(a => ({
      ...a,
      coords: [...a.coords]
    }));

    this.history.push(areasClone);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }

    this.updateUndoRedoButtons();
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.restoreHistoryState();
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.restoreHistoryState();
    }
  }

  restoreHistoryState() {
    const state = this.history[this.historyIndex];
    this.areas = state.map(a => ({
      ...a,
      coords: [...a.coords]
    }));
    
    // Keep selection if it still exists in the restored state
    if (this.selectedAreaId && !this.areas.some(a => a.id === this.selectedAreaId)) {
      this.selectedAreaId = null;
      if (this.onSelectionChangedCallback) this.onSelectionChangedCallback(null);
    } else if (this.selectedAreaId) {
      const selected = this.areas.find(a => a.id === this.selectedAreaId);
      if (this.onSelectionChangedCallback) this.onSelectionChangedCallback(selected);
    }
    
    this.renderShapes();
    this.updateUndoRedoButtons();

    if (this.onAreasChangedCallback) this.onAreasChangedCallback(this.areas);
  }

  updateUndoRedoButtons() {
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    if (btnUndo) btnUndo.disabled = this.historyIndex <= 0;
    if (btnRedo) btnRedo.disabled = this.historyIndex >= this.history.length - 1;
  }

  // --- Shape Management & Selection ---
  createArea(type, coords) {
    const count = this.areas.filter(a => a.type === type).length + 1;
    const typeLabel = { rect: '사각형', circle: '원형', poly: '다각형' };
    const id = `area-${Date.now()}`;
    
    const newArea = {
      id,
      name: `${typeLabel[type]} ${count}`,
      type,
      coords,
      href: '',
      target: '_blank',
      alt: '',
      visible: true
    };

    this.areas.push(newArea);
    this.selectedAreaId = id;
    
    this.saveHistory();
    this.renderShapes();
    
    if (this.onAreasChangedCallback) this.onAreasChangedCallback(this.areas);
    if (this.onSelectionChangedCallback) this.onSelectionChangedCallback(newArea);
  }

  selectArea(id) {
    this.selectedAreaId = id;
    
    // Update selected class in place for SVG groups and their inner shapes
    const groups = this.svg.querySelectorAll('.area-group');
    groups.forEach(group => {
      const gid = group.getAttribute('data-id');
      const isSelected = gid === id;
      
      group.classList.toggle('selected', isSelected);
      
      const shape = group.firstElementChild;
      if (shape) {
        shape.classList.toggle('selected', isSelected);
      }
    });

    const selected = this.areas.find(a => a.id === id);
    if (this.onSelectionChangedCallback) this.onSelectionChangedCallback(selected);
  }

  deleteSelected() {
    if (!this.selectedAreaId) return;
    this.areas = this.areas.filter(a => a.id !== this.selectedAreaId);
    this.selectedAreaId = null;

    this.saveHistory();
    this.renderShapes();
    
    if (this.onAreasChangedCallback) this.onAreasChangedCallback(this.areas);
    if (this.onSelectionChangedCallback) this.onSelectionChangedCallback(null);
    if (this.onStatusChangedCallback) this.onStatusChangedCallback('선택한 영역이 삭제되었습니다.');
  }

  copySelected() {
    if (!this.selectedAreaId) return;
    const area = this.areas.find(a => a.id === this.selectedAreaId);
    if (!area) return;

    this.copiedArea = {
      type: area.type,
      coords: [...area.coords],
      href: area.href || '',
      target: area.target || '_blank',
      alt: area.alt || ''
    };

    if (this.onStatusChangedCallback) {
      this.onStatusChangedCallback('선택된 영역이 복사되었습니다. (Ctrl+V로 붙여넣기)');
    }
  }

  pasteSelected() {
    if (!this.copiedArea) return;

    const coords = [...this.copiedArea.coords];
    if (this.copiedArea.type === 'rect') {
      coords[0] += 10;
      coords[2] += 10;
    } else if (this.copiedArea.type === 'circle') {
      coords[0] += 10;
    } else if (this.copiedArea.type === 'poly') {
      for (let i = 0; i < coords.length; i += 2) {
        coords[i] += 10;
      }
    }

    this.copiedArea.coords = [...coords];

    const count = this.areas.filter(a => a.type === this.copiedArea.type).length + 1;
    const typeLabel = { rect: '사각형', circle: '원형', poly: '다각형' };
    const id = `area-${Date.now()}`;

    const newArea = {
      id,
      name: `${typeLabel[this.copiedArea.type]} ${count} (복사)`,
      type: this.copiedArea.type,
      coords,
      href: this.copiedArea.href,
      target: this.copiedArea.target,
      alt: this.copiedArea.alt,
      visible: true
    };

    this.constrainAreaBounds(newArea);

    this.areas.push(newArea);
    this.selectedAreaId = id;

    this.saveHistory();
    this.renderShapes();

    if (this.onAreasChangedCallback) this.onAreasChangedCallback(this.areas);
    if (this.onSelectionChangedCallback) this.onSelectionChangedCallback(newArea);
    if (this.onStatusChangedCallback) {
      this.onStatusChangedCallback('새 영역이 붙여넣기 되었습니다.');
    }
  }

  updateAreaProperties(properties) {
    if (!this.selectedAreaId) return;
    const area = this.areas.find(a => a.id === this.selectedAreaId);
    if (!area) return;

    let changed = false;
    Object.keys(properties).forEach(key => {
      if (area[key] !== properties[key]) {
        area[key] = properties[key];
        changed = true;
      }
    });

    if (changed) {
      this.saveHistory();
      this.renderShapes();
      if (this.onAreasChangedCallback) this.onAreasChangedCallback(this.areas);
    }
  }

  toggleAreaVisibility(id) {
    const area = this.areas.find(a => a.id === id);
    if (area) {
      area.visible = area.visible !== false ? false : true;
      this.saveHistory();
      this.renderShapes();
      if (this.onAreasChangedCallback) this.onAreasChangedCallback(this.areas);
    }
  }

  renameArea(id, newName) {
    const area = this.areas.find(a => a.id === id);
    if (area && newName && area.name !== newName) {
      area.name = newName;
      this.saveHistory();
      if (this.onAreasChangedCallback) this.onAreasChangedCallback(this.areas);
      
      // Update property panel if this was the selected area
      if (id === this.selectedAreaId && this.onSelectionChangedCallback) {
        this.onSelectionChangedCallback(area);
      }
    }
  }

  // --- Keyboard Nudge Commands ---
  nudgeSelected(dx, dy) {
    if (!this.selectedAreaId) return;
    const area = this.areas.find(a => a.id === this.selectedAreaId);
    if (!area) return;

    // Apply nudge offsets
    if (area.type === 'rect') {
      area.coords[0] += dx;
      area.coords[1] += dy;
      area.coords[2] += dx;
      area.coords[3] += dy;
    } else if (area.type === 'circle') {
      area.coords[0] += dx;
      area.coords[1] += dy;
    } else if (area.type === 'poly') {
      for (let i = 0; i < area.coords.length; i += 2) {
        area.coords[i] += dx;
        area.coords[i + 1] += dy;
      }
    }

    // Constraints to canvas dimensions
    this.constrainAreaBounds(area);

    this.saveHistory();
    this.renderShapes();
    if (this.onAreasChangedCallback) this.onAreasChangedCallback(this.areas);
  }

  constrainAreaBounds(area) {
    const maxW = this.canvas.width;
    const maxH = this.canvas.height;

    if (area.type === 'rect') {
      const w = area.coords[2] - area.coords[0];
      const h = area.coords[3] - area.coords[1];

      // Shift x bounds
      if (area.coords[0] < 0) {
        area.coords[0] = 0;
        area.coords[2] = w;
      } else if (area.coords[2] > maxW) {
        area.coords[2] = maxW;
        area.coords[0] = maxW - w;
      }
      
      // Shift y bounds
      if (area.coords[1] < 0) {
        area.coords[1] = 0;
        area.coords[3] = h;
      } else if (area.coords[3] > maxH) {
        area.coords[3] = maxH;
        area.coords[1] = maxH - h;
      }
    } else if (area.type === 'circle') {
      const r = area.coords[2];
      area.coords[0] = Math.max(r, Math.min(maxW - r, area.coords[0]));
      area.coords[1] = Math.max(r, Math.min(maxH - r, area.coords[1]));
    } else if (area.type === 'poly') {
      // Find poly width and heights bounding box to shift or clamp
      for (let i = 0; i < area.coords.length; i += 2) {
        area.coords[i] = Math.max(0, Math.min(maxW, area.coords[i]));
        area.coords[i + 1] = Math.max(0, Math.min(maxH, area.coords[i + 1]));
      }
    }
  }

  // --- SVG Shape Rendering Engine ---
  renderShapes() {
    this.svg.innerHTML = '';
    
    // Draw Completed Shapes
    this.areas.forEach(area => {
      const isSelected = area.id === this.selectedAreaId;
      const isHovered = area.id === this.hoveredAreaId;
      const isVisible = area.visible !== false;
      
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('class', `area-group${isSelected ? ' selected' : ''}${isHovered ? ' hovered' : ''}`);
      group.setAttribute('data-id', area.id);

      let element;
      if (area.type === 'rect') {
        element = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        element.setAttribute('x', Math.min(area.coords[0], area.coords[2]));
        element.setAttribute('y', Math.min(area.coords[1], area.coords[3]));
        element.setAttribute('width', Math.abs(area.coords[2] - area.coords[0]));
        element.setAttribute('height', Math.abs(area.coords[3] - area.coords[1]));
        element.setAttribute('class', `shape-rect${isSelected ? ' selected' : ''}${!isVisible ? ' hidden' : ''}`);
      } 
      else if (area.type === 'circle') {
        element = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        element.setAttribute('cx', area.coords[0]);
        element.setAttribute('cy', area.coords[1]);
        element.setAttribute('r', area.coords[2]);
        element.setAttribute('class', `shape-circle${isSelected ? ' selected' : ''}${!isVisible ? ' hidden' : ''}`);
      } 
      else if (area.type === 'poly') {
        element = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const pointsStr = [];
        for (let i = 0; i < area.coords.length; i += 2) {
          pointsStr.push(`${area.coords[i]},${area.coords[i + 1]}`);
        }
        element.setAttribute('points', pointsStr.join(' '));
        element.setAttribute('class', `shape-polygon${isSelected ? ' selected' : ''}${!isVisible ? ' hidden' : ''}`);
      }

      if (element) {
        group.appendChild(element);
        
        // Add click to select handler on shape group
        group.addEventListener('mousedown', (e) => {
          if (this.currentTool === 'select') {
            e.stopPropagation(); // Avoid triggering viewport click
            this.selectArea(area.id);
            this.startDragging(area, e);
          }
        });

        // Hover listeners for rendering handles
        group.addEventListener('mouseenter', () => {
          if (this.currentTool === 'select' && !this.isDragging && !this.isResizing) {
            group.classList.add('hovered');
            this.hoveredAreaId = area.id;
          }
        });

        group.addEventListener('mouseleave', () => {
          if (this.currentTool === 'select' && !this.isDragging && !this.isResizing) {
            group.classList.remove('hovered');
            if (this.hoveredAreaId === area.id) {
              this.hoveredAreaId = null;
            }
          }
        });
      }

      // We ALWAYS render the handles for all shapes in the DOM, visibility is controlled by CSS display block/none
      if (isVisible) {
        this.renderResizeHandles(area, group);
      }

      this.svg.appendChild(group);
    });

    // Draw active drawing shape preview
    if (this.activeDrawMode) {
      this.renderDrawingPreview();
    }
  }

  appendAreaToSVG(area) {
    const isVisible = area.visible !== false;
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'area-group');
    group.setAttribute('data-id', area.id);

    let element;
    if (area.type === 'rect') {
      element = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      element.setAttribute('x', Math.min(area.coords[0], area.coords[2]));
      element.setAttribute('y', Math.min(area.coords[1], area.coords[3]));
      element.setAttribute('width', Math.abs(area.coords[2] - area.coords[0]));
      element.setAttribute('height', Math.abs(area.coords[3] - area.coords[1]));
      element.setAttribute('class', `shape-rect${!isVisible ? ' hidden' : ''}`);
    } 
    else if (area.type === 'circle') {
      element = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      element.setAttribute('cx', area.coords[0]);
      element.setAttribute('cy', area.coords[1]);
      element.setAttribute('r', area.coords[2]);
      element.setAttribute('class', `shape-circle${!isVisible ? ' hidden' : ''}`);
    } 
    else if (area.type === 'poly') {
      element = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      const pointsStr = [];
      for (let i = 0; i < area.coords.length; i += 2) {
        pointsStr.push(`${area.coords[i]},${area.coords[i + 1]}`);
      }
      element.setAttribute('points', pointsStr.join(' '));
      element.setAttribute('class', `shape-polygon${!isVisible ? ' hidden' : ''}`);
    }

    if (element) {
      group.appendChild(element);
      
      // We ALWAYS render the handles for all shapes in the DOM, visibility is controlled by CSS display block/none
      if (isVisible) {
        this.renderResizeHandles(area, group);
      }

      this.svg.appendChild(group);

      group.addEventListener('mousedown', (e) => {
        if (this.currentTool === 'select') {
          e.stopPropagation();
          this.selectArea(area.id);
          this.startDragging(area, e);
        }
      });

      group.addEventListener('mouseenter', () => {
        if (this.currentTool === 'select' && !this.isDragging && !this.isResizing) {
          group.classList.add('hovered');
          this.hoveredAreaId = area.id;
        }
      });

      group.addEventListener('mouseleave', () => {
        if (this.currentTool === 'select' && !this.isDragging && !this.isResizing) {
          group.classList.remove('hovered');
          if (this.hoveredAreaId === area.id) {
            this.hoveredAreaId = null;
          }
        }
      });
    }
  }

  renderResizeHandles(area, container) {
    const handleRadius = 6 / this.scale;
    const strokeWidth = 1.5 / this.scale;

    const createHandle = (x, y, cursor, index) => {
      const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      handle.setAttribute('cx', x);
      handle.setAttribute('cy', y);
      handle.setAttribute('r', handleRadius);
      handle.setAttribute('class', 'resize-handle');
      handle.style.strokeWidth = strokeWidth;
      handle.style.cursor = cursor;
      
      handle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        this.startResizing(area, index, e);
      });
      
      container.appendChild(handle);
    };

    if (area.type === 'rect') {
      const x1 = area.coords[0];
      const y1 = area.coords[1];
      const x2 = area.coords[2];
      const y2 = area.coords[3];
      
      // Render 4 corner handles
      createHandle(x1, y1, 'nwse-resize', 0); // TL
      createHandle(x2, y1, 'nesw-resize', 1); // TR
      createHandle(x2, y2, 'nwse-resize', 2); // BR
      createHandle(x1, y2, 'nesw-resize', 3); // BL
    } 
    else if (area.type === 'circle') {
      const cx = area.coords[0];
      const cy = area.coords[1];
      const r = area.coords[2];
      
      // Center handle (to move)
      createHandle(cx, cy, 'move', 0);
      // Perimeter handle (to resize radius)
      createHandle(cx + r, cy, 'ew-resize', 1);
    } 
    else if (area.type === 'poly') {
      // Create handle on each vertex point
      for (let i = 0; i < area.coords.length; i += 2) {
        createHandle(area.coords[i], area.coords[i + 1], 'move', i);
      }
    }
  }

  renderDrawingPreview() {
    if (this.currentTool === 'rect' && this.guidelinePoint) {
      const preview = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      preview.setAttribute('x', Math.min(this.drawStart.x, this.guidelinePoint.x));
      preview.setAttribute('y', Math.min(this.drawStart.y, this.guidelinePoint.y));
      preview.setAttribute('width', Math.abs(this.guidelinePoint.x - this.drawStart.x));
      preview.setAttribute('height', Math.abs(this.guidelinePoint.y - this.drawStart.y));
      preview.setAttribute('class', 'shape-guide');
      this.svg.appendChild(preview);
    } 
    else if (this.currentTool === 'circle' && this.guidelinePoint) {
      const dx = this.guidelinePoint.x - this.drawStart.x;
      const dy = this.guidelinePoint.y - this.drawStart.y;
      const r = Math.round(Math.hypot(dx, dy));

      const preview = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      preview.setAttribute('cx', this.drawStart.x);
      preview.setAttribute('cy', this.drawStart.y);
      preview.setAttribute('r', r);
      preview.setAttribute('class', 'shape-guide');
      this.svg.appendChild(preview);
    } 
    else if (this.currentTool === 'poly' && this.polyPoints.length > 0) {
      // Render completed segments
      const polyLine = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      const pts = [...this.polyPoints];
      if (this.guidelinePoint) {
        pts.push(this.guidelinePoint.x, this.guidelinePoint.y);
      }
      
      const ptsStr = [];
      for (let i = 0; i < pts.length; i += 2) {
        ptsStr.push(`${pts[i]},${pts[i + 1]}`);
      }
      polyLine.setAttribute('points', ptsStr.join(' '));
      polyLine.setAttribute('class', 'shape-guide');
      this.svg.appendChild(polyLine);
      
      // Render circles on existing vertices
      const handleRadius = 4 / this.scale;
      for (let i = 0; i < this.polyPoints.length; i += 2) {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', this.polyPoints[i]);
        circle.setAttribute('cy', this.polyPoints[i + 1]);
        circle.setAttribute('r', handleRadius);
        circle.style.fill = 'rgb(99, 102, 241)';
        circle.style.stroke = '#fff';
        this.svg.appendChild(circle);
      }
    }
  }

  updateSVGElement(area) {
    const group = this.svg.querySelector(`g[data-id="${area.id}"]`);
    if (!group) return;

    const element = group.firstElementChild;
    if (!element) return;

    if (area.type === 'rect') {
      const x = Math.min(area.coords[0], area.coords[2]);
      const y = Math.min(area.coords[1], area.coords[3]);
      const w = Math.abs(area.coords[2] - area.coords[0]);
      const h = Math.abs(area.coords[3] - area.coords[1]);
      
      element.setAttribute('x', x);
      element.setAttribute('y', y);
      element.setAttribute('width', w);
      element.setAttribute('height', h);

      // Update handles
      const handles = group.querySelectorAll('.resize-handle');
      if (handles.length === 4) {
        handles[0].setAttribute('cx', area.coords[0]);
        handles[0].setAttribute('cy', area.coords[1]);

        handles[1].setAttribute('cx', area.coords[2]);
        handles[1].setAttribute('cy', area.coords[1]);

        handles[2].setAttribute('cx', area.coords[2]);
        handles[2].setAttribute('cy', area.coords[3]);

        handles[3].setAttribute('cx', area.coords[0]);
        handles[3].setAttribute('cy', area.coords[3]);
      }
    }
    else if (area.type === 'circle') {
      element.setAttribute('cx', area.coords[0]);
      element.setAttribute('cy', area.coords[1]);
      element.setAttribute('r', area.coords[2]);

      const handles = group.querySelectorAll('.resize-handle');
      if (handles.length === 2) {
        handles[0].setAttribute('cx', area.coords[0]);
        handles[0].setAttribute('cy', area.coords[1]);

        handles[1].setAttribute('cx', area.coords[0] + area.coords[2]);
        handles[1].setAttribute('cy', area.coords[1]);
      }
    }
    else if (area.type === 'poly') {
      const pointsStr = [];
      for (let i = 0; i < area.coords.length; i += 2) {
        pointsStr.push(`${area.coords[i]},${area.coords[i + 1]}`);
      }
      element.setAttribute('points', pointsStr.join(' '));

      const handles = group.querySelectorAll('.resize-handle');
      for (let i = 0; i < handles.length; i++) {
        if (handles[i]) {
          handles[i].setAttribute('cx', area.coords[i * 2]);
          handles[i].setAttribute('cy', area.coords[i * 2 + 1]);
        }
      }
    }
  }

  // --- Interaction Logics: Dragging / Resizing ---
  startDragging(area, e) {
    this.isDragging = true;
    const mouse = this.getMouseCoords(e);
    this.dragStartCoords = mouse;

    const isCtrl = e.ctrlKey || e.metaKey;
    if (isCtrl) {
      // Duplicate shape (Ctrl + Drag Copy)
      // We leave a static copy at the original position, and drag the original shape.
      const count = this.areas.filter(a => a.type === area.type).length + 1;
      const typeLabel = { rect: '사각형', circle: '원형', poly: '다각형' };
      const cloneId = `area-${Date.now()}`;
      
      const clone = {
        id: cloneId,
        name: `${typeLabel[area.type]} ${count} (복사)`,
        type: area.type,
        coords: [...area.coords],
        href: area.href || '',
        target: area.target || '_blank',
        alt: area.alt || '',
        visible: true
      };

      this.areas.push(clone);
      this.appendAreaToSVG(clone);

      this.draggedShapeOriginal = {
        ...area,
        coords: [...area.coords]
      };

      if (this.onAreasChangedCallback) this.onAreasChangedCallback(this.areas);
    } else {
      this.draggedShapeOriginal = {
        ...area,
        coords: [...area.coords]
      };
    }
  }

  startResizing(area, handleIndex, e) {
    this.isResizing = true;
    this.resizeHandleIndex = handleIndex;
    this.selectArea(area.id);
    const mouse = this.getMouseCoords(e);
    this.dragStartCoords = mouse;
    this.draggedShapeOriginal = {
      ...area,
      coords: [...area.coords]
    };
  }

  // --- Event Initializations ---
  initEvents() {
    // Canvas Viewport Pan controls (Spacebar panning)
    let isSpaceDown = false;
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
        isSpaceDown = true;
        this.viewport.style.cursor = 'grab';
      }
    });
    
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        isSpaceDown = false;
        if (this.currentTool === 'hand') {
          this.viewport.style.cursor = 'grab';
        } else {
          this.setTool(this.currentTool); // Restore cursor
        }
      }
    });

    // Mousedown handling
    this.viewport.addEventListener('mousedown', (e) => {
      if (!this.imageLoaded) return;

      const mouseCoords = this.getMouseCoords(e);
      const isMiddleClick = e.button === 1;

      // Handle Pan Trigger (Hand tool, Space+Click, Middle Click)
      if (this.currentTool === 'hand' || isSpaceDown || isMiddleClick) {
        this.isPanning = true;
        this.panStart = { x: e.clientX - this.offsetX, y: e.clientY - this.offsetY };
        this.viewport.style.cursor = 'grabbing';
        e.preventDefault();
        return;
      }

      // Handle Selection tool canvas click (Deselect)
      if (this.currentTool === 'select') {
        // Did we click on whitespace? Deselect
        if (e.target.id === 'svg-overlay' || e.target.id === 'image-canvas') {
          this.selectArea(null);
        }
        return;
      }

      // Drawing triggers
      if (['rect', 'circle'].includes(this.currentTool)) {
        this.activeDrawMode = true;
        this.drawStart = mouseCoords;
        this.guidelinePoint = mouseCoords;
        this.renderShapes();
      } 
      else if (this.currentTool === 'poly') {
        this.activeDrawMode = true;
        
        // Check if double click would happen, handled in dblclick
        const isFirstPointClose = this.polyPoints.length >= 6 && 
          Math.hypot(mouseCoords.x - this.polyPoints[0], mouseCoords.y - this.polyPoints[1]) < (12 / this.scale);
        
        if (isFirstPointClose) {
          this.completePolyDrawing();
        } else {
          this.polyPoints.push(mouseCoords.x, mouseCoords.y);
          this.guidelinePoint = mouseCoords;
          this.renderShapes();
        }
      }
    });

    // Mousemove handling
    window.addEventListener('mousemove', (e) => {
      if (!this.imageLoaded) return;

      // Coordinate tracking in statusbar
      const mouse = this.getMouseCoords(e);
      const statusCoords = document.getElementById('status-coords');
      if (statusCoords) {
        statusCoords.textContent = `X: ${mouse.x}, Y: ${mouse.y}`;
      }

      // Handle panning movement
      if (this.isPanning) {
        this.offsetX = e.clientX - this.panStart.x;
        this.offsetY = e.clientY - this.panStart.y;
        this.applyTransform();
        return;
      }

      // Handle drawing movement preview
      if (this.activeDrawMode) {
        this.guidelinePoint = mouse;
        this.renderShapes();
        return;
      }

      // Handle moving drag action
      if (this.isDragging && this.selectedAreaId) {
        const area = this.areas.find(a => a.id === this.selectedAreaId);
        if (!area) return;
        
        const dx = mouse.x - this.dragStartCoords.x;
        const dy = mouse.y - this.dragStartCoords.y;
        
        const orig = this.draggedShapeOriginal;
        
        if (orig.type === 'rect') {
          area.coords[0] = orig.coords[0] + dx;
          area.coords[1] = orig.coords[1] + dy;
          area.coords[2] = orig.coords[2] + dx;
          area.coords[3] = orig.coords[3] + dy;
        } 
        else if (orig.type === 'circle') {
          area.coords[0] = orig.coords[0] + dx;
          area.coords[1] = orig.coords[1] + dy;
        } 
        else if (orig.type === 'poly') {
          for (let i = 0; i < orig.coords.length; i += 2) {
            area.coords[i] = orig.coords[i] + dx;
            area.coords[i + 1] = orig.coords[i + 1] + dy;
          }
        }
        
        this.constrainAreaBounds(area);
        this.updateSVGElement(area);
        if (this.onAreasChangedCallback) this.onAreasChangedCallback(this.areas);
        return;
      }

      // Handle resizing drag action
      if (this.isResizing && this.selectedAreaId) {
        const area = this.areas.find(a => a.id === this.selectedAreaId);
        if (!area) return;

        const dx = mouse.x - this.dragStartCoords.x;
        const dy = mouse.y - this.dragStartCoords.y;
        const orig = this.draggedShapeOriginal;
        
        if (orig.type === 'rect') {
          // TL = 0, TR = 1, BR = 2, BL = 3
          if (this.resizeHandleIndex === 0) {
            area.coords[0] = orig.coords[0] + dx;
            area.coords[1] = orig.coords[1] + dy;
          } else if (this.resizeHandleIndex === 1) {
            area.coords[2] = orig.coords[2] + dx;
            area.coords[1] = orig.coords[1] + dy;
          } else if (this.resizeHandleIndex === 2) {
            area.coords[2] = orig.coords[2] + dx;
            area.coords[3] = orig.coords[3] + dy;
          } else if (this.resizeHandleIndex === 3) {
            area.coords[0] = orig.coords[0] + dx;
            area.coords[3] = orig.coords[3] + dy;
          }
        } 
        else if (orig.type === 'circle') {
          // Center handle = 0, Perimeter handle = 1
          if (this.resizeHandleIndex === 0) {
            area.coords[0] = orig.coords[0] + dx;
            area.coords[1] = orig.coords[1] + dy;
          } else if (this.resizeHandleIndex === 1) {
            // Radial resize
            const cx = orig.coords[0];
            const cy = orig.coords[1];
            const px = orig.coords[0] + orig.coords[2] + dx;
            const py = cy; // Constrain to horizontal stretch
            area.coords[2] = Math.max(5, Math.abs(px - cx));
          }
        } 
        else if (orig.type === 'poly') {
          const idx = this.resizeHandleIndex;
          area.coords[idx] = orig.coords[idx] + dx;
          area.coords[idx + 1] = orig.coords[idx + 1] + dy;
        }

        this.constrainAreaBounds(area);
        this.updateSVGElement(area);
        if (this.onAreasChangedCallback) this.onAreasChangedCallback(this.areas);
        return;
      }
    });

    // Mouseup handling
    window.addEventListener('mouseup', () => {
      if (this.isPanning) {
        this.isPanning = false;
        if (this.currentTool === 'hand') {
          this.viewport.style.cursor = 'grab';
        } else {
          this.viewport.style.cursor = 'default';
        }
        return;
      }

      if (this.isDragging || this.isResizing) {
        this.isDragging = false;
        this.isResizing = false;
        this.resizeHandleIndex = null;
        this.draggedShapeOriginal = null;
        
        this.saveHistory();
        this.renderShapes();
        if (this.onAreasChangedCallback) this.onAreasChangedCallback(this.areas);
        return;
      }

      if (this.activeDrawMode) {
        if (this.currentTool === 'rect' && this.guidelinePoint) {
          const x1 = this.drawStart.x;
          const y1 = this.drawStart.y;
          const x2 = this.guidelinePoint.x;
          const y2 = this.guidelinePoint.y;

          // Only create if we actually dragged some distance (prevent micro-clicks)
          if (Math.abs(x2 - x1) > 4 && Math.abs(y2 - y1) > 4) {
            this.createArea('rect', [x1, y1, x2, y2]);
          }
          
          this.activeDrawMode = false;
          this.guidelinePoint = null;
          this.setTool('select');
        } 
        else if (this.currentTool === 'circle' && this.guidelinePoint) {
          const cx = this.drawStart.x;
          const cy = this.drawStart.y;
          const r = Math.round(Math.hypot(this.guidelinePoint.x - cx, this.guidelinePoint.y - cy));

          if (r > 4) {
            this.createArea('circle', [cx, cy, r]);
          }

          this.activeDrawMode = false;
          this.guidelinePoint = null;
          this.setTool('select');
        }
      }
    });

    // Poly tool double-click complete drawing handler
    this.viewport.addEventListener('dblclick', (e) => {
      if (this.currentTool === 'poly' && this.activeDrawMode) {
        e.stopPropagation();
        this.completePolyDrawing();
      }
    });

    // Mousewheel zooming (Ctrl + Wheel) or Panning (Wheel)
    this.viewport.addEventListener('wheel', (e) => {
      if (!this.imageLoaded) return;
      e.preventDefault();
      
      const isCtrl = e.ctrlKey || e.metaKey;
      if (isCtrl) {
        // Zoom with Ctrl + Wheel
        const zoomFactor = 0.05;
        const zoomDirection = e.deltaY < 0 ? 1 : -1;
        
        // Perform centered zoom
        const rect = this.container.getBoundingClientRect();
        const oldScale = this.scale;
        const targetScale = this.scale + zoomDirection * zoomFactor;
        this.scale = Math.max(this.minScale, Math.min(this.maxScale, targetScale));

        // Adjust offset to keep mouse position anchored
        this.offsetX = e.clientX - (e.clientX - this.offsetX) * (this.scale / oldScale);
        this.offsetY = e.clientY - (e.clientY - this.offsetY) * (this.scale / oldScale);

        this.applyTransform();
        this.renderShapes();
      } else {
        // Pan with default Wheel
        const scrollSpeed = 0.8;
        this.offsetX -= e.deltaX * scrollSpeed;
        this.offsetY -= e.deltaY * scrollSpeed;

        this.applyTransform();
        this.renderShapes();
      }
    });

    // Keyboard global listener for Delete, Nudge, Undo, Redo
    window.addEventListener('keydown', (e) => {
      // Don't intercept shortcuts when user typing in form fields!
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT') {
        return;
      }

      const isCtrl = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;
      const step = isShift ? 10 : 1;

      // Delete key deletes selected area
      if (e.key === 'Delete') {
        this.deleteSelected();
      }
      
      // Arrow keys nudge selected
      else if (e.key === 'ArrowUp') {
        e.preventDefault(); this.nudgeSelected(0, -step);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault(); this.nudgeSelected(0, step);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault(); this.nudgeSelected(-step, 0);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault(); this.nudgeSelected(step, 0);
      }

      // Copy / Paste
      else if (isCtrl && e.code === 'KeyC') {
        e.preventDefault();
        this.copySelected();
      } else if (isCtrl && e.code === 'KeyV') {
        e.preventDefault();
        this.pasteSelected();
      }

      // Undo / Redo
      else if (isCtrl && e.code === 'KeyZ') {
        e.preventDefault();
        this.undo();
      } else if (isCtrl && e.code === 'KeyY') {
        e.preventDefault();
        this.redo();
      }

      // Zoom commands
      else if (isCtrl && e.code === 'Equal') { // Ctrl + =
        e.preventDefault(); this.zoomIn();
      } else if (isCtrl && e.code === 'Minus') { // Ctrl + -
        e.preventDefault(); this.zoomOut();
      } else if (isCtrl && e.code === 'Digit0') { // Ctrl + 0
        e.preventDefault(); this.zoomFit();
      }

      // Shortcuts to switch tools
      else if (e.code === 'KeyV') {
        this.setTool('select');
      } else if (e.code === 'KeyR') {
        this.setTool('rect');
      } else if (e.code === 'KeyC') {
        this.setTool('circle');
      } else if (e.code === 'KeyP') {
        this.setTool('poly');
      } else if (e.code === 'KeyG') {
        this.toggleGrid();
      } else if (e.code === 'KeyS') {
        this.toggleSnap();
      }
    });
  }

  completePolyDrawing() {
    if (this.polyPoints.length >= 6) { // Minimum 3 vertices (6 coordinates)
      this.createArea('poly', [...this.polyPoints]);
    }
    
    this.activeDrawMode = false;
    this.polyPoints = [];
    this.guidelinePoint = null;
    this.setTool('select');
  }
}
