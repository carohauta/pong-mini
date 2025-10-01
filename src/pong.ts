export interface PongOptions {
  width?: number;
  height?: number;
  shadow?: boolean;
  responsive?: boolean;
  maxWidth?: number;
  className?: string;
  // Difficulty settings
  playerSpeed?: number;
  aiSpeed?: number;
  ballSpeed?: number; 
  ballSpeedStep?: number;
  ballSpeedMax?: number;
  winScore?: number;
}

export interface PongApi {
  start: () => void;
  stop: () => void;
  reset: () => void;
  destroy: () => void;
  getScores: () => { player: number; ai: number };
  host: HTMLDivElement;
}

interface GameState {
  ball: { x: number; y: number; vx: number; vy: number };
  player: { y: number };
  ai: { y: number };
  scores: { player: number; ai: number };
  running: boolean;
  pausedUntil: number;
  lastTime: number | null;
  input: { up: boolean; down: boolean };
  rafId: number;
}

export function createPong(container: HTMLElement, options: PongOptions = {}): PongApi {
  if (!container) throw new Error('createPong: container is required');

  const WIDTH = 800;
  const HEIGHT = 500;
  let viewWidth = options.width || 400;
  let viewHeight = options.height || 250;

  const PADDLE_WIDTH = 12;
  const PADDLE_HEIGHT = 90;
  const PLAYER_SPEED = options.playerSpeed ?? 5; // Configurable player speed
  const AI_MAX_SPEED = options.aiSpeed ?? 3; // Configurable AI speed
  const BALL_RADIUS = 8;
  const BALL_SPEED_INITIAL = options.ballSpeed ?? 4; // Configurable initial ball speed
  const BALL_SPEED_STEP = options.ballSpeedStep ?? 0.3; // Configurable speed increase
  const BALL_SPEED_MAX = options.ballSpeedMax ?? 10; // Configurable max speed
  const WIN_SCORE = options.winScore ?? 5; // Configurable win score
  const GOAL_PAUSE_MS = 1000;
  const PLAYER_X = 20;
  const AI_X = WIDTH - 20 - PADDLE_WIDTH;

  const host = document.createElement('div');
  host.style.display = 'inline-block';
  host.style.width = (options.responsive ? '100%' : (viewWidth + 'px'));
  host.style.height = (options.responsive ? 'auto' : (viewHeight + 'px'));
  if (options.responsive) host.style.aspectRatio = `${WIDTH} / ${HEIGHT}`;
  host.style.contain = 'layout size style';
  host.style.outline = 'none'; // Remove focus border
  host.tabIndex = 0; // Make focusable for keyboard input
  container.appendChild(host);

  const useShadow = options.shadow !== false;
  let root: HTMLDivElement;
  let ctx: CanvasRenderingContext2D;
  let canvas: HTMLCanvasElement;
  let overlay: HTMLDivElement;
  if (useShadow) {
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; }
      .root { position: relative; width: 100%; height: 100%; display: block; }
      canvas { display: block; width: 100%; height: 100%; background: #000; }
      .overlay { position: absolute; inset: 0; display: flex; align-items: start; justify-content: center; padding-top: 10px; color: #fff; font: 600 14px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; pointer-events: none; }
    `;
    root = document.createElement('div');
    root.className = 'root';
    canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.textContent = 'Player 0 — 0 AI';
    root.appendChild(canvas);
    root.appendChild(overlay);
    shadow.appendChild(style);
    shadow.appendChild(root);
    const ctxMaybe = canvas.getContext('2d');
    if (!ctxMaybe) throw new Error('Canvas 2D context not available');
    ctx = ctxMaybe;
  } else {
    root = document.createElement('div');
    root.className = 'pong-root' + (options.className ? ' ' + options.className : '');
    canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    overlay = document.createElement('div');
    overlay.className = 'pong-overlay';
    overlay.textContent = 'Player 0 — 0 AI';
    root.appendChild(canvas);
    root.appendChild(overlay);
    host.appendChild(root);
    const ctxMaybe = canvas.getContext('2d');
    if (!ctxMaybe) throw new Error('Canvas 2D context not available');
    ctx = ctxMaybe;
  }

  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
  const randomSign = () => (Math.random() < 0.5 ? -1 : 1);
  const randomRange = (min: number, max: number) => min + Math.random() * (max - min);

  const state: GameState = {
    ball: { x: WIDTH / 2, y: HEIGHT / 2, vx: BALL_SPEED_INITIAL, vy: 0 },
    player: { y: HEIGHT / 2 - PADDLE_HEIGHT / 2 },
    ai: { y: HEIGHT / 2 - PADDLE_HEIGHT / 2 },
    scores: { player: 0, ai: 0 },
    running: false,
    pausedUntil: 0,
    lastTime: null,
    input: { up: false, down: false },
    rafId: 0,
  };

  // Show start message
  overlay.textContent = 'Click or tap to start';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  overlay.style.zIndex = '10';
  
  // Render initial game state
  render();

  const cleanups: Array<() => void> = [];

  function onKeyDown(e: KeyboardEvent) {
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') e.preventDefault();
    if (e.code === 'ArrowUp') state.input.up = true;
    if (e.code === 'ArrowDown') state.input.down = true;
    if (e.code === 'Enter' && !state.running) resetMatch();
  }
  function onKeyUp(e: KeyboardEvent) {
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') e.preventDefault();
    if (e.code === 'ArrowUp') state.input.up = false;
    if (e.code === 'ArrowDown') state.input.down = false;
  }
  host.addEventListener('keydown', onKeyDown);
  host.addEventListener('keyup', onKeyUp);
  
  // Click to start
  host.addEventListener('click', (e) => {
    if (!state.running) {
      if (state.scores.player === 0 && state.scores.ai === 0) {
        start();
      } else {
        resetMatch();
      }
    }
  });

  // Touch controls
  let touchStartY = 0;
  let touchCurrentY = 0;
  const touchThreshold = 20; // minimum movement to register

  function onTouchStart(e: TouchEvent) {
    e.preventDefault();
    if (e.touches.length > 0) {
      touchStartY = e.touches[0].clientY;
      touchCurrentY = touchStartY;
    }
  }

  function onTouchMove(e: TouchEvent) {
    e.preventDefault();
    if (e.touches.length > 0) {
      touchCurrentY = e.touches[0].clientY;
      const deltaY = touchCurrentY - touchStartY;
      
      if (Math.abs(deltaY) > touchThreshold) {
        if (deltaY < 0) {
          state.input.up = true;
          state.input.down = false;
        } else {
          state.input.up = false;
          state.input.down = true;
        }
      }
    }
  }

  function onTouchEnd(e: TouchEvent) {
    e.preventDefault();
    state.input.up = false;
    state.input.down = false;
    
    // Tap to start or reset when game is not running
    if (!state.running && e.changedTouches.length > 0) {
      const touch = e.changedTouches[0];
      const rect = host.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      
      // Check if tap is within game area
      if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
        if (state.scores.player === 0 && state.scores.ai === 0) {
          start();
        } else {
          resetMatch();
        }
      }
    }
  }

  host.addEventListener('touchstart', onTouchStart, { passive: false });
  host.addEventListener('touchmove', onTouchMove, { passive: false });
  host.addEventListener('touchend', onTouchEnd, { passive: false });

  function resetBall(direction?: number) {
    state.ball.x = WIDTH / 2;
    state.ball.y = HEIGHT / 2;
    const dirX = direction != null ? direction : randomSign();
    state.ball.vx = dirX * BALL_SPEED_INITIAL;
    state.ball.vy = randomRange(-BALL_SPEED_INITIAL / 2, BALL_SPEED_INITIAL / 2);
  }

  function resetMatch() {
    state.scores.player = 0;
    state.scores.ai = 0;
    state.running = true;
    overlay.textContent = '';
    overlay.style.backgroundColor = 'transparent';
    overlay.style.zIndex = '1';
    // Reset paddle positions to center
    state.player.y = HEIGHT / 2 - PADDLE_HEIGHT / 2;
    state.ai.y = HEIGHT / 2 - PADDLE_HEIGHT / 2;
    resetBall();
  }

  function reflectFromPaddle(paddleY: number) {
    state.ball.vx *= -1;
    const speed = Math.min(Math.hypot(state.ball.vx, state.ball.vy) + BALL_SPEED_STEP, BALL_SPEED_MAX);
    const angleInfluence = ((state.ball.y - (paddleY + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2));
    const directionX = Math.sign(state.ball.vx) || 1;
    let vy = state.ball.vy + angleInfluence * 2;
    let vx = directionX * Math.sqrt(Math.max(speed * speed - vy * vy, 1));
    const norm = Math.hypot(vx, vy) || 1;
    vx = (vx / norm) * speed;
    vy = (vy / norm) * speed;
    state.ball.vx = vx;
    state.ball.vy = vy;
  }

  function onScore(nextDirection: number) {
    if (state.scores.player >= WIN_SCORE || state.scores.ai >= WIN_SCORE) {
      state.running = false;
      overlay.textContent = state.scores.player > state.scores.ai ? 'You win! Tap or press Enter to restart' : 'AI wins! Tap or press Enter to restart';
      overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
      overlay.style.zIndex = '10';
      return;
    }
    state.pausedUntil = performance.now() + GOAL_PAUSE_MS;
    resetBall(nextDirection);
  }

  function update(dt: number) {
    if (!state.running) return;
    const now = performance.now();
    if (now < state.pausedUntil) return;

    let playerVelocity = 0;
    if (state.input.up) playerVelocity -= PLAYER_SPEED;
    if (state.input.down) playerVelocity += PLAYER_SPEED;
    state.player.y = clamp(state.player.y + playerVelocity, 0, HEIGHT - PADDLE_HEIGHT);

    const ballTargetY = state.ball.y - PADDLE_HEIGHT / 2;
    let aiSpeed = AI_MAX_SPEED;
    if (state.ball.vx < 0) aiSpeed *= 0.3; // Even slower when ball moving away
    const delta = ballTargetY - state.ai.y;
    state.ai.y = clamp(state.ai.y + clamp(delta, -aiSpeed, aiSpeed), 0, HEIGHT - PADDLE_HEIGHT);

    state.ball.x += state.ball.vx;
    state.ball.y += state.ball.vy;

    if (state.ball.y - BALL_RADIUS <= 0) { state.ball.y = BALL_RADIUS; state.ball.vy *= -1; }
    if (state.ball.y + BALL_RADIUS >= HEIGHT) { state.ball.y = HEIGHT - BALL_RADIUS; state.ball.vy *= -1; }

    if (
      state.ball.x - BALL_RADIUS <= PLAYER_X + PADDLE_WIDTH &&
      state.ball.x - BALL_RADIUS >= PLAYER_X &&
      state.ball.y >= state.player.y &&
      state.ball.y <= state.player.y + PADDLE_HEIGHT
    ) {
      state.ball.x = PLAYER_X + PADDLE_WIDTH + BALL_RADIUS;
      reflectFromPaddle(state.player.y);
    }
    if (
      state.ball.x + BALL_RADIUS >= AI_X &&
      state.ball.x + BALL_RADIUS <= AI_X + PADDLE_WIDTH &&
      state.ball.y >= state.ai.y &&
      state.ball.y <= state.ai.y + PADDLE_HEIGHT
    ) {
      state.ball.x = AI_X - BALL_RADIUS;
      reflectFromPaddle(state.ai.y);
    }

    if (state.ball.x < -BALL_RADIUS) { state.scores.ai += 1; onScore(-1); }
    else if (state.ball.x > WIDTH + BALL_RADIUS) { state.scores.player += 1; onScore(1); }
  }

  function render() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.strokeStyle = '#555';
    ctx.setLineDash([8, 10]);
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2, 0);
    ctx.lineTo(WIDTH / 2, HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#fff';
    ctx.fillRect(PLAYER_X, state.player.y, PADDLE_WIDTH, PADDLE_HEIGHT);
    ctx.fillRect(AI_X, state.ai.y, PADDLE_WIDTH, PADDLE_HEIGHT);
    ctx.beginPath();
    ctx.arc(state.ball.x, state.ball.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    if (state.running) overlay.textContent = `Player ${state.scores.player} — ${state.scores.ai} AI`;
  }

  function loop(ts: number) {
    if (state.lastTime == null) state.lastTime = ts;
    const dt = (ts - state.lastTime) / 1000;
    state.lastTime = ts;
    update(dt);
    render();
    state.rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (state.running) return;
    state.running = true;
    state.lastTime = null;
    overlay.textContent = '';
    overlay.style.backgroundColor = 'transparent';
    overlay.style.zIndex = '1';
    host.focus(); // Focus for keyboard input
    state.rafId = requestAnimationFrame(loop);
  }
  function stop() {
    state.running = false;
    if (state.rafId) cancelAnimationFrame(state.rafId);
  }
  function reset() {
    resetMatch();
  }
  let resizeObserver: ResizeObserver | null = null;
  if (options.responsive) {
    const maxW = typeof options.maxWidth === 'number' ? options.maxWidth : Infinity;
    const updateSize = () => {
      const parent = host.parentElement as HTMLElement | null;
      const rect = parent ? parent.getBoundingClientRect() : null;
      let cw = rect && rect.width ? rect.width : (parent ? parent.clientWidth : 0);
      if (!cw) cw = viewWidth;
      cw = Math.min(cw, maxW);
      const ch = cw * (HEIGHT / WIDTH);
      host.style.width = cw + 'px';
      host.style.height = ch + 'px';
    };
    resizeObserver = new ResizeObserver(() => updateSize());
    resizeObserver.observe(container);
    window.addEventListener('resize', updateSize);
    cleanups.push(() => window.removeEventListener('resize', updateSize));
    updateSize();
  }
  function destroy() {
    stop();
    host.removeEventListener('keydown', onKeyDown);
    host.removeEventListener('keyup', onKeyUp);
    host.removeEventListener('touchstart', onTouchStart);
    host.removeEventListener('touchmove', onTouchMove);
    host.removeEventListener('touchend', onTouchEnd);
    if (resizeObserver) resizeObserver.disconnect();
    for (const fn of cleanups) { try { fn(); } catch {}
    }
    if (host.parentNode) host.parentNode.removeChild(host);
  }
  function getScores() {
    return { ...state.scores };
  }

  return { start, stop, reset, destroy, getScores, host };
}


