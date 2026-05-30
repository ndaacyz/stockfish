let isActive = false;

const statusDiv = document.getElementById('status');
const toggleBtn = document.getElementById('toggleBtn');
const analyzeBtn = document.getElementById('analyzeBtn');
const stopBtn = document.getElementById('stopBtn');
const bestMoveDisplay = document.getElementById('bestMoveDisplay');
const bestMoveText = document.getElementById('bestMove');
const evaluationText = document.getElementById('evaluation');
const depthSlider = document.getElementById('depthSlider');
const depthValue = document.getElementById('depthValue');

// Update depth display
depthSlider.addEventListener('input', (e) => {
  depthValue.textContent = e.target.value;
  chrome.storage.local.set({ depth: parseInt(e.target.value) });
});

// Load saved depth
chrome.storage.local.get(['depth'], (result) => {
  if (result.depth) {
    depthSlider.value = result.depth;
    depthValue.textContent = result.depth;
  }
});

// Toggle continuous analysis
toggleBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  isActive = !isActive;
  
  if (isActive) {
    chrome.tabs.sendMessage(tab.id, { 
      action: 'startContinuous',
      depth: parseInt(depthSlider.value)
    });
    statusDiv.textContent = 'Status: Active (Monitoring)';
    statusDiv.className = 'status active';
    toggleBtn.textContent = 'Stop Continuous Analysis';
    toggleBtn.className = 'btn-danger';
    stopBtn.style.display = 'block';
  } else {
    chrome.tabs.sendMessage(tab.id, { action: 'stop' });
    statusDiv.textContent = 'Status: Inactive';
    statusDiv.className = 'status inactive';
    toggleBtn.textContent = 'Start Continuous Analysis';
    toggleBtn.className = 'btn-primary';
    stopBtn.style.display = 'none';
  }
});

// Analyze current position once
analyzeBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  chrome.tabs.sendMessage(tab.id, { 
    action: 'analyzeOnce',
    depth: parseInt(depthSlider.value)
  });
});

// Stop engine
stopBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { action: 'stop' });
  
  isActive = false;
  statusDiv.textContent = 'Status: Inactive';
  statusDiv.className = 'status inactive';
  toggleBtn.textContent = 'Start Continuous Analysis';
  toggleBtn.className = 'btn-primary';
  stopBtn.style.display = 'none';
});

// Listen for analysis results
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'analysisResult') {
    bestMoveDisplay.style.display = 'block';
    bestMoveText.textContent = message.bestMove;
    evaluationText.textContent = `Evaluation: ${message.evaluation}`;
  }
});