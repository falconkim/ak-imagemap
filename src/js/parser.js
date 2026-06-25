/**
 * Parser utility for generating standard HTML image maps and JSON project files,
 * as well as loading project JSON configurations.
 */

/**
 * Generates web-standard HTML image map tags.
 * @param {string} mapId - The name and id of the map.
 * @param {Array} areas - The list of map area objects.
 * @param {string} imageUrl - The URL or local path of the target image.
 * @param {boolean} includeRwd - Whether to include the responsive image map JS runtime script.
 * @returns {string} The final HTML string.
 */
export function generateHTML(mapId, areas, imageUrl, includeRwd = true) {
  const mapName = mapId || 'image-map';
  const displayUrl = imageUrl || 'your-image.jpg';

  let areaTags = '';
  const filteredAreas = areas.filter(a => a.visible !== false);

  if (filteredAreas.length === 0) {
    areaTags = '  <!-- 그려진 영역이 아직 없습니다 -->';
  } else {
    areaTags = filteredAreas.map(area => {
      const shape = area.type; // rect, circle, poly
      const coordsStr = area.coords.join(',');
      const href = area.href ? ` href="${area.href}"` : '';
      const target = area.href && area.target ? ` target="${area.target}"` : '';
      const alt = area.alt ? ` alt="${area.alt}"` : '';
      
      // Store original coordinates in data-coords for RWD calculations
      return `  <area shape="${shape}" coords="${coordsStr}" data-coords="${coordsStr}"${href}${target}${alt}>`;
    }).join('\n');
  }

  let html = `<img src="${displayUrl}" usemap="#${mapName}" alt="Image Map">\n`;
  html += `<map name="${mapName}" id="${mapName}">\n${areaTags}\n</map>`;

  if (includeRwd && filteredAreas.length > 0) {
    html += `\n\n<!-- Responsive Image Map Javascript Support -->
<script>
(function() {
  function resizeImageMap() {
    const map = document.getElementById('${mapName}');
    if (!map) return;
    const img = document.querySelector('img[usemap="#${mapName}"]');
    if (!img) return;
    
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    if (!naturalWidth || !naturalHeight) return;
    
    const rect = img.getBoundingClientRect();
    const scaleX = rect.width / naturalWidth;
    const scaleY = rect.height / naturalHeight;
    
    const areas = map.getElementsByTagName('area');
    for (let i = 0; i < areas.length; i++) {
      const area = areas[i];
      const originalCoords = area.getAttribute('data-coords');
      if (!originalCoords) continue;
      
      const coordsArr = originalCoords.split(',').map(Number);
      const shape = area.getAttribute('shape').toLowerCase();
      const newCoords = [];
      
      if (shape === 'rect') {
        newCoords.push(Math.round(coordsArr[0] * scaleX));
        newCoords.push(Math.round(coordsArr[1] * scaleY));
        newCoords.push(Math.round(coordsArr[2] * scaleX));
        newCoords.push(Math.round(coordsArr[3] * scaleY));
      } else if (shape === 'circle') {
        newCoords.push(Math.round(coordsArr[0] * scaleX));
        newCoords.push(Math.round(coordsArr[1] * scaleY));
        // Use X axis scaling for circle radius
        newCoords.push(Math.round(coordsArr[2] * scaleX));
      } else if (shape === 'poly') {
        for (let j = 0; j < coordsArr.length; j += 2) {
          newCoords.push(Math.round(coordsArr[j] * scaleX));
          newCoords.push(Math.round(coordsArr[j + 1] * scaleY));
        }
      }
      
      area.setAttribute('coords', newCoords.join(','));
    }
  }
  
  // Register resize handlers
  window.addEventListener('resize', resizeImageMap);
  
  // Execute after image load or immediately if cached
  const targetImg = document.querySelector('img[usemap="#${mapName}"]');
  if (targetImg) {
    if (targetImg.complete) {
      resizeImageMap();
    } else {
      targetImg.addEventListener('load', resizeImageMap);
    }
  }
})();
</script>`;
  }

  return html;
}

/**
 * Generates JSON configuration string for project saving.
 * @param {string} mapId - The map ID.
 * @param {Array} areas - The list of area configurations.
 * @param {Object} imageInfo - Metadata of the current image.
 * @returns {string} The JSON string.
 */
export function generateJSON(mapId, areas, imageInfo) {
  const project = {
    version: '1.0.0',
    mapId: mapId || 'image-map',
    image: {
      path: imageInfo.path || '',
      name: imageInfo.name || '',
      dataUrl: imageInfo.dataUrl || '',
      width: imageInfo.width || 0,
      height: imageInfo.height || 0
    },
    areas: areas.map(area => ({
      id: area.id,
      name: area.name,
      type: area.type,
      coords: area.coords,
      href: area.href || '',
      target: area.target || '_blank',
      alt: area.alt || '',
      visible: area.visible !== false
    }))
  };

  return JSON.stringify(project, null, 2);
}

/**
 * Parses JSON project data string.
 * @param {string} jsonString - The JSON string representing the project.
 * @returns {Object} The parsed project configuration.
 */
export function parseJSON(jsonString) {
  try {
    const project = JSON.parse(jsonString);
    if (!project || project.version !== '1.0.0') {
      throw new Error('지원되지 않는 버전이거나 유효하지 않은 프로젝트 파일입니다.');
    }
    return project;
  } catch (err) {
    throw new Error('프로젝트 파일을 파싱하는 데 실패했습니다: ' + err.message);
  }
}

/**
 * Parses web-standard HTML image map tags.
 * @param {string} htmlContent - The HTML string containing img, map, area tags.
 * @returns {Object} Parsed map config with mapId, imageSrc, and areas list.
 */
export function parseHTML(htmlContent) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    
    // Find map tag
    const map = doc.querySelector('map');
    if (!map) {
      throw new Error('HTML 내용 중 <map> 태그를 찾을 수 없습니다.');
    }
    
    const mapId = map.getAttribute('id') || map.getAttribute('name') || 'image-map';
    
    // Find image src
    let imageUrl = '';
    const img = doc.querySelector(`img[usemap="#${mapId}"]`) || doc.querySelector('img[usemap]');
    if (img) {
      imageUrl = img.getAttribute('src') || '';
    }
    
    // Parse areas
    const areaElements = map.querySelectorAll('area');
    const areas = Array.from(areaElements).map((area, index) => {
      const type = (area.getAttribute('shape') || 'rect').toLowerCase();
      // data-coords has original resolution coordinates, coords has current/RWD modified
      const coordsStr = area.getAttribute('data-coords') || area.getAttribute('coords') || '';
      const coords = coordsStr.split(',').map(v => parseInt(v.trim(), 10)).filter(v => !isNaN(v));
      
      const href = area.getAttribute('href') || '';
      const target = area.getAttribute('target') || '_blank';
      const alt = area.getAttribute('alt') || '';
      const name = area.getAttribute('alt') || area.getAttribute('title') || `Area ${index + 1}`;
      const id = `area_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${index}`;
      
      return {
        id,
        name,
        type,
        coords,
        href,
        target,
        alt,
        visible: true
      };
    });
    
    return {
      mapId,
      imageSrc: imageUrl,
      areas
    };
  } catch (err) {
    throw new Error('HTML 코드를 파싱하는 데 실패했습니다: ' + err.message);
  }
}
