const stage = document.getElementById('game-stage');
const player = document.getElementById('player');
const scoreDisplay = document.getElementById('score');
const hudHiScoreDisplay = document.getElementById('hud-hi-score');
const lifeDisplay = document.getElementById('life');
const overlay = document.getElementById('overlay');
const gameTitle = document.getElementById('game-title');
const startBtn = document.getElementById('start-btn');
const attackBtn = document.getElementById('attack-btn');
const explosion = document.getElementById('explosion');
const pauseBtn = document.getElementById('pause-btn');

// ポップアップ・リザルト要素
const resultContainer = document.getElementById('result-container');
const gameoverScores = document.getElementById('gameover-scores');
const topHiScoreWrap = document.getElementById('top-hi-score-wrap');
const resScore = document.getElementById('res-score');
const resHiScore = document.getElementById('res-hi-score');
const menuSettings = document.getElementById('menu-settings');
const btnSetLeft = document.getElementById('btn-set-left');
const btnSetRight = document.getElementById('btn-set-right');

const howToModal = document.getElementById('how-to-modal');
const howToOpenBtn = document.getElementById('how-to-open-btn');
const howToCloseBtn = document.getElementById('how-to-close-btn');

let isPlaying = false;
let isPaused = false; // ⏸️ 一時停止中フラグ
let score = 0;
let hiScore = 0;
let life = 3;
let isInvincible = false;
let animationFrameId;
let spawnTimeoutId;
let pauseStartTime = 0; // ポーズ延長タイマー計算用
let nextSpawnDelay = 0; // 次の敵が出るまでの残り時間退避

let playerY = 0;
let velocityY = 0;
const gravity = 0.36;
const firstJumpPower = 7.6;  
const secondJumpPower = 8.2; 
let jumpCount = 0;

let obstacles = [];
let elecBalls = [];
let gameSpeed = 3.5;

// ⚙️ 初期ロード
window.addEventListener('DOMContentLoaded', () => {
    try {
        hiScore = parseInt(localStorage.getItem('marumine_hiscore')) || 0;
    } catch(e) { hiScore = 0; }
    resHiScore.textContent = hiScore;
    hudHiScoreDisplay.textContent = hiScore;
    
    let savedPos = 'right';
    try {
        savedPos = localStorage.getItem('marumine_btn_pos') || 'right';
    } catch(e) {}
    applyButtonPosition(savedPos);
});

function applyButtonPosition(position) {
    if (position === 'left') {
        attackBtn.className = 'pos-top-left';
        btnSetLeft.classList.add('active');
        btnSetRight.classList.remove('active');
    } else {
        attackBtn.className = 'pos-top-right';
        btnSetRight.classList.add('active');
        btnSetLeft.classList.remove('active');
    }
    try {
        localStorage.setItem('marumine_btn_pos', position);
    } catch(e) {}
}

btnSetLeft.addEventListener('click', () => applyButtonPosition('left'));
btnSetRight.addEventListener('click', () => applyButtonPosition('right'));

// 遊び方モーダルの制御
howToOpenBtn.addEventListener('click', () => howToModal.style.display = 'flex');
howToCloseBtn.addEventListener('click', () => howToModal.style.display = 'none');

startBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (startBtn.textContent === "BACK TO TOP") {
        showTopMenu();
    } else {
        initGame();
    }
});

function showTopMenu() {
    gameTitle.textContent = "マルマインのゴロゴロ大作戦";
    gameoverScores.style.display = 'none'; // リザルトスコアを隠す
    topHiScoreWrap.style.display = 'block'; // 起動用ハイスコアに戻す
    menuSettings.style.display = 'block';
    startBtn.textContent = "START";
}

attackBtn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (!isPlaying || isPaused) return; // 一時停止中は打てない
    fireElecBall();
});

// ⏸️ 一時停止（ポーズ）の切り替え処理
pauseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!isPlaying) return;

    if (!isPaused) {
        // ポーズにする
        isPaused = true;
        pauseBtn.textContent = "▶️"; // 再生マークに変える
        player.style.animationPlayState = 'paused'; // 回転を止める
        cancelAnimationFrame(animationFrameId);
    } else {
        // 再開する
        isPaused = false;
        pauseBtn.textContent = "⏸️";
        player.style.animationPlayState = 'running'; // 回転再開
        gameLoop(); // ループ復帰
    }
});

window.addEventListener('pointerdown', (e) => {
    if (!isPlaying || isPaused || e.target === startBtn || e.target === attackBtn || e.target === btnSetLeft || e.target === btnSetRight || e.target === pauseBtn) return;

    if (jumpCount === 0) {
        velocityY = firstJumpPower;
        jumpCount++;
    } else if (jumpCount === 1) {
        velocityY = secondJumpPower;
        jumpCount++;
    }
});

