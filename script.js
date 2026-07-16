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
const resBestScore = document.getElementById('res-best-score');
const resHiScore = document.getElementById('res-hi-score');
const menuSettings = document.getElementById('menu-settings');
const btnSetLeft = document.getElementById('btn-set-left');
const btnSetRight = document.getElementById('btn-set-right');

const howToModal = document.getElementById('how-to-modal');
const howToOpenBtn = document.getElementById('how-to-open-btn');
const howToCloseBtn = document.getElementById('how-to-close-btn');

const rankingModal = document.getElementById('ranking-modal');
const rankingOpenBtn = document.getElementById('ranking-open-btn');
const rankingCloseBtn = document.getElementById('ranking-close-btn');
const rankingList = document.getElementById('ranking-list');
const sendScoreContainer = document.getElementById('send-score-container');
const playerNameInput = document.getElementById('player-name-input');
const sendScoreBtn = document.getElementById('send-score-btn');

let isPlaying = false;
let isPaused = false; 
let score = 0;
let hiScore = 0;
let life = 3;
let isInvincible = false;
let animationFrameId;
let spawnTimeoutId;
let pauseStartTime = 0; 
let nextSpawnDelay = 0; 

let playerY = 0;
let velocityY = 0;
const gravity = 0.36;
const firstJumpPower = 7.6;  
const secondJumpPower = 8.2; 
let jumpCount = 0;

let obstacles = [];
let elecBalls = [];
let gameSpeed = 3.5;

// 🔥【最重要】あなたが開設した世界に一つだけのFirebase接続用アドレス（末尾の.jsonが連携の鍵です）
const dbPart1 = "marumine-game-default-rtdb";
const BASE_DB_URL = "https://" + dbPart1 + "://";

// ⚙️ 初期ロード（自端末の隔離セーブと世界のデータをドッキング）
window.addEventListener('DOMContentLoaded', () => {
    try {
        hiScore = parseInt(localStorage.getItem('marumine_hiscore')) || 0;
    } catch(e) { hiScore = 0; }
    
    resBestScore.textContent = hiScore;
    hudHiScoreDisplay.textContent = hiScore;
    
    // 初回起動時のデフォルトを「左配置 'left'」に変更
    let savedPos = 'left';
    try {
        savedPos = localStorage.getItem('marumine_btn_pos') || 'left';
    } catch(e) {}
    applyButtonPosition(savedPos);
    
    // クラウドから世界の最高1位を引っ張ってきてトップ画面に反映
    loadGlobalRanking(true);
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

howToOpenBtn.addEventListener('click', () => howToModal.style.display = 'flex');
howToCloseBtn.addEventListener('click', () => howToModal.style.display = 'none');

rankingOpenBtn.addEventListener('click', () => {
    rankingModal.style.display = 'flex';
    loadGlobalRanking(false); 
});
rankingCloseBtn.addEventListener('click', () => rankingModal.style.display = 'none');

// 🌍 Firebaseから別端末共通の最新ランキングデータを取得
async function loadGlobalRanking(isOnlyTopHUD = false) {
    if (!isOnlyTopHUD) {
        rankingList.innerHTML = '<li>読み込み中...</li>';
    }
    try {
        const res = await fetch(BASE_DB_URL);
        const ranking = await res.json() || [];

        // スコア順に確実に並び替え
        ranking.sort((a, b) => b.score - a.score);

        // 世界の最高得点をトップ画面の「GLOBAL HI-SCORE」にセット
        if (ranking.length > 0) {
            resHiScore.textContent = ranking[0].score;
        } else {
            resHiScore.textContent = "0";
        }

        if (!isOnlyTopHUD) {
            rankingList.innerHTML = '';
            for (let i = 0; i < 5; i++) {
                const li = document.createElement('li');
                if (ranking[i]) {
                    li.innerHTML = `<span>${i + 1}位. ${escapeHTML(ranking[i].name)}</span><span>${ranking[i].score}点</span>`;
                } else {
                    li.innerHTML = `<span>${i + 1}位. ------</span><span>0点</span>`;
                }
                rankingList.appendChild(li);
            }
        }
    } catch (err) {
        if (!isOnlyTopHUD) rankingList.innerHTML = '<li>通信エラーが発生しました</li>';
    }
}

function escapeHTML(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

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
    gameoverScores.style.display = 'none';
    sendScoreContainer.style.display = 'none';
    topHiScoreWrap.style.display = 'block';
    menuSettings.style.display = 'block';
    startBtn.textContent = "START";
    loadGlobalRanking(true); // メニューに戻った時も世界ランキングを自動再ロード
}

attackBtn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (!isPlaying || isPaused) return;
    fireElecBall();
});

pauseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!isPlaying) return;

    if (!isPaused) {
        isPaused = true;
        pauseBtn.textContent = "▶️";
        player.style.animationPlayState = 'paused';
        cancelAnimationFrame(animationFrameId);
    } else {
        isPaused = false;
        pauseBtn.textContent = "⏸️";
        player.style.animationPlayState = 'running';
        gameLoop();
    }
});

window.addEventListener('pointerdown', (e) => {
    if (!isPlaying || isPaused || e.target === startBtn || e.target === attackBtn || e.target === btnSetLeft || e.target === btnSetRight || e.target === pauseBtn || e.target === playerNameInput || e.target === sendScoreBtn) return;

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
    // 自端末の隔離ローカルハイスコアを確実にゲーム画面に表示
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
    if (!isPlaying || isPaused) return;

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

    const baseTime = 2000 + Math.random() * 1200;
    nextSpawnDelay = baseTime / (gameSpeed * 0.25);
    pauseStartTime = Date.now();
    
    spawnTimeoutId = setTimeout(spawnObstaclePattern, nextSpawnDelay);
}

pauseBtn.addEventListener('click', () => {
    if (!isPlaying) return;
    if (isPaused) {
        clearTimeout(spawnTimeoutId);
        const elapsed = Date.now() - pauseStartTime;
        nextSpawnDelay = Math.max(0, nextSpawnDelay - elapsed);
    } else {
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
    if (!isPlaying || isPaused) return;

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
                // 自端末の記録を塗り替えた場合はリアルタイムにHUDも更新
                if (score > hiScore) {
                    hiScore = score;
                    hudHiScoreDisplay.textContent = hiScore;
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
                
                if (score > hiScore) {
                    hiScore = score;
                    hudHiScoreDisplay.textContent = hiScore;
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

// 🌍 Firebaseのあなた専用データベースへスコアを送信する修正版処理
sendScoreBtn.addEventListener('click', async () => {
    const name = playerNameInput.value.trim();
    if (!name) {
        alert("名前を入力してください！");
        return;
    }
    
    sendScoreBtn.disabled = true;
    sendScoreBtn.textContent = "送信中...";

    try {
        // 1. 最新のランキングデータをロード
        const getRes = await fetch(BASE_DB_URL);
        const rawData = await getRes.json();
        
        // 🎯【最重要大バグ修正】データが空っぽ（null）の場合は新しく空の配列を作る処理を追加！
        let ranking = Array.isArray(rawData) ? rawData : [];

        // 2. 今回のスコアをリストに追加して上位5位に並び替える
        ranking.push({ name: name, score: score });
        ranking.sort((a, b) => b.score - a.score);
        ranking = ranking.slice(0, 5);

        // 3. あなたのFirebaseサーバーへデータを上書き送信
        const putRes = await fetch(BASE_DB_URL, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(ranking)
        });

        if (putRes.ok) {
            sendScoreBtn.textContent = "完了！";
            alert("世界ランキングに登録されました！");
            sendScoreContainer.style.display = 'none'; 
        } else {
            throw new Error();
        }
    } catch (err) {
        alert("送信に失敗しました。時間を置いて再度お試しください。");
        sendScoreBtn.disabled = false;
        sendScoreBtn.textContent = "送信";
    }
});

function gameOver() {
    isPlaying = false;
    isPaused = false;
    cancelAnimationFrame(animationFrameId);
    clearTimeout(spawnTimeoutId);

    // 自端末ハイスコア（ローカル保存）の隔離セーブ
    if (score > hiScore) {
        hiScore = score;
    }
    try {
        localStorage.setItem('marumine_hiscore', hiScore);
    } catch(e) {}

    player.classList.remove('rolling', 'invincible');
    
    player.style.display = 'none';
    explosion.style.bottom = playerY - 45 + 'px';
    explosion.classList.add('boom');

    setTimeout(() => {
        gameTitle.textContent = "GAME OVER";
        
        resScore.textContent = score;
        resBestScore.textContent = hiScore;
        
        topHiScoreWrap.style.display = 'none'; 
        gameoverScores.style.display = 'block'; 
        resultContainer.style.display = 'block';
        menuSettings.style.display = 'none';

        if (score > 0) {
            playerNameInput.value = '';
            sendScoreBtn.disabled = false;
            sendScoreBtn.textContent = "送信";
            sendScoreContainer.style.display = 'block';
        }

        startBtn.textContent = "BACK TO TOP";
        overlay.style.display = 'flex';
    }, 1000);
}
