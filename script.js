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

// 顯示錯誤訊息
function showError(message) {
    errorMessageDiv.textContent = message;
    errorMessageDiv.style.display = 'block';
    ingredientsDiv.textContent = '操作出錯';
    recipesDiv.textContent = '操作出錯';
}

// 隱藏錯誤訊息
function clearError() {
    errorMessageDiv.textContent = '';
    errorMessageDiv.style.display = 'none';
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

// --- 主要處理邏輯 (修改圖片收集方式) --- 
processBtn.addEventListener('click', async () => {
    clearError();
    ingredientsDiv.textContent = '準備處理圖片...';
    recipesDiv.textContent = '等待圖片處理...';

    // 1. 檢查 API 金鑰
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        showError('請先在上方欄位輸入您的 Google Gemini API 金鑰。');
        return;
    }

    // --- 新增：儲存 API 金鑰到 localStorage ---
    // 警告：localStorage 不適合儲存非常敏感的資料於生產環境
    // 但對於本機開發或個人工具來說相對方便
    localStorage.setItem(LOCAL_STORAGE_API_KEY, apiKey);
    console.log("API 金鑰已儲存到 localStorage。");

    let imageBase64List = [];

    // 2. 收集相機拍攝的照片 (從 cameraShotsBase64 陣列)
    if (cameraShotsBase64.length > 0) {
        imageBase64List = imageBase64List.concat(cameraShotsBase64);
        console.log(`已收集 ${cameraShotsBase64.length} 張相機照片。`);
    }

    // 3. 收集上傳的圖片 (與之前相同，但讀取移到 fileInput change 事件中)
    if (uploadedFiles.length > 0) {
        ingredientsDiv.textContent = `正在處理 ${uploadedFiles.length} 張上傳圖片...`; // 更新提示
        try {
            // 確保 Base64 數據已經準備好 (實際上已在 change 事件中讀取預覽，這裡直接用)
            // 為了與之前的邏輯保持一致，可以重新讀取，或者直接使用預覽的 src (需要修改)
            // 為了簡單起見，我們假設 readFileAsBase64 仍然需要被調用
            const uploadedImagesBase64 = await Promise.all(uploadedFiles.map(readFileAsBase64));
            imageBase64List = imageBase64List.concat(uploadedImagesBase64);
            console.log(`已收集 ${uploadedFiles.length} 張上傳圖片。`);
        } catch (error) {
            console.error("讀取上傳檔案時出錯:", error);
            showError(`讀取上傳檔案時出錯： ${error.message}`);
            return;
        }
    }

    // 4. 檢查是否有任何圖片
    if (imageBase64List.length === 0) {
        showError('請先使用相機拍攝或上傳至少一張食材圖片。');
        return;
    }

    ingredientsDiv.textContent = `正在識別 ${imageBase64List.length} 張圖片中的食材...`;
    recipesDiv.textContent = '等待識別結果...';

    // 5. 呼叫 Gemini API 識別食材
    try {
        const promptText = `請辨識以下 ${imageBase64List.length} 張圖片中的所有食材，匯總後用繁體中文列出，並以逗號分隔。`;
        const identifiedIngredientsText = await callGeminiAPI(apiKey, imageBase64List, promptText);

        if (!identifiedIngredientsText || identifiedIngredientsText.startsWith('請求被阻擋') || identifiedIngredientsText.startsWith('API 回應格式不符')) {
            showError(`無法獲取有效的食材辨識結果：${identifiedIngredientsText}`);
            return;
        }

        ingredientsDiv.textContent = `識別出的食材： ${identifiedIngredientsText}`; 

        // 6. 根據食材建議菜單
        recipesDiv.textContent = '正在生成建議菜單...';
        const recipePrompt = `這是我目前有的食材：${identifiedIngredientsText}。請根據這些食材，建議 3 道簡單的繁體中文家庭菜單，包含菜名和主要步驟。`;
        // 第二次呼叫，僅使用文字，不再傳遞圖片
        const suggestedRecipesText = await callGeminiAPI(apiKey, null, recipePrompt);

        if (!suggestedRecipesText || suggestedRecipesText.startsWith('請求被阻擋') || suggestedRecipesText.startsWith('API 回應格式不符')) {
            showError(`無法獲取有效的菜單建議結果：${suggestedRecipesText}`);
            return;
        }
        recipesDiv.textContent = suggestedRecipesText;

    } catch (error) {
        console.error("API 呼叫失敗:", error);
        showError(`API 呼叫失敗：${error.message}。請檢查您的 API 金鑰和網路連線。`);
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