function initGame() {
    isPlaying = true;
    isPaused = false;
    score = 0;
    life = 3;
    gameSpeed = 3.5;
    playerY = 0;
    velocityY = 0;
    jumpCount = 0;
    isInvincible = false;
    
    scoreDisplay.textContent = score;
    hudHiScoreDisplay.textContent = hiScore;
    updateLifeDisplay();
    overlay.style.display = 'none';
    explosion.classList.remove('boom');
    player.style.display = 'block';
    
    player.style.animationDuration = '0.9s';
    player.style.animationPlayState = 'running';
    player.classList.add('rolling');
    player.classList.remove('invincible');
    pauseBtn.textContent = "⏸️";

    obstacles.forEach(obs => obs.element.remove());
    obstacles = [];
    elecBalls.forEach(ball => ball.element.remove());
    elecBalls = [];

    gameLoop();
    
    // 最初の敵出現タイマーをセット（次回以降はミリ秒を記録管理）
    nextSpawnDelay = 2000;
    pauseStartTime = Date.now();
    spawnTimeoutId = setTimeout(spawnObstaclePattern, nextSpawnDelay);
}

function fireElecBall() {
    if (elecBalls.length > 0) return;

    const ballEl = document.createElement('div');
    ballEl.classList.add('elec-ball');
    stage.appendChild(ballEl);

    const playerRect = player.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const startLeft = playerRect.right - stageRect.left;
    const startBottom = playerY + 12;

    ballEl.style.left = startLeft + 'px';
    ballEl.style.bottom = startBottom + 'px';

    elecBalls.push({
        element: ballEl,
        x: startLeft,
        y: startBottom
    });
}

function spawnObstaclePattern() {
    if (!isPlaying) return;
    if (isPaused) return; // ポーズ中は敵を生成しない

    const pattern = Math.floor(Math.random() * 4);
    const stageWidth = stage.clientWidth;
    const patternId = Date.now(); 

    if (pattern === 0) {
        createObstacleElement(stageWidth, 'obs-top', false, patternId);
        createObstacleElement(stageWidth, 'obs-middle', false, patternId);
    } else if (pattern === 1) {
        createObstacleElement(stageWidth, 'obs-top', false, patternId);
        createObstacleElement(stageWidth, 'obs-bottom', false, patternId);
    } else if (pattern === 2) {
        createObstacleElement(stageWidth, 'obs-middle', false, patternId);
        createObstacleElement(stageWidth, 'obs-bottom', false, patternId);
    } else if (pattern === 3) {
        createObstacleElement(stageWidth, 'obs-top', true, patternId);
        createObstacleElement(stageWidth, 'obs-middle', true, patternId);
        createObstacleElement(stageWidth, 'obs-bottom', true, patternId);
    }

    // 次の出現までの時間を計算して、ポーズ復帰用に変数へキープしておく
    const baseTime = 2000 + Math.random() * 1200;
    nextSpawnDelay = baseTime / (gameSpeed * 0.25);
    pauseStartTime = Date.now();
    
    spawnTimeoutId = setTimeout(spawnObstaclePattern, nextSpawnDelay);
}

// ⏸️【追加ロジック】ポーズボタンが押された時に、タイマーの経過時間を保護・再計算する
pauseBtn.addEventListener('click', () => {
    if (!isPlaying) return;
    
    if (isPaused) {
        // ポーズ開始：タイマーを止め、あと何ミリ秒後に生まれる予定だったかを残す
        clearTimeout(spawnTimeoutId);
        const elapsed = Date.now() - pauseStartTime;
        nextSpawnDelay = Math.max(0, nextSpawnDelay - elapsed);
    } else {
        // ポーズ解除：残っていたミリ秒数でタイマーを再開する
        pauseStartTime = Date.now();
        spawnTimeoutId = setTimeout(spawnObstaclePattern, nextSpawnDelay);
    }
});

function createObstacleElement(xPos, cssClass, isDestructible, patternId) {
    const obsEl = document.createElement('div');
    obsEl.classList.add('obstacle', cssClass);
    if (isDestructible) {
        obsEl.classList.add('obs-all-wall');
    }
    stage.appendChild(obsEl);
    obsEl.style.left = xPos + 'px';

    obstacles.push({
        element: obsEl,
        x: xPos,
        isDestructible: isDestructible,
        patternId: patternId
    });
}

