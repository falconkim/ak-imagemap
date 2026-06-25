import { CanvasManager } from './canvas.js';
import { loadImageFromUrl } from './network.js';
import { generateHTML, generateJSON, parseJSON, parseHTML } from './parser.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Canvas Manager
  const manager = new CanvasManager(
    'image-canvas',
    'svg-overlay',
    'canvas-container',
    'canvas-viewport'
  );

  // --- UI Elements ---
  const welcomeOverlay = document.getElementById('welcome-overlay');
  const canvasContainer = document.getElementById('canvas-container');
  const btnNew = document.getElementById('btn-new');
  const btnLoadDropdown = document.getElementById('btn-load-img-dropdown');
  const imgDropdownMenu = document.getElementById('img-dropdown-menu');
  const btnLoadLocal = document.getElementById('btn-load-local');
  const btnLoadUrl = document.getElementById('btn-load-url');
  
  const welcomeBtnLocal = document.getElementById('welcome-btn-local');
  const welcomeBtnUrl = document.getElementById('welcome-btn-url');

  // Tools
  const toolSelect = document.getElementById('tool-select');
  const toolRect = document.getElementById('tool-rect');
  const toolCircle = document.getElementById('tool-circle');
  const toolPoly = document.getElementById('tool-poly');
  const toolHand = document.getElementById('tool-hand');

  // View Controls
  const btnZoomIn = document.getElementById('btn-zoom-in');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  const btnZoomFit = document.getElementById('btn-zoom-fit');
  const btnZoomWidth = document.getElementById('btn-zoom-width');
  const btnToggleGrid = document.getElementById('btn-toggle-grid');
  const btnToggleSnap = document.getElementById('btn-toggle-snap');

  // History & Map ID
  const btnUndo = document.getElementById('btn-undo');
  const btnRedo = document.getElementById('btn-redo');
  const inputMapId = document.getElementById('input-map-id');

  // Action Buttons
  const btnLoadProject = document.getElementById('btn-load-project');
  const btnSaveProject = document.getElementById('btn-save-project');
  const btnExportHtml = document.getElementById('btn-export-html');

  // Navigator / Minimap
  const minimapImg = document.getElementById('minimap-img');
  const minimapViewport = document.getElementById('minimap-viewport');
  const minimapViewer = document.getElementById('minimap-viewer');

  // Navigator Zoom Buttons
  const btnNavZoomIn = document.getElementById('btn-nav-zoom-in');
  const btnNavZoomOut = document.getElementById('btn-nav-zoom-out');
  const btnNavZoom1to1 = document.getElementById('btn-nav-zoom-1to1');
  const btnNavZoomWidth = document.getElementById('btn-nav-zoom-width');

  // Right Panel Resizer
  const rightPanel = document.querySelector('.right-panel');
  const rightResizer = document.getElementById('right-panel-resizer');

  // Navigator Content and Scale variables
  const minimapContent = document.getElementById('minimap-content');
  let minimapScale = 1.0;
  let minimapDx = 0;
  let minimapDy = 0;

  // Web Mode Fallback Inputs
  const webFileInput = document.getElementById('web-file-input');
  const webProjectInput = document.getElementById('web-project-input');

  // Layer List
  const layerList = document.getElementById('layer-list');
  const btnDeleteArea = document.getElementById('btn-delete-area');

  // Properties Panel
  const propPanel = document.getElementById('properties-panel');
  const propType = document.getElementById('prop-type');
  const propName = document.getElementById('prop-name');
  const propHref = document.getElementById('prop-href');
  const propTarget = document.getElementById('prop-target');
  const propAlt = document.getElementById('prop-alt');

  // Code Panel
  const codeOutput = document.getElementById('code-output');
  const btnApplyCode = document.getElementById('btn-apply-code');
  const btnCopyCode = document.getElementById('btn-copy-code');
  const chkRwd = document.getElementById('chk-rwd');

  // Status Bar
  const statusMessage = document.getElementById('status-message');
  const statusDimensions = document.getElementById('status-dimensions');

  // Modal URL Load
  const modalUrl = document.getElementById('modal-url');
  const modalUrlClose = document.getElementById('modal-url-close');
  const modalUrlBtnCancel = document.getElementById('modal-url-btn-cancel');
  const modalUrlBtnLoad = document.getElementById('modal-url-btn-load');
  const inputImgUrl = document.getElementById('input-img-url');
  const urlErrorBox = document.getElementById('url-error-box');
  const urlErrorMsg = document.getElementById('url-error-msg');

  // Image load helper
  let currentImageInfo = null;
  let isDirty = false;
  let isLoading = false;

  // --- Dropdown Handler ---
  btnLoadDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
    imgDropdownMenu.classList.toggle('show');
  });

  window.addEventListener('click', () => {
    imgDropdownMenu.classList.remove('show');
  });

  // --- Modal URL Handlers ---
  function showUrlModal() {
    modalUrl.classList.add('show');
    inputImgUrl.value = '';
    urlErrorBox.style.display = 'none';
    inputImgUrl.focus();
  }

  function hideUrlModal() {
    modalUrl.classList.remove('show');
  }

  btnLoadUrl.addEventListener('click', showUrlModal);
  welcomeBtnUrl.addEventListener('click', showUrlModal);
  modalUrlClose.addEventListener('click', hideUrlModal);
  modalUrlBtnCancel.addEventListener('click', hideUrlModal);
  document.getElementById('modal-url-backdrop').addEventListener('click', hideUrlModal);

  modalUrlBtnLoad.addEventListener('click', loadFromWebUrl);
  inputImgUrl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadFromWebUrl();
  });

  async function loadFromWebUrl() {
    const url = inputImgUrl.value.trim();
    if (!url) return;

    urlErrorBox.style.display = 'none';
    statusMessage.textContent = '웹 이미지 불러오는 중...';

    const result = await loadImageFromUrl(url);
    if (result.success) {
      try {
        isLoading = true;
        currentImageInfo = await manager.loadImage(result.dataUrl, getUrlFilename(url), url);
        setupLoadedState();
        hideUrlModal();
        isLoading = false;
        isDirty = false;
      } catch (err) {
        isLoading = false;
        showUrlError(`이미지 처리 오류: ${err.message}`);
      }
    } else {
      showUrlError(result.error);
    }
  }

  function showUrlError(msg) {
    urlErrorMsg.textContent = msg;
    urlErrorBox.style.display = 'flex';
    statusMessage.textContent = '웹 이미지 불러오기 실패';
  }

  function getUrlFilename(url) {
    try {
      const pathname = new URL(url).pathname;
      const parts = pathname.split('/');
      const last = parts[parts.length - 1];
      return last || 'web-image';
    } catch {
      return 'web-image';
    }
  }

  // --- Local File Load Handler ---
  async function loadLocalFile() {
    if (typeof window.api !== 'undefined') {
      statusMessage.textContent = '로컬 이미지 파일 선택 중...';
      try {
        const fileData = await window.api.openImage();
        if (fileData) {
          statusMessage.textContent = '로컬 이미지 불러오는 중...';
          isLoading = true;
          currentImageInfo = await manager.loadImage(fileData.dataUrl, fileData.name, fileData.path);
          setupLoadedState();
          isLoading = false;
          isDirty = false;
        } else {
          statusMessage.textContent = '이미지 로드 취소됨';
        }
      } catch (err) {
        isLoading = false;
        statusMessage.textContent = `이미지 로드 에러: ${err.message}`;
      }
    } else {
      webFileInput.click();
    }
  }

  webFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    statusMessage.textContent = `이미지 파일 로딩 중: ${file.name}`;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        isLoading = true;
        currentImageInfo = await manager.loadImage(evt.target.result, file.name, '');
        setupLoadedState();
        isLoading = false;
        isDirty = false;
      } catch (err) {
        isLoading = false;
        statusMessage.textContent = `이미지 처리 에러: ${err.message}`;
      }
    };
    reader.readAsDataURL(file);
  });

  btnLoadLocal.addEventListener('click', loadLocalFile);
  welcomeBtnLocal.addEventListener('click', loadLocalFile);

  // --- State Setup ---
  function setupLoadedState() {
    welcomeOverlay.style.display = 'none';
    canvasContainer.style.display = 'block';

    // Show minimap image
    minimapImg.src = currentImageInfo.dataUrl;
    minimapImg.style.display = 'block';
    minimapViewport.style.display = 'block';

    // Update status
    statusDimensions.textContent = `크기: ${currentImageInfo.width} x ${currentImageInfo.height} px`;
    statusMessage.textContent = `이미지 로드 완료: ${currentImageInfo.name}`;

    // Enable buttons
    btnSaveProject.disabled = false;
    btnExportHtml.disabled = false;
    
    // Auto-adjust navigator panel height based on image aspect ratio (clamped between 180px and 280px)
    if (currentImageInfo) {
      const aspect = currentImageInfo.height / currentImageInfo.width;
      const targetHeight = Math.max(180, Math.min(280, 120 + 150 * aspect));
      document.querySelector('.navigator-section').style.height = `${targetHeight}px`;
    }
    
    // Initial minimap scale fit to width
    minimapScale = getMinimapWidthFitScale();

    // Auto-update minimap viewport size
    updateMinimapViewport();
  }

  // Calculate width-fit scale for navigator thumbnail
  function getMinimapWidthFitScale() {
    if (!currentImageInfo) return 1.0;
    const viewerRect = minimapViewer.getBoundingClientRect();
    const imgW = currentImageInfo.width;
    const imgH = currentImageInfo.height;

    const ratioX = viewerRect.width / imgW;
    const ratioY = viewerRect.height / imgH;
    const fitRatio = Math.min(ratioX, ratioY);

    if (fitRatio === 0) return 1.0;
    const scale = ratioX / fitRatio;
    return Math.max(1.0, Math.min(5.0, scale));
  }

  // --- Minimap Viewport Control ---
  function updateMinimapViewport() {
    if (!currentImageInfo) return;

    const viewerRect = minimapViewer.getBoundingClientRect();
    const viewportRect = manager.viewport.getBoundingClientRect();

    const imgW = currentImageInfo.width;
    const imgH = currentImageInfo.height;

    // Aspect ratio fitting calculations (contain)
    const ratioX = viewerRect.width / imgW;
    const ratioY = viewerRect.height / imgH;
    const fitRatio = Math.min(ratioX, ratioY);

    const actualMapW = imgW * fitRatio;
    const actualMapH = imgH * fitRatio;

    // Apply actual dimensions to minimap-content wrapper
    minimapContent.style.width = `${actualMapW}px`;
    minimapContent.style.height = `${actualMapH}px`;

    // Viewport relative bounds
    const visibleLeft = Math.max(0, -manager.offsetX / manager.scale);
    const visibleTop = Math.max(0, -manager.offsetY / manager.scale);
    const visibleW = Math.min(imgW, viewportRect.width / manager.scale);
    const visibleH = Math.min(imgH, viewportRect.height / manager.scale);

    // Map viewport coordinates relative to the unscaled actualMapW, actualMapH
    const vLeft = (visibleLeft / imgW) * actualMapW;
    const vTop = (visibleTop / imgH) * actualMapH;
    const vWidth = (visibleW / imgW) * actualMapW;
    const vHeight = (visibleH / imgH) * actualMapH;

    minimapViewport.style.left = `${vLeft}px`;
    minimapViewport.style.top = `${vTop}px`;
    minimapViewport.style.width = `${vWidth}px`;
    minimapViewport.style.height = `${vHeight}px`;

    // Calculate translation to keep the center of minimapViewport centered in the minimapViewer
    const viewportCenterX = vLeft + vWidth / 2;
    const viewportCenterY = vTop + vHeight / 2;

    const targetCenterX = viewerRect.width / 2;
    const targetCenterY = viewerRect.height / 2;

    // Translation formula for origin (0, 0)
    minimapDx = targetCenterX - (viewportCenterX * minimapScale);
    minimapDy = targetCenterY - (viewportCenterY * minimapScale);

    // Apply scale and translation transform to minimap-content
    minimapContent.style.transform = `translate(${minimapDx}px, ${minimapDy}px) scale(${minimapScale})`;
  }

  // Click & Drag navigation on Minimap
  let isMinimapDragging = false;

  function handleMinimapNavigate(e) {
    if (!currentImageInfo) return;

    const viewerRect = minimapViewer.getBoundingClientRect();
    const viewportRect = manager.viewport.getBoundingClientRect();

    const imgW = currentImageInfo.width;
    const imgH = currentImageInfo.height;

    const ratioX = viewerRect.width / imgW;
    const ratioY = viewerRect.height / imgH;
    const fitRatio = Math.min(ratioX, ratioY);

    const clickX = e.clientX - viewerRect.left;
    const clickY = e.clientY - viewerRect.top;

    // Map client coordinates back to unscaled minimapContent coordinates using inverse transform
    const u = (clickX - minimapDx) / minimapScale;
    const v = (clickY - minimapDy) / minimapScale;

    // Convert to original image coordinates
    const naturalX = u / fitRatio;
    const naturalY = v / fitRatio;

    // Center the viewport on this natural coordinate
    manager.offsetX = viewportRect.width / 2 - naturalX * manager.scale;
    manager.offsetY = viewportRect.height / 2 - naturalY * manager.scale;

    manager.applyTransform();
    manager.renderShapes();
  }

  minimapViewer.addEventListener('mousedown', (e) => {
    isMinimapDragging = true;
    handleMinimapNavigate(e);
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (isMinimapDragging) {
      handleMinimapNavigate(e);
    }
  });

  window.addEventListener('mouseup', () => {
    isMinimapDragging = false;
  });

  // --- Observer Hooks on Canvas Operations ---
  manager.onAreasChanged((areas) => {
    updateLayerList(areas);
    updateCode(areas);
    updateMinimapViewport();
    if (!isLoading) {
      isDirty = true;
    }
  });

  manager.onSelectionChanged((area) => {
    updatePropertyPanel(area);
    updateLayerListSelection(area ? area.id : null);
  });

  manager.onStatusChanged((message) => {
    statusMessage.textContent = message;
  });

  // Track viewport scrolls or resizing to sync Minimap frame
  manager.viewport.addEventListener('scroll', updateMinimapViewport);
  window.addEventListener('resize', updateMinimapViewport);
  
  // Custom hook for mousemove or updates in manager translate/scale
  const originalApplyTransform = manager.applyTransform;
  manager.applyTransform = function() {
    originalApplyTransform.apply(this, arguments);
    updateMinimapViewport();
  };

  // --- Layer List Updates ---
  function updateLayerList(areas) {
    layerList.innerHTML = '';
    
    if (areas.length === 0) {
      layerList.innerHTML = '<li class="empty-state">그려진 영역이 없습니다.</li>';
      btnDeleteArea.disabled = true;
      return;
    }

    btnDeleteArea.disabled = !manager.selectedAreaId;

    areas.forEach((area) => {
      const isSelected = area.id === manager.selectedAreaId;
      const isVisible = area.visible !== false;

      const li = document.createElement('li');
      li.className = `layer-item${isSelected ? ' selected' : ''}${!isVisible ? ' hidden-layer' : ''}`;
      li.dataset.id = area.id;

      // Icon classes for shapes
      const icons = { rect: 'ri-checkbox-blank-line', circle: 'ri-checkbox-blank-circle-line', poly: 'ri-pentagon-line' };
      const iconClass = icons[area.type] || 'ri-shape-line';

      li.innerHTML = `
        <i class="layer-shape-icon ${iconClass}"></i>
        <div class="layer-info">
          <span class="layer-name" title="더블클릭하여 이름 변경">${area.name}</span>
          <span class="layer-type">${area.type.toUpperCase()}</span>
        </div>
        <button class="layer-visibility${!isVisible ? ' hidden' : ''}" title="보이기/숨기기 토글">
          <i class="${isVisible ? 'ri-eye-line' : 'ri-eye-close-line'}"></i>
        </button>
      `;

      // Select Item on click
      li.addEventListener('mousedown', (e) => {
        // Prevent triggering renaming input submit prematurely
        if (e.target.tagName !== 'INPUT') {
          manager.selectArea(area.id);
        }
      });

      // Visibility Toggle click
      const visBtn = li.querySelector('.layer-visibility');
      visBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        manager.toggleAreaVisibility(area.id);
      });

      // Double-click to Rename
      const nameEl = li.querySelector('.layer-name');
      nameEl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        enterLayerRenameMode(area.id, nameEl);
      });

      layerList.appendChild(li);
    });
  }

  function enterLayerRenameMode(id, nameEl) {
    const originalText = nameEl.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'layer-name-input';
    input.value = originalText;
    
    nameEl.replaceWith(input);
    input.focus();
    input.select();

    const saveRename = () => {
      const val = input.value.trim();
      if (val && val !== originalText) {
        manager.renameArea(id, val);
      } else {
        input.replaceWith(nameEl);
      }
    };

    input.addEventListener('blur', saveRename);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        saveRename();
      } else if (e.key === 'Escape') {
        input.replaceWith(nameEl);
      }
    });
  }

  function updateLayerListSelection(selectedId) {
    const items = layerList.querySelectorAll('.layer-item');
    let selectedEl = null;

    items.forEach((item) => {
      const isSelected = item.dataset.id === selectedId;
      item.classList.toggle('selected', isSelected);
      if (isSelected) {
        selectedEl = item;
      }
    });

    btnDeleteArea.disabled = !selectedId;

    if (selectedEl) {
      selectedEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // --- Properties Panel Bindings ---
  function updatePropertyPanel(area) {
    if (!area) {
      propPanel.classList.add('disabled');
      propType.value = '선택 없음';
      propName.value = '';
      propName.disabled = true;
      propHref.value = '';
      propHref.disabled = true;
      propTarget.value = '_blank';
      propTarget.disabled = true;
      propAlt.value = '';
      propAlt.disabled = true;
      return;
    }

    propPanel.classList.remove('disabled');
    
    const typeNames = { rect: '사각형 (rect)', circle: '원형 (circle)', poly: '다각형 (poly)' };
    propType.value = typeNames[area.type] || area.type;

    propName.value = area.name || '';
    propName.disabled = false;

    propHref.value = area.href || '';
    propHref.disabled = false;
    
    propTarget.value = area.target || '_blank';
    propTarget.disabled = false;

    propAlt.value = area.alt || '';
    propAlt.disabled = false;
  }

  // Property Inputs Value Changed Listeners
  const updateSelectedAreaFromInputs = () => {
    if (!manager.selectedAreaId) return;
    
    manager.updateAreaProperties({
      name: propName.value.trim(),
      href: propHref.value.trim(),
      target: propTarget.value,
      alt: propAlt.value.trim()
    });
  };

  propName.addEventListener('input', updateSelectedAreaFromInputs);
  propHref.addEventListener('input', updateSelectedAreaFromInputs);
  propTarget.addEventListener('change', updateSelectedAreaFromInputs);
  propAlt.addEventListener('input', updateSelectedAreaFromInputs);

  // --- Project Loading Helper Functions ---
  async function loadProjectImage(imageSrc, htmlFilePath) {
    if (!imageSrc || imageSrc === 'your-image.jpg') {
      return { success: false, reason: 'empty' };
    }

    if (imageSrc.startsWith('data:')) {
      return { success: true, dataUrl: imageSrc, name: 'project-image.png', path: '' };
    }

    if (imageSrc.startsWith('http://') || imageSrc.startsWith('https://')) {
      statusMessage.textContent = '원격 이미지 불러오는 중...';
      const result = await loadImageFromUrl(imageSrc);
      if (result.success) {
        return {
          success: true,
          dataUrl: result.dataUrl,
          name: getUrlFilename(imageSrc),
          path: imageSrc
        };
      } else {
        return { success: false, reason: 'fetch-failed', error: result.error };
      }
    }

    if (typeof window.api !== 'undefined') {
      statusMessage.textContent = '로컬 이미지 파일 탐색 중...';
      const resolved = await window.api.resolveImage({ htmlPath: htmlFilePath, imageSrc });
      if (resolved) {
        return {
          success: true,
          dataUrl: resolved.dataUrl,
          name: resolved.name,
          path: resolved.path
        };
      } else {
        return { success: false, reason: 'not-found', path: imageSrc };
      }
    }

    return { success: false, reason: 'unsupported' };
  }

  async function handleImageLoadFallback(imageSrc, htmlFilePath) {
    const errorDetail = imageSrc ? `(${imageSrc})` : '';
    const confirmChoice = confirm(
      `프로젝트 이미지 파일${errorDetail}을 찾을 수 없거나 불러오지 못했습니다.\n\n` +
      `대신 사용할 이미지 파일을 수동으로 선택하시겠습니까?`
    );

    if (confirmChoice) {
      if (typeof window.api !== 'undefined') {
        const fileData = await window.api.openImage();
        if (fileData) {
          return fileData; // Contains dataUrl, name, path
        }
      } else {
        webFileInput.click();
      }
    }
    return null;
  }

  // --- HTML Code Generation ---
  function updateCode(areas) {
    let imgUrl = '';
    if (currentImageInfo) {
      const p = currentImageInfo.path || '';
      if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('data:')) {
        imgUrl = p;
      } else {
        imgUrl = currentImageInfo.name;
      }
    }
    const htmlCode = generateHTML(
      inputMapId.value.trim(),
      areas,
      imgUrl,
      chkRwd.checked
    );
    
    // Set value of the textarea
    codeOutput.value = htmlCode;

    // Disable apply button as code is now in sync
    btnApplyCode.disabled = true;
    btnApplyCode.classList.remove('active');
  }

  inputMapId.addEventListener('input', () => {
    updateCode(manager.areas);
  });

  chkRwd.addEventListener('change', () => {
    updateCode(manager.areas);
  });

  // Enable apply button on code output textarea modification
  codeOutput.addEventListener('input', () => {
    btnApplyCode.disabled = false;
    btnApplyCode.classList.add('active');
  });

  // Apply button click handler
  btnApplyCode.addEventListener('click', applyEditedHTML);

  // Ctrl + Enter shortcut inside textarea
  codeOutput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      applyEditedHTML();
    }
  });

  async function applyEditedHTML() {
    const rawContent = codeOutput.value.trim();
    if (!rawContent) return;

    statusMessage.textContent = '코드 분석 중...';
    try {
      const parsed = parseHTML(rawContent);

      // Check if image src in the HTML code is different from the current one
      if (currentImageInfo && parsed.imageSrc && parsed.imageSrc !== currentImageInfo.name && parsed.imageSrc !== currentImageInfo.path) {
        const changeImage = confirm(
          `입력하신 코드의 이미지 경로(${parsed.imageSrc})가 현재 로드된 이미지(${currentImageInfo.name})와 다릅니다.\n\n` +
          `코드의 이미지로 교체하시겠습니까?`
        );
        
        if (changeImage) {
          statusMessage.textContent = '새 이미지 불러오는 중...';
          const loadResult = await loadProjectImage(parsed.imageSrc, '');
          if (loadResult.success) {
            currentImageInfo = await manager.loadImage(
              loadResult.dataUrl,
              loadResult.name,
              loadResult.path
            );
            setupLoadedState();
          } else {
            alert(`이미지를 불러오지 못했습니다: ${loadResult.error || '파일이 없거나 지원되지 않는 포맷입니다.'}`);
            statusMessage.textContent = '이미지 변경 실패';
          }
        }
      }

      // Restore Map Properties
      inputMapId.value = parsed.mapId || 'image-map';

      // Restore Areas
      manager.areas = parsed.areas.map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        coords: a.coords,
        href: a.href,
        target: a.target || '_blank',
        alt: a.alt,
        visible: true
      }));

      // Selection state reset
      manager.selectedAreaId = null;
      
      // Save history state
      manager.history.push([...manager.areas.map(a => ({...a, coords: [...a.coords]}))]);
      manager.historyIndex = manager.history.length - 1;
      manager.updateUndoRedoButtons();

      manager.renderShapes();

      // Notify changes (will update Layer List, Properties Panel etc.)
      if (manager.onAreasChangedCallback) manager.onAreasChangedCallback(manager.areas);
      if (manager.onSelectionChangedCallback) manager.onSelectionChangedCallback(null);

      // Disable apply button as it is successfully applied
      btnApplyCode.disabled = true;
      btnApplyCode.classList.remove('active');
      statusMessage.textContent = '수정된 코드가 캔버스에 정상적으로 반영되었습니다.';
    } catch (err) {
      alert(`코드 적용 실패:\n${err.message}`);
      statusMessage.textContent = `코드 분석 에러: ${err.message}`;
    }
  }

  // Copy Code to Clipboard
  btnCopyCode.addEventListener('click', async () => {
    const textToCopy = codeOutput.value || codeOutput.textContent;
    if (!textToCopy || textToCopy.trim() === '') return;
    
    try {
      await navigator.clipboard.writeText(textToCopy);
      statusMessage.textContent = '코드가 클립보드에 복사되었습니다.';
      
      // Temporary button icon animation
      const icon = btnCopyCode.querySelector('i');
      icon.className = 'ri-check-line';
      setTimeout(() => {
        icon.className = 'ri-file-copy-line';
      }, 1500);
    } catch (err) {
      statusMessage.textContent = `복사 실패: ${err.message}`;
    }
  });

  // --- Tool Bindings ---
  toolSelect.addEventListener('click', () => manager.setTool('select'));
  toolRect.addEventListener('click', () => manager.setTool('rect'));
  toolCircle.addEventListener('click', () => manager.setTool('circle'));
  toolPoly.addEventListener('click', () => manager.setTool('poly'));
  toolHand.addEventListener('click', () => manager.setTool('hand'));

  // --- View Control Bindings ---
  btnZoomIn.addEventListener('click', () => manager.zoomIn());
  btnZoomOut.addEventListener('click', () => manager.zoomOut());
  btnZoomFit.addEventListener('click', () => manager.zoomFit());
  btnZoomWidth.addEventListener('click', () => manager.zoomWidthFit());
  
  // Navigator Zoom Control Bindings (Zooms the thumbnail inside navigator itself)
  btnNavZoomIn.addEventListener('click', () => {
    minimapScale = Math.min(5.0, minimapScale + 0.5);
    updateMinimapViewport();
  });
  btnNavZoomOut.addEventListener('click', () => {
    minimapScale = Math.max(1.0, minimapScale - 0.5);
    updateMinimapViewport();
  });
  btnNavZoom1to1.addEventListener('click', () => {
    minimapScale = 1.0;
    updateMinimapViewport();
  });
  btnNavZoomWidth.addEventListener('click', () => {
    minimapScale = getMinimapWidthFitScale();
    updateMinimapViewport();
  });

  // Right Panel Drag Resizer Bindings
  let isRightResizing = false;

  rightResizer.addEventListener('mousedown', (e) => {
    isRightResizing = true;
    rightResizer.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!isRightResizing) return;
    
    // Calculate new width based on mouse position relative to window edge
    const newWidth = window.innerWidth - e.clientX;
    
    // Clamp between min-width and max-width
    if (newWidth >= 250 && newWidth <= 600) {
      rightPanel.style.width = `${newWidth}px`;
      
      updateMinimapViewport();
    }
  });

  window.addEventListener('mouseup', () => {
    if (isRightResizing) {
      isRightResizing = false;
      rightResizer.classList.remove('dragging');
      document.body.style.cursor = 'default';
      document.body.style.userSelect = '';
      
      updateMinimapViewport();
    }
  });
  
  btnToggleGrid.addEventListener('click', () => manager.toggleGrid());
  btnToggleSnap.addEventListener('click', () => manager.toggleSnap());

  btnUndo.addEventListener('click', () => manager.undo());
  btnRedo.addEventListener('click', () => manager.redo());

  btnDeleteArea.addEventListener('click', () => manager.deleteSelected());

  // --- File I/O Bindings ---

  // Reset/New Project
  btnNew.addEventListener('click', () => {
    if (confirm('현재 작업 중인 내용이 지워집니다. 새 프로젝트를 시작하겠습니까?')) {
      currentImageInfo = null;
      manager.areas = [];
      manager.selectedAreaId = null;
      manager.history = [[]];
      manager.historyIndex = 0;
      manager.updateUndoRedoButtons();
      
      welcomeOverlay.style.display = 'flex';
      canvasContainer.style.display = 'none';
      minimapImg.style.display = 'none';
      minimapViewport.style.display = 'none';
      minimapImg.src = '';
      minimapScale = 1.0;
      
      statusDimensions.textContent = '크기: - x - px';
      statusMessage.textContent = '새 프로젝트 생성 완료';
      
      updateLayerList([]);
      updateCode([]);
      updatePropertyPanel(null);
      
      btnSaveProject.disabled = true;
      btnExportHtml.disabled = true;
      isDirty = false;
    }
  });

  // Export HTML File
  btnExportHtml.addEventListener('click', async () => {
    if (!currentImageInfo) return;

    let imgUrl = '';
    const p = currentImageInfo.path || '';
    if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('data:')) {
      imgUrl = p;
    } else {
      imgUrl = currentImageInfo.name;
    }

    const htmlContent = generateHTML(
      inputMapId.value.trim(),
      manager.areas,
      imgUrl,
      chkRwd.checked
    );

    statusMessage.textContent = 'HTML 내보내기 대화창 여는 중...';
    try {
      const result = await window.api.saveHTML(htmlContent);
      if (result.success) {
        statusMessage.textContent = `HTML 내보내기 성공: ${result.filePath}`;
        isDirty = false;
      } else {
        statusMessage.textContent = 'HTML 내보내기 취소됨';
      }
    } catch (err) {
      statusMessage.textContent = `HTML 저장 오류: ${err.message}`;
    }
  });

  // Reusable Save Project function
  async function triggerSaveProject() {
    if (!currentImageInfo) return false;

    const jsonContent = generateJSON(
      inputMapId.value.trim(),
      manager.areas,
      currentImageInfo
    );

    statusMessage.textContent = '프로젝트 저장 대화창 여는 중...';
    try {
      const result = await window.api.saveJSON(jsonContent);
      if (result.success) {
        statusMessage.textContent = `프로젝트 저장 성공: ${result.filePath}`;
        isDirty = false;
        return true;
      } else {
        statusMessage.textContent = '프로젝트 저장 취소됨';
        return false;
      }
    } catch (err) {
      statusMessage.textContent = `프로젝트 저장 오류: ${err.message}`;
      return false;
    }
  }

  // Save Project JSON
  btnSaveProject.addEventListener('click', async () => {
    await triggerSaveProject();
  });

  // Load Project JSON or HTML
  btnLoadProject.addEventListener('click', async () => {
    statusMessage.textContent = '프로젝트 불러오기 대화창 여는 중...';
    try {
      const projectData = await window.api.loadJSON();
      if (!projectData) {
        statusMessage.textContent = '프로젝트 불러오기 취소됨';
        return;
      }

      statusMessage.textContent = '프로젝트 파일 분석 중...';
      isLoading = true;
      const rawContent = projectData.content.trim();
      
      let mapId = '';
      let areas = [];
      let imageSrc = '';
      let isHtml = false;
      let projectImageInfo = null;

      if (rawContent.startsWith('<') || rawContent.includes('usemap=')) {
        // Parse HTML
        isHtml = true;
        const parsed = parseHTML(rawContent);
        mapId = parsed.mapId;
        imageSrc = parsed.imageSrc;
        areas = parsed.areas;
      } else {
        // Parse JSON
        const project = parseJSON(rawContent);
        mapId = project.mapId;
        areas = project.areas;
        if (project.image) {
          projectImageInfo = {
            dataUrl: project.image.dataUrl,
            name: project.image.name,
            path: project.image.path
          };
        }
      }

      // Resolve and Load image
      let targetImageInfo = null;
      
      if (isHtml) {
        const loadResult = await loadProjectImage(imageSrc, projectData.filePath);
        if (loadResult.success) {
          targetImageInfo = {
            dataUrl: loadResult.dataUrl,
            name: loadResult.name,
            path: loadResult.path
          };
        } else {
          // If remote URL fetch or file loading failed, show alert
          if (loadResult.reason === 'fetch-failed') {
            alert(`원격 이미지 로드 실패:\n${loadResult.error}`);
          }
          // Trigger fallback manual selector
          const fallbackData = await handleImageLoadFallback(imageSrc, projectData.filePath);
          if (fallbackData) {
            targetImageInfo = fallbackData;
          } else {
            statusMessage.textContent = '프로젝트 로드 취소됨 (이미지 없음)';
            isLoading = false;
            return;
          }
        }
      } else {
        // For JSON, use embedded dataUrl first
        if (projectImageInfo && projectImageInfo.dataUrl) {
          targetImageInfo = projectImageInfo;
        } else {
          // Fallback to manual selection
          const fallbackData = await handleImageLoadFallback('', projectData.filePath);
          if (fallbackData) {
            targetImageInfo = fallbackData;
          } else {
            statusMessage.textContent = '프로젝트 로드 취소됨 (이미지 없음)';
            isLoading = false;
            return;
          }
        }
      }

      statusMessage.textContent = '프로젝트 이미지 불러오는 중...';
      currentImageInfo = await manager.loadImage(
        targetImageInfo.dataUrl,
        targetImageInfo.name,
        targetImageInfo.path
      );
      
      setupLoadedState();

      // Restore Map Properties
      inputMapId.value = mapId || 'image-map';

      // Restore Areas
      manager.areas = areas.map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        coords: a.coords,
        href: a.href,
        target: a.target || '_blank',
        alt: a.alt,
        visible: a.visible !== false
      }));

      // Selection state reset
      manager.selectedAreaId = null;
      manager.history = [[...manager.areas.map(a => ({...a, coords: [...a.coords]}))]];
      manager.historyIndex = 0;
      manager.updateUndoRedoButtons();

      manager.renderShapes();
      
      // Notify changes
      if (manager.onAreasChangedCallback) manager.onAreasChangedCallback(manager.areas);
      if (manager.onSelectionChangedCallback) manager.onSelectionChangedCallback(null);

      statusMessage.textContent = `프로젝트 불러오기 성공: ${currentImageInfo.name}`;
      isLoading = false;
      isDirty = false;
    } catch (err) {
      isLoading = false;
      alert(`프로젝트 불러오기 실패:\n${err.message}`);
      statusMessage.textContent = `프로젝트 불러오기 실패: ${err.message}`;
    }
  });

  // --- Browser Fallback beforeunload ---
  window.addEventListener('beforeunload', (e) => {
    if (isDirty && typeof window.api === 'undefined') {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // --- IPC Close & Save Handlers ---
  if (typeof window.api !== 'undefined') {
    window.api.onCheckDirty(() => {
      window.api.replyDirty({ isDirty });
    });

    window.api.onTriggerSaveAndClose(async () => {
      const saved = await triggerSaveProject();
      if (saved) {
        window.api.forceClose();
      }
    });
  }
});
