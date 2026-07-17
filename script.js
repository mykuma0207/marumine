// 🟢 【回転バグ完全防御】実際の表示領域を1ピクセル単位で正確に測ってCSSへ流し込む関数
function adjustViewportHeight() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}

// 画面回転時・リサイズ時に即座に再計算を発動させる
window.addEventListener('resize', adjustViewportHeight);
window.addEventListener('orientationchange', () => {
    setTimeout(adjustViewportHeight, 100); // 回転直後のチラつき防止のためにダメ押し実行
});

const stage = document.getElementById('game-stage');
const player = document.getElementById('player');
const scoreDisplay = document.getElementById('score');
const hudHiScoreDisplay = document.getElementById('hud-hi-score');
const lifeDisplay = document.getElementById('life');
const attackBtn = document.getElementById('attack-btn');
const explosion = document.getElementById('explosion');
const pauseBtn = document.getElementById('pause-btn');

const titleMenu = document.getElementById('title-menu');
const gameoverMenu = document.getElementById('gameover-menu');

const resScore = document.getElementById('res-score');
const resBestScore = document.getElementById('res-best-score');
const resHiScore = document.getElementById('res-hi-score');
const startBtn = document.getElementById('start-btn');
const backToTopBtn = document.getElementById('back-to-top-btn');

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

const u1 = "h" + "t" + "t" + "p" + "s" + ":" + "/" + "/";
const u2 = "m" + "a" + "r" + "u" + "m" + "i" + "n" + "e" + "-" + "g" + "a" + "m" + "e" + "-";
const u3 = "d" + "e" + "f" + "a" + "u" + "l" + "t" + "-" + "r" + "t" + "d" + "b" + ".";
const u4 = "f" + "i" + "r" + "e" + "b" + "a" + "s" + "e" + "i" + "o" + "." + "c" + "o" + "m";
const BASE_DB_URL = u1 + u2 + u3 + u4 + "/ranking.json";

// ⚙️ 初期ロード
window.addEventListener('DOMContentLoaded', () => {
    adjustViewportHeight(); // 起動時に即座に高さを最適化
    
    // 起動時はゲーム中の要素を隠してすけ透けを防ぐ安全ガード
    player.style.display = 'none';
    attackBtn.style.display = 'none';

    try {
        hiScore = parseInt(localStorage.getItem('marumine_hiscore')) || 0;
    } catch(e) { hiScore = 0; }
    
    hudHiScoreDisplay.textContent = hiScore;
    resHiScore.textContent = hiScore; 
    
    let savedPos = 'left';
    try {
        savedPos = localStorage.getItem('marumine_btn_pos') || 'left';
    } catch(e) {}
    applyButtonPosition(savedPos);
});

function applyButtonPosition(position) {
    if (position === 'left') {
        attackBtn.className = 'pos-top-left';
        btnSetLeft.className = 'active';
        btnSetRight.className = '';
    } else {
        attackBtn.className = 'pos-top-right';
        btnSetRight.className = 'active';
        btnSetLeft.className = '';
    }
    try {
        localStorage.setItem('marumine_btn_pos', position);
    } catch(e) {}
}

btnSetLeft.addEventListener('click', () => applyButtonPosition('left'));
btnSetRight.addEventListener('click', () => applyButtonPosition('right'));

howToOpenBtn.addEventListener('click', () => { howToModal.style.display = 'flex'; });
howToCloseBtn.addEventListener('click', () => { howToModal.style.display = 'none'; });

// ランキングボタンをタップした時だけ世界のデータをロード
rankingOpenBtn.addEventListener('click', () => {
    rankingModal.style.display = 'flex';
    loadGlobalRanking(false); 
});
rankingCloseBtn.addEventListener('click', () => { rankingModal.style.display = 'none'; });

// 🌍 Firebaseオンラインランキングロード
async function loadGlobalRanking(isOnlyTopHUD = false) {
    if (!isOnlyTopHUD) {
        rankingList.innerHTML = '<li>読み込み中...</li>';
    }
    try {
        const res = await fetch(BASE_DB_URL);
        const rawData = await res.json();
        const ranking = Array.isArray(rawData) ? rawData : [];

        ranking.sort((a, b) => b.score - a.score);

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

// STARTボタンを押した時
startBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    initGame();
});

// BACK TO TOPボタンを押した時の処理
backToTopBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    gameoverMenu.style.display = 'none'; 
    titleMenu.style.display = 'flex'; // 🟢 CSSのFlexbox化に合わせて block から flex に修正、中央配置を維持
    resHiScore.textContent = hiScore; 
    adjustViewportHeight();           // 🟢 ダメ押しでここでも画面高さを強制再計算してバグを完全封鎖
});

attackBtn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (!isPlaying || isPaused) return;
    fireElecBall();
});

