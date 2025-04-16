const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
// const captureBtn = document.getElementById('capture-btn'); // 改為 process-btn
const ingredientsDiv = document.getElementById('ingredients');
const recipesDiv = document.getElementById('recipes');
const errorMessageDiv = document.getElementById('error-message');
const apiKeyInput = document.getElementById('api-key-input');

// --- 新增元素獲取 ---
const fileInput = document.getElementById('file-input');
const imagePreviewsDiv = document.getElementById('image-previews');
const clearFilesBtn = document.getElementById('clear-files-btn');
const processBtn = document.getElementById('process-btn'); // 使用新的按鈕 ID

// --- Google Gemini API 端點基礎 URL ---
// const API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent'; // 已棄用
// const API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent'; // 更新為 1.5 pro 最新模型
const API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'; // 改回 flash 最新模型

// --- 狀態變數 ---
let uploadedFiles = []; // 用於儲存上傳的 File 物件
let cameraShotsBase64 = []; // 新增：用於儲存相機拍攝的 Base64 圖片
let cameraStreamActive = false; // 追蹤相機是否成功啟動

// --- 新增元素獲取 (補上相機拍照按鈕) ---
const captureShotBtn = document.getElementById('capture-shot-btn');
const clearShotsBtn = document.getElementById('clear-shots-btn');

// --- 新增：localStorage 的 Key 名稱 ---
const LOCAL_STORAGE_API_KEY = 'geminiApiKey';

// --- 新增：手動輸入元素獲取 ---
const manualIngredientsInput = document.getElementById('manual-ingredients-input');
const suggestRecipesManualBtn = document.getElementById('suggest-recipes-manual-btn');

// --- 新增：頁面載入時讀取 localStorage ---
function loadApiKeyFromLocalStorage() {
    const savedKey = localStorage.getItem(LOCAL_STORAGE_API_KEY);
    if (savedKey) {
        apiKeyInput.value = savedKey;
        console.log("已從 localStorage 載入 API 金鑰。");
    }
}

// 啟動相機
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }, // 優先使用後置鏡頭
            audio: false
        });
        video.srcObject = stream;
        await video.play(); // 確保影片開始播放
        cameraStreamActive = true;
        // 在成功啟動相機後，啟用拍照按鈕
        if (cameraStreamActive && captureShotBtn) {
            captureShotBtn.disabled = false;
        }
    } catch (err) {
        console.error("無法啟動相機:", err);
        // 即使相機失敗，也要允許檔案上傳，所以只顯示控制台錯誤，不顯示 UI 錯誤
        // showError(`無法啟動相機：${err.message}。您仍然可以上傳檔案。`);
        console.warn(`無法啟動相機：${err.message}。您仍然可以上傳檔案。`);
        cameraStreamActive = false;
        // 可以考慮隱藏相機區塊或顯示提示
        const cameraContainer = document.getElementById('camera-container');
        if (cameraContainer) {
            cameraContainer.innerHTML += '<p class="error">無法啟動相機，請檢查權限或裝置。</p>';
            video.style.display = 'none'; // 隱藏 video 元素
        }
    }
}

// 顯示載入狀態
function showLoading(isProcessing) {
    if (isProcessing) {
        loadingIndicator.style.display = 'flex';
        resultsSection.style.display = 'none'; // 隱藏舊結果
        errorMessageDiv.style.display = 'none'; // 隱藏舊錯誤
    } else {
        loadingIndicator.style.display = 'none';
    }
}

// 顯示結果 (成功時調用)
function showResults() {
    resultsSection.style.display = 'block';
    loadingIndicator.style.display = 'none';
    errorMessageDiv.style.display = 'none';
}

// 顯示錯誤訊息 (覆蓋之前的，確保顯示)
function showError(message) {
    errorMessageDiv.textContent = message;
    errorMessageDiv.style.display = 'block';
    resultsSection.style.display = 'none'; // 出錯時也隱藏結果區
    loadingIndicator.style.display = 'none'; // 隱藏載入
    // 保持舊的結果區文本清空邏輯 (可選)
    // ingredientsDiv.textContent = '操作出錯';
    // recipesDiv.textContent = '操作出錯';
}

// --- 檔案處理 --- 
// 將 File 物件讀取為 Base64
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]); // 只返回 Base64 部分
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
}