function gameLoop() {
    if (!isPlaying || isPaused) return; // 一時停止中はすべての挙動を止める

    // --- 1. プレイヤーの物理演算 ---
    velocityY -= gravity;
    playerY += velocityY;

    if (playerY <= 0) {
        playerY = 0;
        velocityY = 0;
        jumpCount = 0;
    }
    player.style.bottom = playerY + 'px';

    const oldScore = score;

    // --- 2. エレキボールの移動と判定 ---
    for (let j = elecBalls.length - 1; j >= 0; j--) {
        const ball = elecBalls[j];
        ball.x += 8;
        ball.element.style.left = ball.x + 'px';

        let hitSomething = false;
        let targetPatternId = null;

        for (let i = 0; i < obstacles.length; i++) {
            if (checkBallCollision(ball.element, obstacles[i].element)) {
                hitSomething = true;
                if (obstacles[i].isDestructible) {
                    targetPatternId = obstacles[i].patternId;
                }
                break;
            }
        }

        if (targetPatternId !== null) {
            let destroyedCount = 0;
            for (let i = obstacles.length - 1; i >= 0; i--) {
                if (obstacles[i].patternId === targetPatternId) {
                    obstacles[i].element.remove();
                    obstacles.splice(i, 1);
                    destroyedCount++;
                }
            }
            if (destroyedCount > 0) {
                score += 10;
                scoreDisplay.textContent = score;
                // ハイスコアをリアルタイムで追い抜いた場合、HUD側も連動して更新
                if (score > hiScore) {
                    hudHiScoreDisplay.textContent = score;
                }
            }
        }

        if (ball.x > stage.clientWidth || hitSomething) {
            ball.element.remove();
            elecBalls.splice(j, 1);
        }
    }

    // --- 3. 障害物の移動とプレイヤー判定 ---
    let scoredPatternIds = [];

    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.x -= gameSpeed;
        obs.element.style.left = obs.x + 'px';

        if (!isInvincible && checkCollision(player, obs.element)) {
            decreaseLife();
            if (!isPlaying) return;
        }

        if (obs.x < -40) {
            if (!scoredPatternIds.includes(obs.patternId)) {
                score += 10; 
                scoreDisplay.textContent = score;
                scoredPatternIds.push(obs.patternId);
                
                if (score > 0 && score > hiScore) {
                    hudHiScoreDisplay.textContent = score;
                }
            }

            obs.element.remove();
            obstacles.splice(i, 1);
        }
    }

    if (score > 0 && oldScore !== score && score % 50 === 0 && gameSpeed < 8) {
        gameSpeed += 0.4;
        player.style.animationDuration = (3.5 / gameSpeed * 0.9) + 's';
    }

    animationFrameId = requestAnimationFrame(gameLoop);
}

function decreaseLife() {
    life--;
    updateLifeDisplay();

    if (life <= 0) {
        gameOver();
    } else {
        isInvincible = true;
        player.classList.add('invincible');
        setTimeout(() => {
            if (isPaused) {
                // ポーズ中に無敵タイマーが切れた場合の点滅解除用
                const checkResume = setInterval(() => {
                    if (!isPaused) {
                        isInvincible = false;
                        player.classList.remove('invincible');
                        clearInterval(checkResume);
                    }
                }, 100);
            } else {
                isInvincible = false;
                player.classList.remove('invincible');
            }
        }, 1200);
    }
}

function updateLifeDisplay() {
    lifeDisplay.textContent = '❤️'.repeat(Math.max(0, life));
}

function checkCollision(pEl, oEl) {
    const pRect = pEl.getBoundingClientRect();
    const oRect = oEl.getBoundingClientRect();

    const circleRadius = (pRect.width / 2) - 8; 
    const circleX = pRect.left + pRect.width / 2;
    const circleY = pRect.top + pRect.height / 2;

    const closestX = Math.max(oRect.left, Math.min(circleX, oRect.right));
    const closestY = Math.max(oRect.top, Math.min(circleY, oRect.bottom));

    const distanceX = circleX - closestX;
    const distanceY = circleY - closestY;
    const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);

    return distanceSquared < (circleRadius * circleRadius);
}

function checkBallCollision(bEl, oEl) {
    const bRect = bEl.getBoundingClientRect();
    const oRect = oEl.getBoundingClientRect();
    return !(
        bRect.right < oRect.left ||
        bRect.left > oRect.right ||
        bRect.bottom < oRect.top ||
        bRect.top > oRect.bottom
    );
}

function gameOver() {
    isPlaying = false;
    isPaused = false;
    cancelAnimationFrame(animationFrameId);
    clearTimeout(spawnTimeoutId);

    if (score > hiScore) {
        hiScore = score;
        try {
            localStorage.setItem('marumine_hiscore', hiScore);
        } catch(e) {}
    }

    player.classList.remove('rolling', 'invincible');
    
    player.style.display = 'none';
    explosion.style.bottom = playerY - 45 + 'px';
    explosion.classList.add('boom');

    setTimeout(() => {
        gameTitle.textContent = "GAME OVER";
        
        // 📊 ゲームオーバー画面用リザルトの表示
        resScore.textContent = score;
        resHiScore.textContent = hiScore;
        
        topHiScoreWrap.style.display = 'none';   // トップ用の文字を消す
        gameoverScores.style.display = 'block'; // 「YOUR SCORE」枠を出現させる
        resultContainer.style.display = 'block';
        menuSettings.style.display = 'none';

        startBtn.textContent = "BACK TO TOP";
        overlay.style.display = 'flex';
    }, 1000);
}
