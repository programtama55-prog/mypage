document.addEventListener('DOMContentLoaded', () => {
    const board = document.getElementById('board');
    const cols = 8;
    const rows = 5;

    // パネルを生成してボードに追加する
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const panel = document.createElement('div');
            panel.classList.add('panel');
            
            // データ属性として座標を持たせておく（後のルールのために便利）
            panel.dataset.row = r;
            panel.dataset.col = c;
            
            // クリックイベントリスナーの追加
            panel.addEventListener('click', () => {
                // 白黒を反転させる (blackクラスのトグル)
                panel.classList.toggle('black');
            });
            
            board.appendChild(panel);
        }
    }
});
