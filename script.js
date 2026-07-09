const stage = document.getElementById('game-stage');
const player = document.getElementById('player');
const scoreDisplay = document.getElementById('score');
const lifeDisplay = document.getElementById('life');
const overlay = document.getElementById('overlay');
const gameTitle = document.getElementById('game-title');
const startBtn = document.getElementById('start-btn');
const attackBtn = document.getElementById('attack-btn');
const explosion = document.getElementById('explosion');

// リザルト・設定用要素
const resultContainer = document.getElementById('result-container');
const resScore = document.getElementById('res-score');
const resHiScore = document.getElementById('res-hi-score');
const menuSettings = document.getElementById('menu-settings');
const btnSetLeft = document.getElementById('btn-set-left');
const btnSetRight = document.getElementById('btn-set-right');

let isPlaying = false;
let score = 0;
let hiScore = 0;
let life = 3;
let isInvincible = false;
let animationFrameId;
let spawnTimeoutId;

// プレイヤー物理パラメータ
let playerY = 0;
let velocityY = 0;
const gravity = 0.36;
const firstJumpPower = 7.6;  
const secondJumpPower = 8.2; 
let jumpCount = 0;

// ゲーム状態データ
let obstacles = [];
let elecBalls = [];
let gameSpeed = 3.5;

// ⚙️ 起動時にハイスコアとボタン位置設定をロード
window.addEventListener('DOMContentLoaded', () => {
    hiScore = parseInt(localStorage.getItem('marumine_hiscore')) || 0;
    
    const savedPos = localStorage.getItem('marumine_btn_pos') || 'right';
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
    localStorage.setItem('marumine_btn_pos', position);
}

btnSetLeft.addEventListener('click', () => applyButtonPosition('left'));
btnSetRight.addEventListener('click', () => applyButtonPosition('right'));

startBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (startBtn.textContent === "BACK TO TOP") {
        showTopMenu();
    } else {
        initGame();
    }
});

function showTopMenu() {
    gameTitle.textContent = "MARUMINE ROLL EX";
    resultContainer.style.display = 'none';
    menuSettings.style.display = 'block';
    startBtn.textContent = "START";
}

attackBtn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (!isPlaying) return;
    fireElecBall();
});

window.addEventListener('pointerdown', (e) => {
    if (!isPlaying || e.target === startBtn || e.target === attackBtn || e.target === btnSetLeft || e.target === btnSetRight) return;

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
    score = 0;
    life = 3;
    gameSpeed = 3.5;
    playerY = 0;
    velocityY = 0;
    jumpCount = 0;
    isInvincible = false;
    
    scoreDisplay.textContent = score;
    updateLifeDisplay();
    overlay.style.display = 'none';
    explosion.classList.remove('boom');
    player.style.display = 'block';
    
    player.style.animationDuration = '0.9s';
    player.classList.add('rolling');
    player.classList.remove('invincible');

    obstacles.forEach(obs => obs.element.remove());
    obstacles = [];
    elecBalls.forEach(ball => ball.element.remove());
    elecBalls = [];

    gameLoop();
    spawnObstaclePattern();
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

    const nextSpawnTime = 2000 + Math.random() * 1200;
    spawnTimeoutId = setTimeout(spawnObstaclePattern, nextSpawnTime / (gameSpeed * 0.25));
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
    if (!isPlaying) return;

    // --- 1. プレイヤーの物理演算 ---
    velocityY -= gravity;
    playerY += velocityY;

    if (playerY <= 0) {
        playerY = 0;
        velocityY = 0;
        jumpCount = 0;
    }
    player.style.bottom = playerY + 'px';

    // スピードアップ判定に使うため、現在のスコアを退避
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

        // 紫の壁ならグループ丸ごと一括破壊
        if (targetPatternId !== null) {
            let destroyedCount = 0;
            for (let i = obstacles.length - 1; i >= 0; i--) {
                if (obstacles[i].patternId === targetPatternId) {
                    obstacles[i].element.remove();
                    obstacles.splice(i, 1);
                    destroyedCount++;
                }
            }
            // 🎯【修正】紫の壁を破壊した瞬間に、通過時と同じ「10点」を直接加算する
            if (destroyedCount > 0) {
                score += 10;
                scoreDisplay.textContent = score;
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
            }

            obs.element.remove();
            obstacles.splice(i, 1);
        }
    }

    // 🎯【修正】ボール破壊・通常通過どちらの加算でも50点ごとのスピードアップが発動するように統合
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
            isInvincible = false;
            player.classList.remove('invincible');
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
    cancelAnimationFrame(animationFrameId);
    clearTimeout(spawnTimeoutId);

    if (score > hiScore) {
        hiScore = score;
        localStorage.setItem('marumine_hiscore', hiScore);
    }

    player.classList.remove('rolling', 'invincible');
    
    player.style.display = 'none';
    explosion.style.bottom = playerY - 45 + 'px';
    explosion.classList.add('boom');

    setTimeout(() => {
        gameTitle.textContent = "GAME OVER";
        
        resScore.textContent = score;
        resHiScore.textContent = hiScore;
        resultContainer.style.display = 'block';
        menuSettings.style.display = 'none';

        startBtn.textContent = "BACK TO TOP";
        overlay.style.display = 'flex';
    }, 1000);
}
