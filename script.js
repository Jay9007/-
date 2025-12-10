const GAME_WIDTH = 900;  // 150% of 600
const GAME_HEIGHT = 900; // 150% of 600
const DRONE_SIZE = 200;  // Increased from 120 to 200
const MOVE_STEP = 60;    // 150% of 40

// DOM Elements (Populated on Init)
let DOM = {};

function initDOM() {
    DOM = {
        drone: document.getElementById('drone'),
        target: document.getElementById('target'),
        score: document.getElementById('score'),
        finalScore: document.getElementById('finalScore'),
        startScreen: document.getElementById('start-screen'),
        gameOverScreen: document.getElementById('game-over-screen'),
        startBtn: document.getElementById('start-btn'),
        restartBtn: document.getElementById('restart-btn'),
        hintText: document.getElementById('hint-text'),
        hintMessage: document.getElementById('hint-message'),
        failureReason: document.getElementById('failure-reason')
    };

    // Event Listeners
    window.addEventListener('keydown', (e) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
            handleInput(e.key);
        }
    });

    DOM.startBtn.addEventListener('click', initGame);
    DOM.restartBtn.addEventListener('click', initGame);
}

let state = {
    isPlaying: false,
    score: 0,
    drone: { x: 450, y: 450, facing: 'back' }, // facing: 'back', 'front', 'left', 'right'
    target: { x: 0, y: 0 },
    targetDirection: '', // 'up', 'down', 'left', 'right'
    lastFailedDirection: null
};

// Audio Sys (Lazy Init)
let audioCtx;
function getAudioCtx() {
    if (!audioCtx && typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

function playSound(type) {
    const ctx = getAudioCtx();
    if (!ctx) return; // No audio in test mode

    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'move') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'win') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'lose') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(50, audioCtx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
    }
}

// Logic
function initGame() {
    state.score = 0;
    state.isPlaying = true;
    updateScore();
    DOM.startScreen.classList.add('hidden');
    DOM.gameOverScreen.classList.add('hidden');
    resetRound();
}

function resetRound() {
    // 1. Position Drone Center
    state.drone.x = GAME_WIDTH / 2;
    state.drone.y = GAME_HEIGHT / 2;

    // 2. Pick Random Orientation
    const orientations = ['back', 'front', 'left', 'right'];
    state.drone.facing = orientations[Math.floor(Math.random() * orientations.length)];

    // 3. Update Visuals
    updateDroneVisuals();

    // 4. Place Target nearby (but not too close)
    spawnTarget();
}

function spawnTarget() {
    // Only spawn in 4 cardinal directions relative to drone
    const directions = [
        { name: 'up', dx: 0, dy: -1 },
        { name: 'down', dx: 0, dy: 1 },
        { name: 'left', dx: -1, dy: 0 },
        { name: 'right', dx: 1, dy: 0 }
    ];

    const dir = directions[Math.floor(Math.random() * directions.length)];
    state.targetDirection = dir.name;

    // Place target 3-4 moves away in that direction
    const distance = MOVE_STEP * (3 + Math.random()); // 3-4 steps

    state.target.x = state.drone.x + dir.dx * distance;
    state.target.y = state.drone.y + dir.dy * distance;

    // Clamp to boundaries
    state.target.x = Math.max(60, Math.min(GAME_WIDTH - 60, state.target.x));
    state.target.y = Math.max(60, Math.min(GAME_HEIGHT - 60, state.target.y));

    updateTargetVisuals();
    updateHintText();
}

function updateDroneVisuals() {
    DOM.drone.style.left = state.drone.x + 'px';
    DOM.drone.style.top = state.drone.y + 'px';

    // Reset classes
    DOM.drone.className = '';
    DOM.drone.classList.add('drone-' + state.drone.facing);
}

function updateTargetVisuals() {
    DOM.target.style.left = state.target.x + 'px';
    DOM.target.style.top = state.target.y + 'px';
}

function updateScore() {
    DOM.score.innerText = state.score;
    const final = document.getElementById('final-score');
    if (final) final.innerText = state.score;
}