// --- 更新：合併顯示預覽 (相機 + 檔案) ---
function updateImagePreviews() {
    imagePreviewsDiv.innerHTML = ''; // 清空預覽區

    // 顯示相機拍攝的預覽
    cameraShotsBase64.forEach((base64, index) => {
        const img = document.createElement('img');
        img.src = `data:image/jpeg;base64,${base64}`;
        img.title = `相機照片 ${index + 1}`;
        imagePreviewsDiv.appendChild(img);
    });

    // 顯示上傳檔案的預覽
    uploadedFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.title = file.name;
            imagePreviewsDiv.appendChild(img);
        }
        reader.readAsDataURL(file);
    });

    // 根據是否有預覽決定是否顯示清除按鈕
    clearShotsBtn.style.display = cameraShotsBase64.length > 0 ? 'inline-block' : 'none';
    clearFilesBtn.style.display = uploadedFiles.length > 0 ? 'inline-block' : 'none';
}

// 處理檔案選擇 (修改為調用 updateImagePreviews)
fileInput.addEventListener('change', (event) => {
    const files = event.target.files;
    if (!files) return;
    const newFiles = Array.from(files);
    uploadedFiles = uploadedFiles.concat(newFiles);
    updateImagePreviews(); // 更新合併後的預覽
    fileInput.value = ''; 
});

// 清除上傳的檔案 (修改為調用 updateImagePreviews)
clearFilesBtn.addEventListener('click', () => {
    uploadedFiles = [];
    updateImagePreviews(); // 更新預覽
    fileInput.value = '';
});

// --- 新增：相機拍照處理 ---

captureShotBtn.addEventListener('click', () => {
    if (!cameraStreamActive || video.readyState < video.HAVE_METADATA || video.videoWidth === 0) {
        showError('相機尚未準備就緒或無法獲取畫面。');
        return;
    }
    clearError();

    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const cameraImageBase64 = canvas.toDataURL('image/jpeg').split(',')[1];

    if (cameraImageBase64) {
        cameraShotsBase64.push(cameraImageBase64);
        updateImagePreviews(); // 更新預覽區
        console.log(`已拍攝第 ${cameraShotsBase64.length} 張相機照片。`);
    } else {
        showError('無法從相機獲取圖片資料。');
    }
});

// --- 新增：清除相機照片 ---
clearShotsBtn.addEventListener('click', () => {
    cameraShotsBase64 = [];
    updateImagePreviews(); // 更新預覽
});

// --- 主要處理邏輯 (圖片識別) ---
processBtn.addEventListener('click', async () => {
    clearError(); // 這裡僅清除錯誤訊息狀態，不影響顯示
    showLoading(true); // 顯示載入

    // 延遲一小段時間讓 UI 更新 (可選)
    await new Promise(resolve => setTimeout(resolve, 50)); 

    const apiKey = localStorage.getItem(LOCAL_STORAGE_API_KEY);
    if (!apiKey) {
        showError('請先在上方欄位輸入您的 Google Gemini API 金鑰。');
        return;
    }

    localStorage.setItem(LOCAL_STORAGE_API_KEY, apiKey);
    console.log("API 金鑰已儲存到 localStorage。");

    let imageBase64List = [];

    if (cameraShotsBase64.length > 0) {
        imageBase64List = imageBase64List.concat(cameraShotsBase64);
        console.log(`已收集 ${cameraShotsBase64.length} 張相機照片。`);
    }

    if (uploadedFiles.length > 0) {
        ingredientsDiv.textContent = `正在處理 ${uploadedFiles.length} 張上傳圖片...`; // 更新提示
        try {
            const uploadedImagesBase64 = await Promise.all(uploadedFiles.map(readFileAsBase64));
            imageBase64List = imageBase64List.concat(uploadedImagesBase64);
            console.log(`已收集 ${uploadedFiles.length} 張上傳圖片。`);
        } catch (error) {
            console.error("讀取上傳檔案時出錯:", error);
            showError(`讀取上傳檔案時出錯： ${error.message}`);
            return;
        }
    }

    if (imageBase64List.length === 0) {
        showError('請先使用相機拍攝或上傳至少一張食材圖片。');
        return;
    }

    ingredientsDiv.textContent = `正在識別 ${imageBase64List.length} 張圖片中的食材...`;
    recipesDiv.textContent = '等待識別結果...';

    try {
        const promptText = `請辨識以下 ${imageBase64List.length} 張圖片中的所有食材，匯總後用繁體中文列出，並以逗號分隔。`;
        const identifiedIngredientsText = await callGeminiAPI(apiKey, imageBase64List, promptText);

        if (!identifiedIngredientsText || identifiedIngredientsText.startsWith('請求被阻擋') || identifiedIngredientsText.startsWith('API 回應格式不符')) {
            showError(`無法獲取有效的食材辨識結果：${identifiedIngredientsText}`);
            return;
        }
        ingredientsDiv.textContent = identifiedIngredientsText;

        const recipePrompt = `這是我目前有的食材：${identifiedIngredientsText}。請根據這些食材，建議 3 道簡單的繁體中文家庭菜單，包含菜名和主要步驟。`;
        const suggestedRecipesText = await callGeminiAPI(apiKey, null, recipePrompt);

        if (!suggestedRecipesText || suggestedRecipesText.startsWith('請求被阻擋') || suggestedRecipesText.startsWith('API 回應格式不符')) {
            showError(`無法獲取有效的菜單建議結果：${suggestedRecipesText}`);
            return;
        }
        recipesDiv.textContent = suggestedRecipesText;

        showResults(); // 成功，顯示結果區

    } catch (error) {
        console.error("圖片識別 API 呼叫失敗:", error);
        showError(`圖片識別 API 呼叫失敗：${error.message}`);
    } finally {
        // 無論成功或失敗，確保 loading 隱藏 (雖然 showResults/showError 已處理，但 finally 更保險)
        // showLoading(false); 
    }
});

