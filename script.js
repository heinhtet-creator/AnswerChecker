// script.js (Final Corrected Version for Module)

import { fullProcessImage } from './scanner.js';

const GRADED_RESULTS_KEY = 'examGraderResults_v5';
const KEY_SETS_KEY = 'examGraderKeySets_v2';
const TUNING_KEY = 'examGraderTuning_v1';

let cvReady = false;
let fileQueue = [];
let currentFileIndex = 0;
let answerKey = [];
let currentScanResult = {};
let originalCanvasImageData = null;

const allSelectors = {
    configScreen: document.getElementById('config-screen'),
    scannerScreen: document.getElementById('scanner-screen'),
    resultsScreen: document.getElementById('results-screen'),
    totalQuestionsInput: document.getElementById('totalQuestionsInput'),
    answersPerQuestionInput: document.getElementById('answersPerQuestionInput'),
    answerKeySectionLabel: document.getElementById('answer-key-section-label'),
    pointsPerQuestionInput: document.getElementById('pointsPerQuestion'),
    answerKeyContainer: document.getElementById('answer-key-container'),
    canvasElement: document.getElementById('output-canvas'),
    statusElement: document.getElementById('status'),
    saveResultContainer: document.getElementById('save-result-container'),
    studentNameInput: document.getElementById('studentName'),
    backToConfigButtonScanner: document.getElementById('backToConfigButtonScanner'),
    startScanButton: document.getElementById('startScanButton'),
    viewResultsButton: document.getElementById('viewResultsButton'),
    backToConfigButton: document.getElementById('backToConfigButton'),
    clearResultsButton: document.getElementById('clearResultsButton'),
    saveResultButton: document.getElementById('saveResultButton'),
    nextImageButton: document.getElementById('nextImageButton'),
    chooseFileButton: document.getElementById('chooseFileButton'),
    fileInput: document.getElementById('fileInput'),
    scanActionsContainer: document.getElementById('scan-actions'),
    savedKeysDropdown: document.getElementById('savedKeysDropdown'),
    loadKeyButton: document.getElementById('loadKeyButton'),
    deleteKeyButton: document.getElementById('deleteKeyButton'),
    newKeyNameInput: document.getElementById('newKeyNameInput'),
    saveNewKeyButton: document.getElementById('saveNewKeyButton'),
    resultsTableBody: document.getElementById('results-table-body'),
    headerRatioSlider: document.getElementById('headerRatioSlider'),
    numberColRatioSlider: document.getElementById('numberColRatioSlider'),
    headerRatioValue: document.getElementById('headerRatioValue'),
    numberColRatioValue: document.getElementById('numberColRatioValue'),
    rowHeightRatioSlider: document.getElementById('rowHeightRatioSlider'),
    rowHeightRatioValue: document.getElementById('rowHeightRatioValue'),
    fillThresholdSlider: document.getElementById('fillThresholdSlider'),
    fillThresholdValue: document.getElementById('fillThresholdValue'),
    confidenceThresholdSlider: document.getElementById('confidenceThresholdSlider'),
    confidenceThresholdValue: document.getElementById('confidenceThresholdValue'),
    strayMarkThresholdSlider: document.getElementById('strayMarkThreshold'),
    strayMarkThresholdValue: document.getElementById('strayMarkThresholdValue'),
    bulkKeyInput: document.getElementById('bulkKeyInput'),
    loadBulkKeyButton: document.getElementById('loadBulkKeyButton'),
    keyPreviewContainer: document.getElementById('key-preview-container'),
    tuningModal: document.getElementById('tuning-modal'),
    openTuningModalButton: document.getElementById('openTuningModalButton'),
    closeTuningModalButton: document.getElementById('closeTuningModalButton'),
    newKeyModal: document.getElementById('new-key-modal'),
    openNewKeyModalButton: document.getElementById('openNewKeyModalButton'),
    closeNewKeyModalButton: document.getElementById('closeNewKeyModalButton'),
    confirmTuningButton: document.getElementById('confirmTuningButton'),
    cancelNewKeyButton: document.getElementById('cancelNewKeyButton')
};

