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
                <p>このゲームは、表示された<b>CODE（命令文）</b>の通りにパネルを黒く塗りつぶすゲームです。</p>
                <p>制限時間内にできるだけ多くの問題を解きましょう。</p>
            `
        },
        {
            text: `
                <p><strong>CODEの読み方</strong></p>
                <p>CODEは <code>{命令:[X1,Y1],[X2,Y2]}</code> のような形式で表示されます。</p>
                <ul>
                    <li><code>black</code>：指定された範囲を黒にする</li>
                    <li><code>white</code>：指定された範囲を白にする</li>
                    <li><code>invert</code>：指定された範囲の白黒を反転させる</li>
                </ul>
            `
        },
        {
            text: `
                <p><strong>座標（X,Y）について</strong></p>
                <p>画面の左と上に数字が書いてあります。</p>
                <ul>
                    <li>横方向（列）が <b>X座標</b></li>
                    <li>縦方向（行）が <b>Y座標</b></li>
                </ul>
                <p>例：<code>[2,3]</code> は、左から2番目、上から3番目を指します。</p>
            `
        },
        {
            text: `
                <p><strong>コマンドの実行例</strong></p>
                <p>以下の3つのコマンドが実行された例を見てみましょう！</p>
                <div class="demo-code">
                    1. <code>{black:[2,2],[4,4]}</code> (全体を黒く塗る)<br>
                    2. <code>{white:[3,3],[3,3]}</code> (真ん中を白に戻す)<br>
                    3. <code>{invert:[4,2],[4,4]}</code> (右端の1列を反転する)
                </div>
                <!-- デモ用ボードのコンテナ -->
                <div id="tutorial-demo-board-container" class="demo-board-container"></div>
            `,
            onShow: renderDemoBoard
        },
        {
            text: `
                <p><strong>操作方法</strong></p>
                <p>パネルはクリックするか、<b>マウスでドラッグ</b>するとなぞった場所の色を連続して変えることができます。</p>
                <p>入力が終わったら「判定」ボタンを押してください。<br>正解するとスコアが加算され、制限時間が少し回復します！</p>
            `
        }
    ];

    let currentTutorialStep = 0;

    let cols = 7;
    let rows = 7;

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
            let numCommands = Math.floor(Math.random() * 2) + 2;
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
            cols = 5; rows = 5;
        } else if (diff === 'hard') {
            cols = 9; rows = 9;
        } else {
            cols = 7; rows = 7;
        }

        score = 0;
        updateScore();

        timeLeft = 300.0;
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
    function renderDemoBoard() {
        // コンテナの取得（HTMLに含まれてから実行される）
        const container = document.getElementById('tutorial-demo-board-container');
        if (!container) return;

        container.innerHTML = '';

        // デモ用の小さなボード（5x5）を作成
        const d_cols = 5;
        const d_rows = 5;
        container.style.display = 'grid';
        container.style.gap = '4px';
        container.style.gridTemplateColumns = `30px repeat(${d_cols}, 30px)`;
        container.style.gridTemplateRows = `30px repeat(${d_rows}, 30px)`;
        container.style.justifyContent = 'center';
        container.style.margin = '10px 0';

        // 状態の計算 (1.black, 2.white, 3.invert)
        let d_state = Array.from({ length: d_rows }, () => Array(d_cols).fill(false));
        // 1. {black:[2,2],[4,4]}
        for (let r = 1; r <= 3; r++) for (let c = 1; c <= 3; c++) d_state[r][c] = true;
        // 2. {white:[3,3],[3,3]}
        d_state[2][2] = false;
        // 3. {invert:[4,2],[4,4]}
        for (let r = 1; r <= 3; r++) d_state[r][3] = !d_state[r][3];

        // 枠とパネルの描画
        const empty = document.createElement('div');
        empty.classList.add('axis-label');
        empty.style.fontSize = '12px';
        container.appendChild(empty);

        for (let c = 0; c < d_cols; c++) {
            const label = document.createElement('div');
            label.classList.add('axis-label');
            label.textContent = c + 1;
            label.style.fontSize = '12px';
            container.appendChild(label);
        }

        for (let r = 0; r < d_rows; r++) {
            const rowLabel = document.createElement('div');
            rowLabel.classList.add('axis-label');
            rowLabel.textContent = r + 1;
            rowLabel.style.fontSize = '12px';
            container.appendChild(rowLabel);

            for (let c = 0; c < d_cols; c++) {
                const panel = document.createElement('div');
                panel.classList.add('panel');
                panel.style.width = '30px';
                panel.style.height = '30px';
                // デモ用なのでクリックイベントは無し
                if (d_state[r][c]) {
                    panel.classList.add('black');
                }
                container.appendChild(panel);
            }
        }
    }

    function updateTutorial() {
        tutorialContent.innerHTML = tutorialSteps[currentTutorialStep].text;

        // 特定のステップで関数を呼び出す
        if (typeof tutorialSteps[currentTutorialStep].onShow === 'function') {
            tutorialSteps[currentTutorialStep].onShow();
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