// --- 新增：處理手動輸入食材建議的函數 ---
suggestRecipesManualBtn.addEventListener('click', async () => {
    clearError();
    showLoading(true); // 顯示載入

    await new Promise(resolve => setTimeout(resolve, 50)); 

    const apiKey = localStorage.getItem(LOCAL_STORAGE_API_KEY);
    if (!apiKey) {
        showError('請先在上方欄位輸入您的 Google Gemini API 金鑰。');
        return;
    }
    localStorage.setItem(LOCAL_STORAGE_API_KEY, apiKey);

    const manualIngredients = manualIngredientsInput.value.trim();
    if (!manualIngredients) {
        showError('請在文字框中輸入您擁有的食材。');
        return;
    }

    ingredientsDiv.textContent = manualIngredients; // 直接顯示輸入的內容
    recipesDiv.textContent = '正在生成建議菜單...';

    try {
        const recipePrompt = `這是我目前有的食材：${manualIngredients}。請根據這些食材，建議 3 道簡單的繁體中文家庭菜單，包含菜名和主要步驟。`;
        const suggestedRecipesText = await callGeminiAPI(apiKey, null, recipePrompt);

        if (!suggestedRecipesText || suggestedRecipesText.startsWith('請求被阻擋') || suggestedRecipesText.startsWith('API 回應格式不符')) {
            showError(`無法獲取有效的菜單建議結果：${suggestedRecipesText}`);
            return;
        }
        recipesDiv.textContent = suggestedRecipesText;
        showResults(); // 成功，顯示結果區

    } catch (error) {
        console.error("手動建議 API 呼叫失敗:", error);
        showError(`手動建議 API 呼叫失敗：${error.message}`);
    } finally {
        // showLoading(false);
    }
});

