document.addEventListener('DOMContentLoaded', () => {
    const board = document.getElementById('board');
    const timerElement = document.getElementById('timer');
    const codeDisplay = document.getElementById('code-display');
    const messageElement = document.getElementById('message');
    const startBtn = document.getElementById('start-btn');

    const cols = 7;
    const rows = 7;

    let targetCode = [];
    let panelStates = [];
    let timerId = null;
    let timeLeft = 120.0;
    let isPlaying = false;
    let isDragging = false;

    // 画面外でマウスを離してもドラッグ状態を解除する
    document.addEventListener('mouseup', () => {
        isDragging = false;
    });

    function createBoard() {
        board.innerHTML = '';
        panelStates = Array.from({ length: rows }, () => Array(cols).fill(false));

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const panel = document.createElement('div');
                panel.classList.add('panel');

                panel.dataset.row = r;
                panel.dataset.col = c;

                const togglePanel = () => {
                    if (!isPlaying) return;

                    panelStates[r][c] = !panelStates[r][c];
                    if (panelStates[r][c]) {
                        panel.classList.add('black');
                    } else {
                        panel.classList.remove('black');
                    }

                    checkClear();
                };

                panel.addEventListener('mousedown', (e) => {
                    e.preventDefault(); // デフォルトのドラッグ動作を防ぐ
                    isDragging = true;
                    togglePanel();
                });

                panel.addEventListener('mouseenter', () => {
                    if (isDragging) {
                        togglePanel();
                    }
                });

                board.appendChild(panel);
            }
        }
    }

    function generateCode() {
        targetCode = [];
        let displayStr = '';
        for (let r = 0; r < rows; r++) {
            const val = Math.floor(Math.random() * 128);
            targetCode.push(val);
            const hex = val.toString(16).toUpperCase().padStart(2, '0');
            displayStr += (r > 0 ? ' : ' : '') + hex;
        }
        codeDisplay.textContent = `CODE: ${displayStr}`;
    }

    function startGame() {
        createBoard();
        generateCode();
        timeLeft = 120.0;
        isPlaying = true;
        messageElement.textContent = '';
        startBtn.style.display = 'none';

        if (timerId) clearInterval(timerId);
        timerElement.textContent = timeLeft.toFixed(1);

        timerId = setInterval(() => {
            timeLeft -= 0.1;
            if (timeLeft <= 0) {
                timeLeft = 0;
                gameOver();
            }
            timerElement.textContent = timeLeft.toFixed(1);
        }, 100);
    }

    function gameOver() {
        isPlaying = false;
        clearInterval(timerId);
        timerElement.textContent = '0.0';
        messageElement.textContent = 'GAME OVER';
        messageElement.style.color = '#e74c3c';
        startBtn.textContent = 'もう一度プレイ';
        startBtn.style.display = 'inline-block';
    }

    function checkClear() {
        for (let r = 0; r < rows; r++) {
            let rowValue = 0;
            for (let c = 0; c < cols; c++) {
                if (panelStates[r][c]) {
                    rowValue += (1 << (6 - c));
                }
            }
            if (rowValue !== targetCode[r]) {
                return;
            }
        }

        gameClear();
    }

    function gameClear() {
        isPlaying = false;
        clearInterval(timerId);
        messageElement.textContent = 'CLEAR!';
        messageElement.style.color = '#2ecc71';
        startBtn.textContent = 'もう一度プレイ';
        startBtn.style.display = 'inline-block';
    }

    startBtn.addEventListener('click', startGame);

    // 初期状態のボードを表示
    createBoard();
});