function debounce(func, delay = 250) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}
// script.js



function showScreen(screenId, isBackNavigation = false) {
    const screenElement = document.getElementById(screenId);
    if (!screenElement) return;
    [allSelectors.configScreen, allSelectors.scannerScreen, allSelectors.resultsScreen].forEach(s => s.style.display = 'none');
    screenElement.style.display = 'flex';
    if (!isBackNavigation && history.state?.screen !== screenId) {
        history.pushState({ screen: screenId }, '', `#${screenId}`);
    }
}

function navigateBack() {
    history.back();
}

function displayKeyPreview(keySet) {
    const container = allSelectors.keyPreviewContainer;
    container.innerHTML = '';
    if (!keySet || !keySet.key) {
        return;
    }
    const title = document.createElement('div');
    title.className = 'key-preview-title';
    title.textContent = `Preview: ${keySet.name}`;
    container.appendChild(title);
    const grid = document.createElement('div');
    grid.className = 'key-preview-grid';
    keySet.key.forEach((answer, index) => {
        const item = document.createElement('div');
        item.className = 'key-preview-item';
        item.innerHTML = `<strong>${index + 1}:</strong> ${answer + 1}`;
        grid.appendChild(item);
    });
    container.appendChild(grid);
}

function clearKeyPreview() {
    allSelectors.keyPreviewContainer.innerHTML = '';
}

function loadTuningSettings() {
    const savedTuning = JSON.parse(localStorage.getItem(TUNING_KEY)) || {};
    allSelectors.headerRatioSlider.value = savedTuning.header || 5.5;
    allSelectors.numberColRatioSlider.value = savedTuning.numberCol || 13.0;
    allSelectors.rowHeightRatioSlider.value = savedTuning.rowHeightRatio || 100;
    allSelectors.fillThresholdSlider.value = savedTuning.fillThreshold || 15;
    allSelectors.confidenceThresholdSlider.value = savedTuning.confidenceThreshold || 2.0;
    allSelectors.strayMarkThresholdSlider.value = savedTuning.strayMarkThreshold || 0.1;

    allSelectors.headerRatioValue.textContent = `${allSelectors.headerRatioSlider.value}%`;
    allSelectors.numberColRatioValue.textContent = `${allSelectors.numberColRatioSlider.value}%`;
    allSelectors.rowHeightRatioValue.textContent = `${allSelectors.rowHeightRatioSlider.value}%`;
    allSelectors.fillThresholdValue.textContent = `${allSelectors.fillThresholdSlider.value}%`;
    allSelectors.confidenceThresholdValue.textContent = `${allSelectors.confidenceThresholdSlider.value}x`;
    
    const strayMarkValueElement = allSelectors.strayMarkThresholdValue;
    if (strayMarkValueElement) {
        strayMarkValueElement.textContent = allSelectors.strayMarkThresholdSlider.value;
    }
}

function saveTuningSettings() {
    const tuning = {
        header: allSelectors.headerRatioSlider.value,
        numberCol: allSelectors.numberColRatioSlider.value,
        rowHeightRatio: allSelectors.rowHeightRatioSlider.value,
        fillThreshold: allSelectors.fillThresholdSlider.value,
        confidenceThreshold: allSelectors.confidenceThresholdSlider.value,
        strayMarkThreshold: allSelectors.strayMarkThresholdSlider.value
    };
    localStorage.setItem(TUNING_KEY, JSON.stringify(tuning));
}

function initialProcess() {
    if (!cvReady) return;
    const context = allSelectors.canvasElement.getContext('2d');
    originalCanvasImageData = context.getImageData(0, 0, allSelectors.canvasElement.width, allSelectors.canvasElement.height);

    setTimeout(() => {
        const result = fullProcessImage(allSelectors, answerKey);
        if (result) {
            currentScanResult = result;
        }
    }, 50);
}
// js/script.js

