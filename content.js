let stockfish = null;
let isAnalyzing = false;
let continuousMode = false;
let currentDepth = 18;

// Initialize Stockfish
function initStockfish() {
  if (stockfish) return;
  
  stockfish = new Worker('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js');
  
  stockfish.onmessage = function(event) {
    const line = event.data;
    
    if (line.includes('bestmove')) {
      const match = line.match(/bestmove (\w+)/);
      if (match) {
        const bestMove = match[1];
        handleBestMove(bestMove);
      }
    }
    
    if (line.includes('score cp')) {
      const match = line.match(/score cp (-?\d+)/);
      if (match) {
        const centipawns = parseInt(match[1]);
        const evaluation = (centipawns / 100).toFixed(2);
        displayEvaluation(evaluation);
      }
    } else if (line.includes('score mate')) {
      const match = line.match(/score mate (-?\d+)/);
      if (match) {
        displayEvaluation(`Mate in ${match[1]}`);
      }
    }
  };
  
  stockfish.postMessage('uci');
  stockfish.postMessage('setoption name Skill Level value 20');
  stockfish.postMessage('isready');
}

// Get current FEN from Chess.com
function getCurrentFEN() {
  try {
    // Method 1: Try to get from window object
    if (window.chessboard && window.chessboard.getFEN) {
      return window.chessboard.getFEN();
    }
    
    // Method 2: Parse from DOM
    const board = document.querySelector('.board');
    if (!board) return null;
    
    // Try to extract from Chess.com's internal state
    const reactInstance = board[Object.keys(board).find(key => key.startsWith('__reactFiber'))];
    if (reactInstance) {
      let node = reactInstance;
      while (node) {
        if (node.memoizedProps && node.memoizedProps.game) {
          const game = node.memoizedProps.game;
          if (game.getFEN) return game.getFEN();
        }
        node = node.return;
      }
    }
    
    // Method 3: Try global chess object
    if (window.game && window.game.getFEN) {
      return window.game.getFEN();
    }
    
    return null;
  } catch (e) {
    console.error('Error getting FEN:', e);
    return null;
  }
}

// Analyze position
function analyzePosition(fen, depth = 18) {
  if (!stockfish) initStockfish();
  
  isAnalyzing = true;
  
  stockfish.postMessage('stop');
  stockfish.postMessage('ucinewgame');
  stockfish.postMessage(`position fen ${fen}`);
  stockfish.postMessage(`go depth ${depth}`);
}

// Handle best move
function handleBestMove(move) {
  isAnalyzing = false;
  
  console.log('Best move:', move);
  
  // Display on page
  displayBestMove(move);
  
  // Highlight the move
  highlightMove(move);
  
  // Send to popup
  chrome.runtime.sendMessage({
    action: 'analysisResult',
    bestMove: move,
    evaluation: lastEvaluation || '0.0'
  });
  
  // If continuous mode, analyze next position after delay
  if (continuousMode) {
    setTimeout(() => {
      const fen = getCurrentFEN();
      if (fen) analyzePosition(fen, currentDepth);
    }, 1000);
  }
}

let lastEvaluation = '0.0';

function displayEvaluation(eval) {
  lastEvaluation = eval;
}

// Display best move on the page
function displayBestMove(move) {
  let overlay = document.getElementById('stockfish-overlay');
  
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'stockfish-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.9);
      color: #81b64c;
      padding: 15px 20px;
      border-radius: 8px;
      font-size: 18px;
      font-weight: bold;
      z-index: 10000;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
      font-family: monospace;
    `;
    document.body.appendChild(overlay);
  }
  
  overlay.innerHTML = `
    <div style="font-size: 12px; opacity: 0.7; margin-bottom: 5px;">BEST MOVE</div>
    <div style="font-size: 24px;">${move}</div>
    <div style="font-size: 14px; margin-top: 5px; opacity: 0.8;">Eval: ${lastEvaluation}</div>
  `;
}

// Highlight move on board
function highlightMove(move) {
  // Remove previous highlights
  document.querySelectorAll('.stockfish-highlight').forEach(el => el.remove());
  
  const from = move.substring(0, 2);
  const to = move.substring(2, 4);
  
  highlightSquare(from, '#ff9800');
  highlightSquare(to, '#4caf50');
}

function highlightSquare(square, color) {
  const fileMap = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8 };
  const file = fileMap[square[0]];
  const rank = parseInt(square[1]);
  
  const squares = document.querySelectorAll('.square-' + square);
  squares.forEach(sq => {
    const highlight = document.createElement('div');
    highlight.className = 'stockfish-highlight';
    highlight.style.cssText = `
      position: absolute;
      width: 100%;
      height: 100%;
      background: ${color};
      opacity: 0.4;
      pointer-events: none;
      z-index: 1;
    `;
    sq.style.position = 'relative';
    sq.appendChild(highlight);
  });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startContinuous') {
    continuousMode = true;
    currentDepth = message.depth || 18;
    const fen = getCurrentFEN();
    if (fen) {
      analyzePosition(fen, currentDepth);
    } else {
      alert('Cannot detect chess position. Make sure you are on a game page.');
    }
  }
  
  if (message.action === 'analyzeOnce') {
    continuousMode = false;
    currentDepth = message.depth || 18;
    const fen = getCurrentFEN();
    if (fen) {
      analyzePosition(fen, currentDepth);
    } else {
      alert('Cannot detect chess position. Make sure you are on a game page.');
    }
  }
  
  if (message.action === 'stop') {
    continuousMode = false;
    if (stockfish) {
      stockfish.postMessage('stop');
    }
    const overlay = document.getElementById('stockfish-overlay');
    if (overlay) overlay.remove();
    document.querySelectorAll('.stockfish-highlight').forEach(el => el.remove());
  }
});

// Auto-initialize when on game page
if (window.location.href.includes('chess.com/game') || 
    window.location.href.includes('chess.com/play')) {
  console.log('Chess.com game detected - Extension ready');
}