// 🟢 重複を排除し、安全に再構築したポーズボタンの一元化イベント
pauseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!isPlaying) return;

    if (!isPaused) {
        isPaused = true;
        pauseBtn.textContent = "▶️";
        player.style.animationPlayState = 'paused';
        cancelAnimationFrame(animationFrameId);
        clearTimeout(spawnTimeoutId);
        
        const elapsed = Date.now() - pauseStartTime;
        nextSpawnDelay = Math.max(0, nextSpawnDelay - elapsed);
    } else {
        isPaused = false;
        pauseBtn.textContent = "⏸️";
        player.style.animationPlayState = 'running';
        
        pauseStartTime = Date.now();
        spawnTimeoutId = setTimeout(spawnObstaclePattern, nextSpawnDelay);
        gameLoop();
    }
});

// 画面タップによる通常ジャンプ・2段ジャンプ判定
window.addEventListener('pointerdown', (e) => {
    if (!isPlaying || isPaused || e.target === startBtn || e.target === backToTopBtn || e.target === attackBtn || e.target === btnSetLeft || e.target === btnSetRight || e.target === pauseBtn || e.target === playerNameInput || e.target === sendScoreBtn) return;

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
    
    // 🪟 2つの独立した部屋の画面を確実に閉じてゲームを開始する
    titleMenu.style.display = 'none';
    gameoverMenu.style.display = 'none';
    
    explosion.classList.remove('boom');
    player.style.display = 'block';
    attackBtn.style.display = 'flex'; // ゲーム開始時に攻撃ボタンを確実に表示
    
    player.style.animationDuration = '0.9s';
    player.style.animationPlayState = 'running';
    player.classList.add('rolling');
    player.classList.remove('invincible');
    pauseBtn.textContent = "⏸️";

    obstacles.forEach(obs => obs.element.remove());
    obstacles = [];
    elecBalls.forEach(ball => ball.element.remove());
    elecBalls = [];

    // ゲーム開始直前に高さを今一度カチッと合わせる
    adjustViewportHeight();
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

// エレキボールの矩形衝突判定（すり抜けを完全防御）
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

// Firebaseへのスコア送信処理（重複排除ロジック内蔵版）
sendScoreBtn.addEventListener('click', async () => {
    const name = playerNameInput.value.trim();
    if (!name) {
        alert("名前を入力してください！");
        return;
    }
    
    sendScoreBtn.disabled = true;
    sendScoreBtn.textContent = "送信中...";

    try {
        const getRes = await fetch(BASE_DB_URL);
        const rawData = await getRes.json();
        let ranking = Array.isArray(rawData) ? rawData : [];

        const finalSubmitScore = Math.max(score, hiScore);
        ranking.push({ name: name, score: finalSubmitScore });
        
        ranking.sort((a, b) => b.score - a.score);
        const filteredRanking = [];
        const seenNames = new Set();
        for (let item of ranking) {
            if (!seenNames.has(item.name)) {
                seenNames.add(item.name);
                filteredRanking.push(item);
            }
        }
        const finalRanking = filteredRanking.slice(0, 5);

        const putRes = await fetch(BASE_DB_URL, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(finalRanking)
        });

        if (putRes.ok) {
            try { localStorage.setItem('marumine_last_name', name); } catch(e){}

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

// ゲームオーバー処理（画面回転バグへの耐性を付与した完全版）
function gameOver() {
    isPlaying = false;
    isPaused = false;
    cancelAnimationFrame(animationFrameId);
    clearTimeout(spawnTimeoutId);

    if (score > hiScore) {
        hiScore = score;
    }
    try {
        localStorage.setItem('marumine_hiscore', hiScore);
    } catch(e) {}

    player.classList.remove('rolling', 'invincible');
    
    player.style.display = 'none';
    attackBtn.style.display = 'none'; // ゲームオーバー時は攻撃ボタンを隠す
    explosion.style.bottom = playerY - 45 + 'px';
    explosion.classList.add('boom');

    setTimeout(() => {
        titleMenu.style.display = 'none';     
        gameoverMenu.style.display = 'flex'; // CSSのFlexbox化に合わせて flex に変更してド真ん中固定
        
        resScore.textContent = score;
        resBestScore.textContent = hiScore;

        if (score > 0 || hiScore > 0) {
            playerNameInput.value = '';
            try {
                const lastName = localStorage.getItem('marumine_last_name');
                if (lastName) {
                    playerNameInput.value = lastName;
                }
            } catch(e){}

            sendScoreBtn.disabled = false;
            sendScoreBtn.textContent = "送信";
            sendScoreContainer.style.display = 'block'; 
        }
        adjustViewportHeight(); // 画面が切り替わった瞬間に高さを測定し、埋もれバグを100%遮断
    }, 1000);
}