// NEW HELPER FUNCTION to resize images
function getResizedImageCanvas(img, maxWidth = 1500, maxHeight = 1500) {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    let { width, height } = img;

    if (width > height) {
        if (width > maxWidth) {
            height = Math.round(height * (maxWidth / width));
            width = maxWidth;
        }
    } else {
        if (height > maxHeight) {
            width = Math.round(width * (maxHeight / height));
            height = maxHeight;
        }
    }

    tempCanvas.width = width;
    tempCanvas.height = height;
    tempCtx.drawImage(img, 0, 0, width, height);

    return tempCanvas;
}

// js/script.js

function processFileFromQueue(index) {
    if (!fileQueue || index >= fileQueue.length) {
        alert('ဓာတ်ပုံအားလုံးကို စစ်ဆေးပြီးပါပြီ။');
        showScreen('config-screen');
        return
    }
    currentFileIndex = index;
    const file = fileQueue[index];
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = function() {
        allSelectors.statusElement.textContent = `(${index + 1}/${fileQueue.length}) "${file.name}" ကို ပြင်ဆင်နေသည်...`;

        // <<< NEW: Resize the image before drawing to the main canvas >>>
        const resizedCanvas = getResizedImageCanvas(img);

        const context = allSelectors.canvasElement.getContext('2d');
        allSelectors.canvasElement.width = resizedCanvas.width;
        allSelectors.canvasElement.height = resizedCanvas.height;
        // Draw the SMALLER, resized image to the canvas
        context.drawImage(resizedCanvas, 0, 0); 

        URL.revokeObjectURL(img.src);
        // Now process the smaller image
        initialProcess(); 
    };
    img.onerror = function() {
        alert(`"${file.name}" ကို ဖွင့်ရာတွင် အမှားအယွင်းဖြစ်သွားပါသည်။ နောက်တစ်ပုံသို့ ကျော်သွားပါမည်။`);
        URL.revokeObjectURL(img.src);
        currentFileIndex++;
        processFileFromQueue(currentFileIndex)
    };
    img.src = url
}


function handleMultipleFileSelect(event) {
    const files = event.target.files;
    if (!files || files.length === 0) {
        return;
    }
    fileQueue = Array.from(files);
    processFileFromQueue(0);
    allSelectors.fileInput.value = null;
}

function displayResults() {
    const results = JSON.parse(localStorage.getItem(GRADED_RESULTS_KEY)) || [];
    const tableBody = allSelectors.resultsTableBody;
    tableBody.innerHTML = '';
    if (results.length === 0) {
        const row = tableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 4;
        cell.style.textAlign = 'center';
        cell.textContent = 'သိမ်းဆည်းထားသော ရလဒ်များ မရှိသေးပါ။';
    } else {
        results.forEach((result, index) => {
            const row = tableBody.insertRow();
            let cell1 = row.insertCell();
            cell1.textContent = result.name;
            cell1.setAttribute('data-label', 'အမည်');
            let cell2 = row.insertCell();
            cell2.textContent = `${result.score} / ${result.total}`;
            cell2.setAttribute('data-label', 'ရမှတ်');
            let cell3 = row.insertCell();
            cell3.textContent = new Date(result.date).toLocaleDateString();
            cell3.setAttribute('data-label', 'ရက်စွဲ');
            const actionCell = row.insertCell();
            actionCell.setAttribute('data-label', 'လုပ်ဆောင်ချက်');
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'ဖျက်မည်';
            deleteBtn.className = 'small-danger-button';
            deleteBtn.onclick = () => deleteSingleResult(index);
            actionCell.appendChild(deleteBtn);
        });
    }
    showScreen('results-screen');
}

function deleteSingleResult(index) {
    let results = JSON.parse(localStorage.getItem(GRADED_RESULTS_KEY)) || [];
    const resultToDelete = results[index];
    if (confirm(`"${resultToDelete.name}" ၏ ရလဒ်ကို အမှန်တကယ် ဖျက်လိုပါသလား။`)) {
        results.splice(index, 1);
        localStorage.setItem(GRADED_RESULTS_KEY, JSON.stringify(results));
        displayResults()
    }
}