function updateHintText() {
    if (!DOM.hintText) return;

    // Show dynamic hint based on current facing and target direction
    const hints = getDirectionHint();
    if (hints) {
        DOM.hintText.innerText = hints;
    } else {
        DOM.hintText.innerText = '';
    }
}

function getDirectionHint() {
    // Map drone facing + target direction to suggested key
    const facing = state.drone.facing;
    const targetDir = state.targetDirection;

    if (!targetDir) return '';

    // Direction mappings (same as in handleInput)
    const keyMap = {
        'back': {
            'up': '↑上鍵',
            'down': '↓下鍵',
            'left': '←左鍵',
            'right': '→右鍵'
        },
        'front': {
            'up': '↓下鍵 (相機朝向你，控制相反)',
            'down': '↑上鍵 (相機朝向你，控制相反)',
            'left': '→右鍵 (相機朝向你，控制相反)',
            'right': '←左鍵 (相機朝向你，控制相反)'
        },
        'left': {  // 右側朝你（鼻朝右）：Up→右, Down→左, Left→上, Right→下
            'up': '←左鍵 (鼻朝右)',     // To go up, press Left
            'down': '→右鍵 (鼻朝右)',   // To go down, press Right
            'left': '↓下鍵 (鼻朝右)',   // To go left, press Down
            'right': '↑上鍵 (鼻朝右)'   // To go right, press Up
        },
        'right': {  // 左側朝你（鼻朝左）：Up→左, Down→右, Left→下, Right→上
            'up': '→右鍵 (鼻朝左)',     // To go up, press Right
            'down': '←左鍵 (鼻朝左)',   // To go down, press Left
            'left': '↓下鍵 (鼻朝左)',   // To go left, press Down
            'right': '↑上鍵 (鼻朝左)'   // To go right, press Up
        }
    };

    const directionName = {
        'up': '上方',
        'down': '下方',
        'left': '左方',
        'right': '右方'
    };

    if (state.lastFailedDirection) {
        return `提示: 寶石在${directionName[targetDir]}，試試按 ${keyMap[facing][targetDir]}`;
    }

    return `寶石在${directionName[targetDir]}`;
}

