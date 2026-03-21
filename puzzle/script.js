document.addEventListener('DOMContentLoaded', () => {
    const board = document.getElementById('board');
    const timerElement = document.getElementById('timer');
    const codeDisplay = document.getElementById('code-display');
    const messageElement = document.getElementById('message');
    const startBtn = document.getElementById('start-btn');
    const checkBtn = document.getElementById('check-btn');
    const scoreElement = document.getElementById('score-display');
    const difficultySelect = document.getElementById('difficulty');

    // チュートリアル関連の要素
    const tutorialBtn = document.getElementById('tutorial-btn');
    const tutorialModal = document.getElementById('tutorial-modal');
    const tutorialContent = document.getElementById('tutorial-content');
    const tutorialPrev = document.getElementById('tutorial-prev');
    const tutorialNext = document.getElementById('tutorial-next');
    const tutorialClose = document.getElementById('tutorial-close');
    const tutorialDots = document.getElementById('tutorial-dots');

    const tutorialSteps = [
        {
            text: `
                <p><strong>ようこそ、パズルゲームへ！</strong></p>
                <p>このゲームは、表示された<b>CODE（命令文）</b>の通りにパネルの色を変えるゲームです。</p>
                <p>CODEは <code>{命令:[X1,Y1],[X2,Y2]}</code> の形式で表示されます。<br>
                左と上の数字がそれぞれ <b>X座標(列)</b> と <b>Y座標(行)</b> です。</p>
            `,
            miniBoard: null
        },
        {
            text: `
                <p><strong>コマンド1：black</strong></p>
                <p>指定された範囲のパネルを<b>黒</b>く塗りつぶします。</p>
                <p>例： <code>{black:[2,2],[4,3]}</code></p>
            `,
            miniBoard: {
                type: 'black',
                x1: 2, y1: 2, x2: 4, y2: 3,
                baseState: false // 全て白からスタート
            }
        },
        {
            text: `
                <p><strong>コマンド2：white</strong></p>
                <p>指定された範囲のパネルを<b>白</b>く（元の色に）戻します。</p>
                <p>例： 全体が黒い状態から <code>{white:[2,2],[4,3]}</code> を実行</p>
            `,
            miniBoard: {
                type: 'white',
                x1: 2, y1: 2, x2: 4, y2: 3,
                baseState: true // 全て黒からスタート
            }
        },
        {
            text: `
                <p><strong>コマンド3：invert</strong></p>
                <p>指定された範囲のパネルの白と黒を<b>反転</b>させます。</p>
                <p>例： 市松模様の状態から <code>{invert:[2,2],[4,3]}</code> を実行</p>
            `,
            miniBoard: {
                type: 'invert',
                x1: 2, y1: 2, x2: 4, y2: 3,
                baseState: 'checker' // 市松模様からスタート
            }
        },
        {
            text: `
                <p><strong>操作方法</strong></p>
                <p>パネルはクリックするか、<b>マウスでドラッグ</b>するとなぞった場所の色を連続して変えることができます。</p>
                <p>入力が終わったら「判定」ボタンを押してください。<br>正解するとスコアが加算され、制限時間が少し回復します！</p>
            `,
            miniBoard: null
        }
    ];

    let currentTutorialStep = 0;

    // デフォルト（画面初期表示時）のサイズ
    let cols = 5;
    let rows = 5;
    let maxCommands = 3;

    let expectedStates = [];
    let panelStates = [];
    let timerId = null;
    let timeLeft = 120.0;
    let isPlaying = false;
    let isDragging = false;
    let score = 0;
    let currentLineCount = 0;

    // 画面外でマウスを離してもドラッグ状態を解除する
    document.addEventListener('mouseup', () => {
        isDragging = false;
    });

    function createBoard() {
        board.innerHTML = '';
        // 座標表示用に1行・1列追加
        board.style.gridTemplateColumns = `40px repeat(${cols}, 50px)`;
        board.style.gridTemplateRows = `40px repeat(${rows}, 50px)`;
        panelStates = Array.from({ length: rows }, () => Array(cols).fill(false));

        // (0,0) の空白セル
        const emptyCell = document.createElement('div');
        emptyCell.classList.add('axis-label');
        board.appendChild(emptyCell);

        // X軸（列）のラベル
        for (let c = 0; c < cols; c++) {
            const label = document.createElement('div');
            label.classList.add('axis-label');
            label.textContent = c + 1;
            board.appendChild(label);
        }

        for (let r = 0; r < rows; r++) {
            // Y軸（行）のラベル
            const rowLabel = document.createElement('div');
            rowLabel.classList.add('axis-label');
            rowLabel.textContent = r + 1;
            board.appendChild(rowLabel);

            for (let c = 0; c < cols; c++) {
                const panel = document.createElement('div');
                panel.classList.add('panel');

                panel.dataset.row = r;
                panel.dataset.col = c;
                // panel.textContent = `${c + 1},${r + 1}`; // パネル自体の表示は削除

                const togglePanel = () => {
                    if (!isPlaying) return;

                    panelStates[r][c] = !panelStates[r][c];
                    if (panelStates[r][c]) {
                        panel.classList.add('black');
                    } else {
                        panel.classList.remove('black');
                    }
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

    function compressBoard(state) {
        let covered = Array.from({ length: rows }, () => Array(cols).fill(false));
        let cmds = [];

        function canCover(r1, r2, c1, c2) {
            let hasNew = false;
            for (let r = r1; r <= r2; r++) {
                for (let c = c1; c <= c2; c++) {
                    if (!state[r][c]) return false;
                    if (!covered[r][c]) hasNew = true;
                }
            }
            return hasNew;
        }

        while (true) {
            let bestRect = null;
            let bestScore = 0;

            for (let r1 = 0; r1 < rows; r1++) {
                for (let r2 = r1; r2 < rows; r2++) {
                    for (let c1 = 0; c1 < cols; c1++) {
                        for (let c2 = c1; c2 < cols; c2++) {
                            if (canCover(r1, r2, c1, c2)) {
                                let score = 0;
                                let area = 0;
                                for (let r = r1; r <= r2; r++) {
                                    for (let c = c1; c <= c2; c++) {
                                        if (!covered[r][c]) score++;
                                        area++;
                                    }
                                }
                                if (score > bestScore) {
                                    bestScore = score;
                                    bestRect = { r1, r2, c1, c2, area };
                                } else if (score === bestScore && score > 0) {
                                    if (area > bestRect.area) {
                                        bestRect = { r1, r2, c1, c2, area };
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (!bestRect) break;

            for (let r = bestRect.r1; r <= bestRect.r2; r++) {
                for (let c = bestRect.c1; c <= bestRect.c2; c++) {
                    covered[r][c] = true;
                }
            }

            let x1 = bestRect.c1 + 1;
            let x2 = bestRect.c2 + 1;
            let y1 = bestRect.r1 + 1;
            let y2 = bestRect.r2 + 1;

            cmds.push(`{black:[${x1},${y1}],[${x2},${y2}]}`);
        }
        return cmds;
    }

    function generateCode() {
        let valid = false;
        let bestCmds = [];
        let bestState = null;

        while (!valid) {
            let state = Array.from({ length: rows }, () => Array(cols).fill(false));
            // コマンド数を 2 〜 maxCommands のランダムで決定
            let numCommands = Math.floor(Math.random() * (maxCommands - 1)) + 2;
            let cmds = [];

            for (let i = 0; i < numCommands; i++) {
                let types = ['black', 'white', 'invert'];
                let type = i === 0 ? 'black' : types[Math.floor(Math.random() * types.length)];

                let c1 = Math.floor(Math.random() * cols);
                let c2 = Math.floor(Math.random() * cols);
                if (c1 > c2) [c1, c2] = [c2, c1];

                let r1 = Math.floor(Math.random() * rows);
                let r2 = Math.floor(Math.random() * rows);
                if (r1 > r2) [r1, r2] = [r2, r1];

                let x1 = c1 + 1;
                let x2 = c2 + 1;
                let y1 = r1 + 1;
                let y2 = r2 + 1;

                cmds.push(`{${type}:[${x1},${y1}],[${x2},${y2}]}`);

                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        let x = c + 1;
                        let y = r + 1;
                        if (x >= x1 && x <= x2 && y >= y1 && y <= y2) {
                            if (type === 'black') state[r][c] = true;
                            if (type === 'white') state[r][c] = false;
                            if (type === 'invert') state[r][c] = !state[r][c];
                        }
                    }
                }
            }

            let blackCount = 0;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (state[r][c]) blackCount++;
                }
            }

            if (blackCount >= 4) {
                let greedyCmds = compressBoard(state);
                if (cmds.length <= greedyCmds.length) {
                    bestCmds = cmds;
                    bestState = state;
                    valid = true;
                } else if (greedyCmds.length < cmds.length) {
                    bestCmds = greedyCmds;
                    bestState = state;
                    valid = true;
                }
            }
        }

        expectedStates = bestState;
        currentLineCount = bestCmds.length;
        codeDisplay.innerHTML = bestCmds.join('<br>');
    }

    function startGame() {
        let diff = difficultySelect.value;
        if (diff === 'easy') {
            cols = 4; rows = 4;
            maxCommands = 2;
        } else if (diff === 'hard') {
            cols = 6; rows = 6;
            maxCommands = 4;
        } else if (diff === 'expert') {
            cols = 7; rows = 7;
            maxCommands = 5;
        } else {
            // normal
            cols = 5; rows = 5;
            maxCommands = 3;
        }

        score = 0;
        updateScore();

        if (diff === 'hard' || diff === 'expert') {
            timeLeft = 300.0;
        } else {
            timeLeft = 120.0;
        }
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

        startRound();

        startBtn.style.display = 'none';
        difficultySelect.disabled = true;
        checkBtn.disabled = false;
    }

    function startRound() {
        createBoard();
        generateCode();
        isPlaying = true;
        messageElement.textContent = '';
        messageElement.style.color = '';
    }

    function updateScore() {
        scoreElement.textContent = `SCORE: ${score}`;
    }

    function gameOver() {
        isPlaying = false;
        clearInterval(timerId);
        timerElement.textContent = '0.0';
        messageElement.textContent = 'GAME OVER';
        messageElement.style.color = '#e74c3c';
        startBtn.textContent = 'もう一度プレイ';
        startBtn.style.display = 'inline-block';
        difficultySelect.disabled = false;
        checkBtn.disabled = true;
    }

    function checkClear() {
        if (!isPlaying || !expectedStates || expectedStates.length === 0) return;

        let isCorrect = true;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (panelStates[r][c] !== expectedStates[r][c]) {
                    isCorrect = false;
                    break;
                }
            }
            if (!isCorrect) break;
        }

        if (isCorrect) {
            isPlaying = false;
            if (timerId) clearInterval(timerId); // タイマーを一時停止

            let addedScore = currentLineCount * 100;
            score += addedScore;
            updateScore();
            messageElement.textContent = '+' + addedScore + '!!';
            messageElement.style.color = '#2ecc71';

            setTimeout(() => {
                if (timeLeft > 0) {
                    startRound();

                    // 次のラウンドでタイマーを再開
                    timerId = setInterval(() => {
                        timeLeft -= 0.1;
                        if (timeLeft <= 0) {
                            timeLeft = 0;
                            gameOver();
                        }
                        timerElement.textContent = timeLeft.toFixed(1);
                    }, 100);
                } else {
                    gameOver();
                }
            }, 1000);
        } else {
            messageElement.textContent = 'WRONG!';
            messageElement.style.color = '#e74c3c';
            setTimeout(() => {
                if (isPlaying) messageElement.textContent = '';
            }, 1000);
        }
    }

    checkBtn.addEventListener('click', checkClear);
    startBtn.addEventListener('click', startGame);

    // --- チュートリアル制御 ---
    function createMiniBoard(config) {
        const boardWrapper = document.createElement('div');
        boardWrapper.classList.add('mini-board-wrapper');

        const mCols = 5;
        const mRows = 5;
        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gap = '2px';
        grid.style.backgroundColor = '#ccc';
        grid.style.padding = '4px';
        grid.style.borderRadius = '6px';
        grid.style.margin = '10px auto';
        grid.style.width = 'fit-content';

        // ヘッダー行＋データ行
        grid.style.gridTemplateColumns = `30px repeat(${mCols}, 35px)`;
        grid.style.gridTemplateRows = `30px repeat(${mRows}, 35px)`;

        // (0,0)空白
        const emptyCell = document.createElement('div');
        emptyCell.classList.add('axis-label');
        emptyCell.style.fontSize = '12px';
        grid.appendChild(emptyCell);

        for (let c = 0; c < mCols; c++) {
            const label = document.createElement('div');
            label.classList.add('axis-label');
            label.style.fontSize = '12px';
            label.textContent = c + 1;
            grid.appendChild(label);
        }

        for (let r = 0; r < mRows; r++) {
            const rowLabel = document.createElement('div');
            rowLabel.classList.add('axis-label');
            rowLabel.style.fontSize = '12px';
            rowLabel.textContent = r + 1;
            grid.appendChild(rowLabel);

            for (let c = 0; c < mCols; c++) {
                const panel = document.createElement('div');
                panel.classList.add('panel');
                panel.style.width = '35px';
                panel.style.height = '35px';
                panel.style.cursor = 'default';
                panel.style.pointerEvents = 'none'; // クリック不可

                let isBlack = false;
                if (config.baseState === 'checker') {
                    isBlack = (r + c) % 2 === 0;
                } else {
                    isBlack = config.baseState;
                }

                const cx = c + 1;
                const cy = r + 1;
                const inRange = (cx >= config.x1 && cx <= config.x2 && cy >= config.y1 && cy <= config.y2);

                if (inRange) {
                    if (config.type === 'black') isBlack = true;
                    else if (config.type === 'white') isBlack = false;
                    else if (config.type === 'invert') isBlack = !isBlack;
                }

                if (isBlack) panel.classList.add('black');

                // コマンドの対象範囲をハイライト
                if (inRange) {
                    panel.style.border = '2px solid #e74c3c';
                }

                grid.appendChild(panel);
            }
        }
        boardWrapper.appendChild(grid);
        return boardWrapper;
    }

    function updateTutorial() {
        const step = tutorialSteps[currentTutorialStep];
        tutorialContent.innerHTML = step.text;

        if (step.miniBoard) {
            const miniBoardElement = createMiniBoard(step.miniBoard);
            tutorialContent.appendChild(miniBoardElement);
        }

        // ボタン状態
        tutorialPrev.disabled = currentTutorialStep === 0;

        if (currentTutorialStep === tutorialSteps.length - 1) {
            tutorialNext.textContent = '閉じる';
        } else {
            tutorialNext.textContent = '次へ';
        }

        // ドットの更新
        tutorialDots.innerHTML = '';
        for (let i = 0; i < tutorialSteps.length; i++) {
            const dot = document.createElement('div');
            dot.classList.add('dot');
            if (i === currentTutorialStep) dot.classList.add('active');
            tutorialDots.appendChild(dot);
        }
    }

    function openTutorial() {
        currentTutorialStep = 0;
        updateTutorial();
        tutorialModal.classList.remove('hidden');
    }

    function closeTutorial() {
        tutorialModal.classList.add('hidden');
    }

    tutorialBtn.addEventListener('click', openTutorial);
    tutorialClose.addEventListener('click', closeTutorial);

    tutorialNext.addEventListener('click', () => {
        if (currentTutorialStep < tutorialSteps.length - 1) {
            currentTutorialStep++;
            updateTutorial();
        } else {
            closeTutorial();
        }
    });

    tutorialPrev.addEventListener('click', () => {
        if (currentTutorialStep > 0) {
            currentTutorialStep--;
            updateTutorial();
        }
    });

    // 初期状態のボードを表示
    createBoard();

    // 初回訪問時のみチュートリアル自動表示
    if (!localStorage.getItem('puzzleTutorialSeen')) {
        openTutorial();
        localStorage.setItem('puzzleTutorialSeen', 'true');
    }
});