function clearResults() {
    if (confirm('သိမ်းဆည်းထားသော ရလဒ်အားလုံးကို အမှန်တကယ် ဖျက်လိုပါသလား။')) {
        localStorage.removeItem(GRADED_RESULTS_KEY);
        displayResults()
    }
}

function saveCurrentResult() {
    const name = allSelectors.studentNameInput.value.trim();
    if (!name) {
        alert('ကျေးဇူးပြု၍ အမည်ထည့်ပါ။');
        return
    }
    let results = JSON.parse(localStorage.getItem(GRADED_RESULTS_KEY)) || [];
    results.unshift({
        name,
        ...currentScanResult,
        date: new Date().toISOString()
    });
    localStorage.setItem(GRADED_RESULTS_KEY, JSON.stringify(results));
    alert(`"${name}" ၏ ရလဒ်ကို သိမ်းဆည်းပြီးပါပြီ။`);
    currentFileIndex++;
    processFileFromQueue(currentFileIndex)
}

function populateSavedKeysDropdown() {
    const keySets = JSON.parse(localStorage.getItem(KEY_SETS_KEY)) || [];
    allSelectors.savedKeysDropdown.innerHTML = '<option value="">-- အဖြေမှန် ရွေးပါ --</option>';
    keySets.forEach((keySet, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = keySet.name;
        allSelectors.savedKeysDropdown.appendChild(option)
    })
}

function saveNewKey() {
    const name = allSelectors.newKeyNameInput.value.trim();
    if (!name) {
        alert('ကျေးဇူးပြု၍ အဖြေမှန်အတွက် အမည်တစ်ခုထည့်ပါ။');
        return;
    }
    const totalQuestions = parseInt(allSelectors.totalQuestionsInput.value);
    let currentKey = [];
    for (let i = 0; i < totalQuestions; i++) {
        const row = document.getElementById(`answer_row_${i}`);
        currentKey.push(parseInt(row.dataset.answer));
    }
    if (currentKey.includes(-1)) {
        alert("ကျေးဇူးပြု၍ မေးခွန်းအားလုံးအတွက် အဖြေမှန်ကို ရွေးချယ်ပါ။");
        return;
    }
    const newKeySet = {
        name: name,
        points: parseFloat(allSelectors.pointsPerQuestionInput.value),
        key: currentKey,
        totalQuestions: totalQuestions,
        answersPerQuestion: parseInt(allSelectors.answersPerQuestionInput.value)
    };
    let keySets = JSON.parse(localStorage.getItem(KEY_SETS_KEY)) || [];
    const existingIndex = keySets.findIndex(k => k.name === name);
    if (existingIndex > -1) {
        if (confirm(`"${name}" အမည်ဖြင့် အဖြေမှန်တစ်ခု ရှိပြီးသားဖြစ်သည်။ အပေါ်မှထပ်ရေးသိမ်းဆည်းမလား။`)) {
            keySets[existingIndex] = newKeySet;
        } else {
            return;
        }
    } else {
        keySets.push(newKeySet);
    }
    localStorage.setItem(KEY_SETS_KEY, JSON.stringify(keySets));
    alert(`"${name}" အဖြေမှန်ကို သိမ်းဆည်းပြီးပါပြီ။`);
    allSelectors.newKeyNameInput.value = '';
    populateSavedKeysDropdown();
    allSelectors.newKeyModal.style.display = 'none';
}