function handleInput(key) {
    if (!state.isPlaying) return;

    // Movement Vector relative to Drone (Pitch/Roll)
    // Up arrow = Forward Pitch, Down = Back Pitch
    // Left = Roll Left, Right = Roll Right
    let dx = 0;
    let dy = 0;

    // Define Local movement vector based on key
    // Coordinate system: X right, Y down
    if (key === 'ArrowUp') {
        // Forward
        dy = -1;
    } else if (key === 'ArrowDown') {
        // Backward
        dy = 1;
    } else if (key === 'ArrowLeft') {
        // Roll Left
        dx = -1;
    } else if (key === 'ArrowRight') {
        // Roll Right
        dx = 1;
    } else {
        return; // Not a game key
    }

    // Transform Local Vector to Global Vector based on facing
    // We need to know what "Forward" means for each facing in Global(Screen) terms

    let globalDx = 0;
    let globalDy = 0;

    /*
      Screen Coords:
      - Y is Down (North is -Y)
      - X is Right (East is +X)
      
      Orientation Mappings:
      'back' (Tail-in):   Forward = Up (-Y), Right = Right (+X)
      'front' (Nose-in):  Forward = Down (+Y), Right = Left (-X) [Reversed controls essentially]
      'left' (Left side visible, nose pointing Right): Forward = Right (+X), Right = Down (+Y)
      'right' (Right side visible, nose pointing Left): Forward = Left (-X), Right = Up (-Y)
    */

    const facing = state.drone.facing;

    // Local Inputs: 
    // Forward (dy=-1), Back (dy=1), Left (dx=-1), Right (dx=1)

    // Wait, let's normalize "Input" to "Command".
    // Command: PITCH_FWD, PITCH_BACK, ROLL_LEFT, ROLL_RIGHT.
    // Arrow Up = PITCH_FWD
    // Arrow Down = PITCH_BACK
    // Arrow Left = ROLL_LEFT
    // Arrow Right = ROLL_RIGHT

    // Now map Command + Facing -> Screen Movement

    if (facing === 'back') {
        // Normal checks
        globalDx = dx * MOVE_STEP;
        globalDy = dy * MOVE_STEP;
    } else if (facing === 'front') {
        // Inverted XY
        globalDx = -dx * MOVE_STEP;
        globalDy = -dy * MOVE_STEP;
    } else if (facing === 'left') { // Nose is pointing East (Screen Right)
        // User confirmed: 右側朝你（鼻朝右）：Up→右, Down→左, Left→上, Right→下
        // Up(dy=-1) → Right(+X): globalDx = -dy = +1 ✓
        // Left(dx=-1) → Up(-Y): globalDy = dx = -1 ✓

        globalDx = -dy * MOVE_STEP;
        globalDy = dx * MOVE_STEP;
    } else if (facing === 'right') { // Nose is pointing West (Screen Left)
        // User confirmed: 左側朝你（鼻朝左）：Up→左, Down→右, Left→下, Right→上
        // Up(dy=-1) → Left(-X): globalDx = dy = -1 ✓
        // Left(dx=-1) → Down(+Y): globalDy = -dx = +1 ✓

        globalDx = dy * MOVE_STEP;
        globalDy = -dx * MOVE_STEP;
    }

    // Calculate proposed new position
    const newX = state.drone.x + globalDx;
    const newY = state.drone.y + globalDy;

    // Check Distance Logic
    const oldDist = Math.hypot(state.target.x - state.drone.x, state.target.y - state.drone.y);
    const newDist = Math.hypot(state.target.x - newX, state.target.y - newY);

    // Game Over Conditions

    // 1. Boundary Check
    if (newX < 0 || newX > GAME_WIDTH || newY < 0 || newY > GAME_HEIGHT) {
        gameOver('boundary');
        return;
    }

    // 2. Wrong Direction Check (Did we get further away?)
    // Allow a small buffer for "parallel" moves but generally we want strict reduction or sideways that doesn't increase much?
    // User said: "False direction ... re-game". STRICT: If newDist >= oldDist, fail?
    // Actually, sideways moves might keep dist same-ish. Let's say if newDist > oldDist + 5 (margin), FAIL.
    if (newDist > oldDist + 10) {
        gameOver('wrong_dir');
        return;
    }

    // Move logic passed
    state.drone.x = newX;
    state.drone.y = newY;
    updateDroneVisuals();
    playSound('move');

    // Check Win (Collision)
    if (newDist < 40) { // Close enough
        state.score++;
        updateScore();
        playSound('win');
        spawnTarget(); // For simplicity, just spawn new target or reset round? User said "Get item -> score".
        // Maybe keeping same orientation is boring, let's reset orientation too to practice more?
        // User didn't specify, but "Every time ... generate an item" implies continuous play.
        // Let's re-randomize orientation after capture to keep it training-focused.

        setTimeout(resetRound, 200); // Small delay to register win
    }
}

function gameOver(reason) {
    state.isPlaying = false;
    playSound('lose');

    // Store the failed direction for hint
    state.lastFailedDirection = state.targetDirection;

    // Update failure message with hint
    if (DOM.failureReason) {
        if (reason === 'boundary') {
            DOM.failureReason.innerText = '你撞到了邊界!';
        } else {
            DOM.failureReason.innerText = '你移動到了錯誤的方向!';
        }
    }

    // Provide hint
    const hint = getDirectionHint();
    if (DOM.hintMessage && hint) {
        DOM.hintMessage.innerHTML = `<strong style="color: #ffcc00;">${hint}</strong>`;
    }

    DOM.gameOverScreen.classList.remove('hidden');
}

// Event Listeners moved to initDOM

// Start up
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', initDOM);
}

// Export for Node.js Testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        state,
        handleInput,
        initGame,
        resetRound,
        // Mock DOM for testing
        setDOM: (mockDOM) => { DOM = mockDOM; },
        CONSTANTS: { GAME_WIDTH, GAME_HEIGHT, MOVE_STEP }
    };
}
