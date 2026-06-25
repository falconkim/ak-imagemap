/**
 * Network module for handling URL image validation and detailed error reporting.
 * Exposes helper functions to fetch and validate web images safely via Electron's main process.
 */

/**
 * Fetches an image from a remote URL, bypasses CORS via Electron main process, and parses detailed HTTP/network errors.
 * @param {string} url - The remote image URL.
 * @returns {Promise<{success: boolean, dataUrl?: string, error?: string}>} Resolves with success state and dataUrl or error message.
 */
export async function loadImageFromUrl(url) {
  if (!url) {
    return { success: false, error: 'URL 주소가 비어 있습니다.' };
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return { success: false, error: '올바른 URL 형식(http:// 또는 https://)이 아닙니다.' };
  }

  // Web Mode Browser Fallback (if window.api bridge is undefined)
  if (typeof window.api === 'undefined') {
    try {
      let response;
      let targetUrl = url;
      try {
        response = await fetch(targetUrl);
      } catch (fetchErr) {
        // Fallback to http if https fetch failed due to network/CORS mismatch
        if (url.startsWith('https://')) {
          targetUrl = url.replace('https://', 'http://');
          response = await fetch(targetUrl);
        } else {
          throw fetchErr;
        }
      }

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP 오류가 발생했습니다. (상태 코드: ${response.status} ${response.statusText})`
        };
      }

      const blob = await response.blob();
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      return { success: true, dataUrl };
    } catch (err) {
      return {
        success: false,
        error: '웹 브라우저의 보안 정책(CORS)으로 인해 해당 주소의 웹 이미지를 직접 가져올 수 없습니다. 이미지 호스트 서버가 외부 교차 출처 요청을 차단했습니다. (팁: 동일 기능을 데스크톱 버전 앱에서 실행하시면 CORS 보안 제약을 자동으로 우회하여 이미지를 완벽히 불러올 수 있습니다.)'
      };
    }
  }

  try {
    // Invoke main process network fetcher (Electron Mode)
    let result = await window.api.fetchImage(url);
    
    // Fallback: If https failed, retry using http
    if (!result.success && url.startsWith('https://')) {
      const httpUrl = url.replace('https://', 'http://');
      result = await window.api.fetchImage(httpUrl);
    }
    
    if (result.success) {
      return {
        success: true,
        dataUrl: result.dataUrl
      };
    }
    
    // Parse detailed error messages for premium UX
    let errorMessage = '이미지를 불러오는 데 실패했습니다.';
    
    switch (result.errorType) {
      case 'http-error':
        if (result.status === 404) {
          errorMessage = '이미지를 찾을 수 없습니다. (404 Not Found) URL 경로가 정확한지 확인해 주세요.';
        } else if (result.status === 403) {
          errorMessage = '이미지에 접근할 수 있는 권한이 없습니다. (403 Forbidden)';
        } else if (result.status >= 500) {
          errorMessage = `이미지 제공 서버에 내부 오류가 발생했습니다. (HTTP ${result.status} ${result.statusText})`;
        } else {
          errorMessage = `HTTP 오류가 발생했습니다. (상태 코드: ${result.status} ${result.statusText})`;
        }
        break;
        
      case 'connection-error':
        errorMessage = '서버 이름을 해석할 수 없거나 네트워크 연결이 끊어졌습니다. 도메인 주소 및 인터넷 연결 상태를 확인해 주세요.';
        break;
        
      case 'network-error':
      default:
        errorMessage = `네트워크 통신 중 오류가 발생했습니다: ${result.message || '알 수 없는 오류'}`;
        break;
    }
    
    return {
      success: false,
      error: errorMessage
    };
  } catch (err) {
    return {
      success: false,
      error: `예기치 않은 시스템 예외가 발생했습니다: ${err.message}`
    };
  }
}