function loadSelectedKey() {
    const selectedIndex = allSelectors.savedKeysDropdown.value;
    clearKeyPreview();
    if (selectedIndex === "") {
        return;
    }
    const keySets = JSON.parse(localStorage.getItem(KEY_SETS_KEY)) || [];
    const selectedKeySet = keySets[selectedIndex];
    if (selectedKeySet) {
        allSelectors.totalQuestionsInput.value = selectedKeySet.totalQuestions || 40;
        allSelectors.answersPerQuestionInput.value = selectedKeySet.answersPerQuestion || 4;
        allSelectors.pointsPerQuestionInput.value = selectedKeySet.points;
        generateAnswerKeyInputs();
        for (let i = 0; i < selectedKeySet.totalQuestions; i++) {
            const row = document.getElementById(`answer_row_${i}`);
            const answer = selectedKeySet.key[i];
            if (row && answer > -1) {
                row.dataset.answer = answer;
                const button = row.querySelector(`.choice-button[data-value="${answer}"]`);
                if (button) {
                    button.classList.add('selected');
                }
            }
        }
        alert(`"${selectedKeySet.name}" အဖြေမှန်ကို ဖွင့်ပြီးပါပြီ။`);
        displayKeyPreview(selectedKeySet);
    }
}

function deleteSelectedKey() {
    const selectedIndex = allSelectors.savedKeysDropdown.value;
    if (selectedIndex === "") {
        alert('ကျေးဇူးပြု၍ ဖျက်ရန် အဖြေမှန်ကို ရွေးပါ။');
        return;
    }
    let keySets = JSON.parse(localStorage.getItem(KEY_SETS_KEY)) || [];
    const keyNameToDelete = keySets[selectedIndex].name;
    if (confirm(`"${keyNameToDelete}" အဖြေမှန်ကို အမှန်တကယ် ဖျက်လိုပါသလား။`)) {
        keySets.splice(selectedIndex, 1);
        localStorage.setItem(KEY_SETS_KEY, JSON.stringify(keySets));
        alert(`"${keyNameToDelete}" အဖြေမှန်ကို ဖျက်ပြီးပါပြီ။`);
        populateSavedKeysDropdown();
        clearKeyPreview();
    }
}

function generateAnswerKeyInputs() {
    const totalQuestions = parseInt(allSelectors.totalQuestionsInput.value) || 0;
    const answersPerQuestion = parseInt(allSelectors.answersPerQuestionInput.value) || 0;
    allSelectors.answerKeySectionLabel.textContent = `အဖြေမှန်များ (မေးခွန်း ${totalQuestions}၊ အဖြေ ${answersPerQuestion} ခု)`;
    allSelectors.answerKeyContainer.innerHTML = '';
    if (totalQuestions <= 0 || answersPerQuestion <= 0) return;
    for (let i = 0; i < totalQuestions; i++) {
        const row = document.createElement('div');
        row.className = 'answer-key-row';
        row.id = `answer_row_${i}`;
        row.dataset.answer = "-1";
        const label = document.createElement('span');
        label.className = 'answer-key-label';
        label.textContent = `မေးခွန်း ${i+1}`;
        const choicesDiv = document.createElement('div');
        choicesDiv.className = 'answer-key-choices';
        for (let j = 0; j < answersPerQuestion; j++) {
            const button = document.createElement('button');
            button.className = 'choice-button';
            button.textContent = j + 1;
            button.dataset.value = j;
            button.addEventListener('click', e => {
                e.target.parentElement.querySelectorAll('.choice-button').forEach(btn => btn.classList.remove('selected'));
                e.target.classList.add('selected');
                row.dataset.answer = e.target.dataset.value
            });
            choicesDiv.appendChild(button)
        }
        row.appendChild(label);
        row.appendChild(choicesDiv);
        allSelectors.answerKeyContainer.appendChild(row)
    }
}

function startScanning() {
    const totalQuestions = parseInt(allSelectors.totalQuestionsInput.value);
    answerKey = [];
    for (let i = 0; i < totalQuestions; i++) {
        const row = document.getElementById(`answer_row_${i}`);
        answerKey.push(parseInt(row.dataset.answer))
    }
    if (answerKey.includes(-1)) {
        alert("ကျေးဇူးပြု၍ မေးခွန်းအားလုံးအတွက် အဖြေမှန်ကို ရွေးချယ်ပြီးမှ Scan ဖတ်ပါ။");
        return
    }
    const pointsPerQuestion = parseFloat(allSelectors.pointsPerQuestionInput.value);
    if (answerKey.length !== totalQuestions || !pointsPerQuestion || pointsPerQuestion <= 0) {
        alert("Configuration တွင် အမှားအယွင်းရှိနေပါသည်။");
        return
    }
    if (totalQuestions % 2 !== 0) {
        alert("ကျေးဇူးပြု၍ မေးခွန်းစုစုပေါင်းကို စုံဂဏန်းတစ်ခု သတ်မှတ်ပါ။");
        return
    }
    showScreen('scanner-screen');
    resetScannerView()
}