// 呼叫 Google Gemini API
// 修改：接受 imageBase64List (陣列) 或 null
async function callGeminiAPI(apiKey, imageBase64List, textPrompt) {
    const API_URL = `${API_BASE_URL}?key=${apiKey}`;

    const requestBody = {
        contents: [
            {
                parts: []
            }
        ]
    };

    // 先加入文字提示
    requestBody.contents[0].parts.push({ text: textPrompt });

    // 如果有圖片資料，為每張圖片加入一個 part
    if (imageBase64List && imageBase64List.length > 0) {
        imageBase64List.forEach(imgBase64 => {
            requestBody.contents[0].parts.push({
                inline_data: {
                    mime_type: 'image/jpeg',
                    data: imgBase64
                }
            });
        });
    }

    // 確保 parts 陣列至少有一個元素 (文字提示)
    if (requestBody.contents[0].parts.length === 0) {
        console.error("請求體缺少 parts");
        throw new Error("請求體無效，缺少提示文字。");
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorBody = await response.json();
            console.error("API 錯誤回應:", errorBody);
            // 嘗試提取更詳細的錯誤訊息
            let detail = errorBody.error?.message || '未知錯誤';
            if (errorBody.error?.details) {
                detail += ` (${JSON.stringify(errorBody.error.details)})`;
            }
            throw new Error(`API 請求失敗，狀態碼：${response.status}. ${detail}`);
        }

        const data = await response.json();

        // 從回應中提取生成的文字內容
        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
            const textPart = data.candidates[0].content.parts.find(part => part.text);
            if (textPart) {
                return textPart.text.trim();
            } else {
                console.warn("API 回應中未找到文字部分:", data);
                return "API 回應格式不符，未找到文字結果。";
            }
        } else {
            console.warn("API 回應格式不符或無有效內容:", data);
            if (data.promptFeedback && data.promptFeedback.blockReason) {
                let reason = `請求被阻擋：${data.promptFeedback.blockReason}.`;
                if(data.promptFeedback.safetyRatings) {
                    reason += ` 安全評級: ${data.promptFeedback.safetyRatings.map(r => `${r.category}: ${r.probability}`).join(', ')}`;
                }
                return reason;
            }
            return "API 未返回有效的生成內容。";
        }

    } catch (error) {
        console.error('呼叫 Gemini API 時出錯:', error);
        throw error;
    }
}

// 頁面載入時啟動相機 和 載入 API Key (修改：初始禁用拍照按鈕)
window.addEventListener('load', () => {
    if (captureShotBtn) captureShotBtn.disabled = true; // 預設禁用，等待相機啟動
    startCamera();
    loadApiKeyFromLocalStorage();
});

// Toast 通知
function showToast(message, type = 'primary') {
  const toastEl = document.getElementById('toast');
  const toastBody = document.getElementById('toast-body');
  toastBody.innerHTML = message;
  toastEl.className = `toast align-items-center text-bg-${type} border-0`;
  const toast = new bootstrap.Toast(toastEl);
  toast.show();
}

// 複製 API Key
const copyApiKeyBtn = document.getElementById('copy-api-key-btn');
if (copyApiKeyBtn) {
  copyApiKeyBtn.addEventListener('click', () => {
    const apiKeyInput = document.getElementById('api-key-input');
    if (apiKeyInput.value) {
      navigator.clipboard.writeText(apiKeyInput.value);
      showToast('API 金鑰已複製', 'success');
    } else {
      showToast('沒有可複製的 API 金鑰', 'warning');
    }
  });
}

// 主題切換
const themeToggleBtn = document.getElementById('theme-toggle-btn');
themeToggleBtn.addEventListener('click', () => {
  const html = document.body;
  const isDark = html.getAttribute('data-bs-theme') === 'dark';
  html.setAttribute('data-bs-theme', isDark ? 'light' : 'dark');
  themeToggleBtn.innerHTML = isDark
    ? '<i class="bi bi-moon-stars-fill"></i>'
    : '<i class="bi bi-brightness-high-fill"></i>';
  showToast(isDark ? '切換為淺色主題' : '切換為深色主題', 'info');
});
// 載入時自動根據系統主題
window.addEventListener('DOMContentLoaded', () => {
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.body.setAttribute('data-bs-theme', 'dark');
    themeToggleBtn.innerHTML = '<i class="bi bi-brightness-high-fill"></i>';
  }
});

// 顯示 loading
function showLoading(isLoading) {
  document.getElementById('loading-indicator').classList.toggle('d-none', !isLoading);
}
// 顯示結果
function showResults() {
  document.getElementById('results').classList.remove('d-none');
  document.getElementById('loading-indicator').classList.add('d-none');
  document.getElementById('error-message').classList.add('d-none');
  // 觸發動畫
  document.getElementById('results').classList.add('animate__fadeInUp');
}
// 顯示錯誤
function showError(msg) {
  const err = document.getElementById('error-message');
  err.textContent = msg;
  err.classList.remove('d-none');
  document.getElementById('results').classList.add('d-none');
  document.getElementById('loading-indicator').classList.add('d-none');
  showToast(msg, 'danger');
}

// 頁面載入時檢查金鑰
window.addEventListener('DOMContentLoaded', () => {
  const LOCAL_STORAGE_API_KEY = 'geminiApiKey';
  const apiKey = localStorage.getItem(LOCAL_STORAGE_API_KEY);
  if (!apiKey) {
    window.location.href = 'apikey.html';
    return;
  }
  // ...其餘初始化...
}); 