// THIS FUNCTION IS NOW MADE GLOBAL FOR HTML `onload` ATTRIBUTE
function onOpenCvReady() {
    cvReady = true
}
window.onOpenCvReady = onOpenCvReady;


function resetScannerView() {
    originalCanvasImageData = null;
    allSelectors.statusElement.textContent = "နောက်တစ်စောင် စစ်ရန် အသင့်။ ပုံဖိုင်ရွေးပါ။";
    allSelectors.saveResultContainer.style.display = 'none';
    allSelectors.openTuningModalButton.style.display = 'none';
    allSelectors.studentNameInput.value = '';
    allSelectors.saveResultButton.disabled = false;
    allSelectors.saveResultButton.textContent = "ရလဒ် သိမ်းမည်";
    allSelectors.scanActionsContainer.style.display = 'flex';
    const context = allSelectors.canvasElement.getContext('2d');
    context.clearRect(0, 0, allSelectors.canvasElement.width, allSelectors.canvasElement.height);
}

// normalStartup function ကို ဒီလိုပြင်ပါ
// 1. `normalStartup` function
function normalStartup() {
    if (localStorage.getItem('isActivated') === 'true') {
        generateAnswerKeyInputs();
        populateSavedKeysDropdown();
        loadTuningSettings();
        history.replaceState({ screen: 'config-screen' }, '', '#config-screen');
        showScreen('config-screen', true);
    } else {
        document.getElementById('activation-screen').style.display = 'flex';
        loadActivationHint();
    }
}
// 2. `loadActivationHint` function အသစ်
async function loadActivationHint() {
    const hintContainer = document.getElementById('hint-container');
    const hintCodeElement = document.getElementById('hint-code');
    const pinInput = document.getElementById('pin-input');
    const activateButton = document.getElementById('activate-button');
    hintCodeElement.textContent = 'Hint ရယူနေသည်...';
    hintContainer.style.display = 'block';
    pinInput.disabled = true;
    activateButton.disabled = true;
    try {
        const response = await fetch('/.netlify/functions/get-hint');
        const data = await response.json();
        if (response.ok) {
            hintCodeElement.textContent = data.hint;
            pinInput.disabled = false;
            activateButton.disabled = false;
        } else {
            hintCodeElement.textContent = data.message || 'Error';
        }
    } catch (error) {
        hintCodeElement.textContent = 'Hint ရယူ၍ မရပါ။';
    }
}

function setupAccordions() {
    const allHeaders = document.querySelectorAll('.accordion-header');
    allHeaders.forEach(header => {
        header.addEventListener('click', function() {
            this.classList.toggle('active');
            const panel = this.nextElementSibling;
            if (panel.style.maxHeight) {
                panel.style.maxHeight = null;
            } else {
                panel.style.maxHeight = panel.scrollHeight + 'px';
            }
        });
    });
    const defaultOpenHeader = document.querySelector('.accordion-header.active');
    if (defaultOpenHeader) {
        const defaultOpenPanel = defaultOpenHeader.nextElementSibling;
        if (!defaultOpenPanel.style.maxHeight) {
            defaultOpenPanel.style.maxHeight = defaultOpenPanel.scrollHeight + 'px';
        }
    }
}

window.onload = () => {
    normalStartup();
    setupAccordions();
};

window.addEventListener('popstate', (event) => {
    if (event.state && event.state.screen) {
        showScreen(event.state.screen, true);
    }
});

const debouncedProcess = debounce(() => {
    if (originalCanvasImageData) {
        const context = allSelectors.canvasElement.getContext('2d');
        allSelectors.canvasElement.width = originalCanvasImageData.width;
        allSelectors.canvasElement.height = originalCanvasImageData.height;
        context.putImageData(originalCanvasImageData, 0, 0);

        const result = fullProcessImage(allSelectors, answerKey);
        if (result) {
            currentScanResult = result;
        }
    }
}, 300);

// --- Event Listeners ---
allSelectors.totalQuestionsInput.addEventListener('input', generateAnswerKeyInputs);
allSelectors.answersPerQuestionInput.addEventListener('input', generateAnswerKeyInputs);
allSelectors.startScanButton.addEventListener('click', startScanning);
allSelectors.viewResultsButton.addEventListener('click', displayResults);
allSelectors.clearResultsButton.addEventListener('click', clearResults);
allSelectors.saveResultButton.addEventListener('click', saveCurrentResult);
allSelectors.nextImageButton.addEventListener('click', () => {
    currentFileIndex++;
    processFileFromQueue(currentFileIndex);
});
allSelectors.saveNewKeyButton.addEventListener('click', saveNewKey);
allSelectors.loadKeyButton.addEventListener('click', loadSelectedKey);
allSelectors.deleteKeyButton.addEventListener('click', deleteSelectedKey);
allSelectors.backToConfigButton.addEventListener('click', navigateBack);
allSelectors.backToConfigButtonScanner.addEventListener('click', navigateBack);
allSelectors.chooseFileButton.addEventListener('click', () => allSelectors.fileInput.click());
allSelectors.fileInput.addEventListener('change', handleMultipleFileSelect);

allSelectors.headerRatioSlider.addEventListener('input', (e) => {
    allSelectors.headerRatioValue.textContent = `${parseFloat(e.target.value).toFixed(1)}%`;
    saveTuningSettings();
    debouncedProcess();
});
allSelectors.numberColRatioSlider.addEventListener('input', (e) => {
    allSelectors.numberColRatioValue.textContent = `${parseFloat(e.target.value).toFixed(1)}%`;
    saveTuningSettings();
    debouncedProcess();
});
allSelectors.rowHeightRatioSlider.addEventListener('input', (e) => {
    allSelectors.rowHeightRatioValue.textContent = `${e.target.value}%`;
    saveTuningSettings();
    debouncedProcess();
});
allSelectors.fillThresholdSlider.addEventListener('input', (e) => {
    allSelectors.fillThresholdValue.textContent = `${e.target.value}%`;
    saveTuningSettings();
    debouncedProcess();
});
allSelectors.confidenceThresholdSlider.addEventListener('input', (e) => {
    allSelectors.confidenceThresholdValue.textContent = `${parseFloat(e.target.value).toFixed(1)}x`;
    saveTuningSettings();
    debouncedProcess();
});
allSelectors.strayMarkThresholdSlider.addEventListener('input', (e) => {
    const strayMarkValueElement = allSelectors.strayMarkThresholdValue;
    if (strayMarkValueElement) {
        strayMarkValueElement.textContent = parseFloat(e.target.value).toFixed(2);
    }
    saveTuningSettings();
    debouncedProcess();
});


allSelectors.openTuningModalButton.addEventListener('click', () => {
    allSelectors.tuningModal.style.display = 'flex';
});
allSelectors.closeTuningModalButton.addEventListener('click', () => {
    allSelectors.tuningModal.style.display = 'none';
});
allSelectors.confirmTuningButton.addEventListener('click', () => {
    allSelectors.tuningModal.style.display = 'none';
});
allSelectors.tuningModal.addEventListener('click', (e) => {
    if (e.target.matches('.adjust-btn')) {
        const targetSliderId = e.target.dataset.target;
        const action = e.target.dataset.action;
        const slider = document.getElementById(targetSliderId);
        if (slider) {
            const step = parseFloat(slider.step);
            let currentValue = parseFloat(slider.value);
            if (action === 'increment') {
                currentValue += step;
            } else if (action === 'decrement') {
                currentValue -= step;
            }
            const min = parseFloat(slider.min);
            const max = parseFloat(slider.max);
            if (currentValue < min) currentValue = min;
            if (currentValue > max) currentValue = max;
            slider.value = currentValue;
            slider.dispatchEvent(new Event('input', {
                bubbles: true
            }));
        }
    }
    if (e.target === allSelectors.tuningModal) {
        allSelectors.tuningModal.style.display = 'none';
    }
});

allSelectors.openNewKeyModalButton.addEventListener('click', () => {
    allSelectors.newKeyModal.style.display = 'flex';
});
allSelectors.closeNewKeyModalButton.addEventListener('click', () => {
    allSelectors.newKeyModal.style.display = 'none';
});
allSelectors.cancelNewKeyButton.addEventListener('click', () => {
    allSelectors.newKeyModal.style.display = 'none';
});
allSelectors.newKeyModal.addEventListener('click', (e) => {
    if (e.target === allSelectors.newKeyModal) {
        allSelectors.newKeyModal.style.display = 'none';
    }
});

// script.js (at the end with other event listeners)
// 3. `activateButton` ရဲ့ Event Listener
const activateButton = document.getElementById('activate-button');
const pinInput = document.getElementById('pin-input');
const activationError = document.getElementById('activation-error');
activateButton.addEventListener('click', async () => {
    const pin = pinInput.value.trim();
    if (!pin) {
        activationError.textContent = 'PIN နံပါတ် ထည့်ပေးပါ။';
        return;
    }
    activateButton.textContent = 'စစ်ဆေးနေသည်...';
    activateButton.disabled = true;
    activationError.textContent = '';
    try {
        const response = await fetch('/.netlify/functions/activate', {
            method: 'POST',
            body: JSON.stringify({ pin: pin })
        });
        const data = await response.json();
        if (response.ok && data.success) {
            localStorage.setItem('isActivated', 'true');
            alert(data.message || 'Activate လုပ်ခြင်း အောင်မြင်ပါသည်။');
            window.location.reload();
        } else {
            activationError.textContent = data.message || 'Activate PIN မမှန်ပါ။';
        }
    } catch (error) {
        activationError.textContent = 'Error ဖြစ်နေပါသည်။ နောက်မှ ပြန်ကြိုးစားပါ။';
    } finally {
        activateButton.textContent = 'Activate လုပ်မည်';
        activateButton.disabled = false;
    }
});

allSelectors.loadBulkKeyButton.addEventListener('click', () => {
    const totalQuestions = parseInt(allSelectors.totalQuestionsInput.value);
    const answersPerQuestion = parseInt(allSelectors.answersPerQuestionInput.value);
    const text = allSelectors.bulkKeyInput.value.trim();
    if (text.length !== totalQuestions) {
        alert(`အဖြေ ${totalQuestions} ခု လိုအပ်ပါသည်။ သင် ${text.length} ခုသာ ထည့်ထားပါသည်။`);
        return
    }
    for (let i = 0; i < text.length; i++) {
        const answer = parseInt(text[i]) - 1;
        if (isNaN(answer) || answer < 0 || answer >= answersPerQuestion) {
            alert(`နေရာ ${i + 1} တွင် မှားယွင်းသော အဖြေ "${text[i]}" ကိုတွေ့ရှိပါသည်။`);
            return
        }
        const row = document.getElementById(`answer_row_${i}`);
        if (row) {
            row.querySelectorAll('.choice-button').forEach(btn => btn.classList.remove('selected'));
            const buttonToSelect = row.querySelector(`.choice-button[data-value="${answer}"]`);
            if (buttonToSelect) {
                buttonToSelect.classList.add('selected');
                row.dataset.answer = answer
            }
        }
    }
    allSelectors.bulkKeyInput.value = '';
    alert('အဖြေများကို အောင်မြင်စွာ ဖြည့်ပြီးပါပြီ။')
});
// Add this to the end of script.js

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch(err => {
        console.log('ServiceWorker registration failed: ', err);
      });
  });
}
