## Pong (JavaScript) — Single Source of Truth Plan

This document defines the minimal, clear plan for implementing a very simple Pong game in JavaScript. It must remain up to date; any scope or design change should be reflected here first, then implemented in code.

### Scope (MVP)

- **Game area**: Fixed-size canvas.

### Responsive Behavior

- Support responsive scaling: maintain 800:500 aspect ratio; scale host width to container.
- Options: `responsive: true`, optional `maxWidth` to cap size.
- **Entities**: Left paddle (player), right paddle (AI), ball.
- **Controls**: Player uses keyboard (ArrowUp/ArrowDown) and touch (swipe up/down).
- **Rules**: Ball bounces off top/bottom walls; resets and scores when it exits left/right. First to N points wins (configurable, default 5).
- **AI**: Simple proportional tracking of ball Y with capped speed.
- **Rendering**: 2D canvas; simple shapes (rectangles, circle) and basic text for score.
- **Performance target**: 60 FPS using `requestAnimationFrame`.
- **User Interaction**: Game starts paused with "Click or tap to start" overlay; requires user interaction to begin.

### Tech/Files

- **Platform**: TypeScript + HTML + CSS (no frameworks).
- **Files**:
  - `index.html`: Local demo page that mounts the module.
  - `styles.css`: Minimal styling for demo page.
  - `src/pong.ts`: Single source of truth for game logic and embedding API.
  - `src/PongGame.tsx`: React component wrapper.
  - `dist/pong.js`: Compiled TypeScript output.
  - `dist/PongGame.js`: Compiled React component.

### Constants (tune for gameplay feel)

- Canvas: `WIDTH=800`, `HEIGHT=500`.
- Paddle: `WIDTH=12`, `HEIGHT=90`, `PLAYER_SPEED=6`, `AI_MAX_SPEED=5`.
- Ball: `RADIUS=8`, initial speed `BALL_SPEED=5`, speed increase on paddle hit `BALL_SPEED_STEP=0.5`, max speed `BALL_SPEED_MAX=10`.
- Scoring: `WIN_SCORE=5`; pause 1s after goal.

### Game State

- `state = { ball: {x, y, vx, vy}, player: {y}, ai: {y}, scores: {player, ai}, running: boolean, lastTime: number | null }`.
- Derived: paddle X positions: `PX=20`, `AX=WIDTH-20-PaddleWidth`.

### Input Handling

- Listen to `keydown`/`keyup` for ArrowUp/ArrowDown; set `playerVelocityY` to `-PLAYER_SPEED`, `+PLAYER_SPEED`, or `0`.
- Touch controls: swipe up/down on touchscreen with 20px threshold to avoid accidental triggers.
- Click/tap to start game or reset after game over.
- Clamp paddle Y within canvas bounds each frame.

### Main Loop

1. Use `requestAnimationFrame(loop)`.
2. Compute `dt` (seconds) from `performance.now()`.
3. Update entities: player Y by input; AI Y towards ball Y with `AI_MAX_SPEED` and clamp; ball by velocity.
4. Handle collisions: ball with top/bottom; ball with paddles (AABB vs circle simplified as rectangle overlap on X with Y range).
5. On paddle hit: reflect X velocity, add small speed and optional spin: `vy += k * (ballCenterY - paddleCenterY)` with clamp.
6. Goal condition: ball.x < 0 => AI scores; ball.x > WIDTH => Player scores; update score, reset positions/velocities, pause briefly.
7. Render: clear canvas; draw center line; paddles; ball; scores.

### Collision Details

- Wall: If `ball.y - RADIUS <= 0` or `ball.y + RADIUS >= HEIGHT`, invert `vy` and clamp inside.
- Paddle check order: determine if ball overlaps paddle X range and Y within paddle height. When colliding, set `ball.x` to just outside paddle and invert `vx`.

### Ball Reset

- After goal: center ball; randomize initial direction: `vx = ±BALL_SPEED`, `vy = random in [-BALL_SPEED/2, BALL_SPEED/2]`.
- Pause flag prevents updates for ~1000ms; still render.

### Rendering

- Use `CanvasRenderingContext2D`.
- Colors: background black, paddles/ball white, center dashed line gray, score white.
- Text: top center for score (e.g., `Player 2 — 3 AI`).
- Overlay: semi-transparent overlay (50% black) for start message and win messages.
- Initial render: Game state is rendered immediately on load, visible behind start overlay.

### Minimal UI

- `index.html` contains the canvas. Game starts paused with "Click or tap to start" overlay.
- No auto-start: requires user interaction to begin playing.

### Architecture (TypeScript module)

- `src/pong.ts` sections: types → constants → state → setup (shadow host, listeners) → loop (update, render) → helpers (clamp, resetBall, randomSign) → public API.
- Compiled to `dist/pong.js` with type definitions in `dist/pong.d.ts`.
- Keep functions small and pure where reasonable.

### Win Condition

- If either score reaches `WIN_SCORE`, set `running=false`, render a win message with semi-transparent overlay, and stop updates until reset.
- Reset: Click/tap to start new game; resets scores, paddle positions to center, and ball to center.

### Simple AI Strategy

- Target `ball.y - paddleHeight/2`.
- Move towards target by at most `AI_MAX_SPEED` per frame.
- If ball moving away from AI (vx < 0), reduce AI speed to 50% for fairness.

### Testing/Validation (manual)

- Verify: collisions feel fair; speed ramps up; AI is beatable but not trivial; win condition triggers; reset works.

### Out of Scope (MVP)

- Sound effects, pause menu, difficulty levels, advanced physics.

### Touch Controls

- Swipe up/down on touchscreen to move paddle.
- Touch events: touchstart, touchmove, touchend with 20px threshold.
- Prevents default to avoid page scrolling.
- Click/tap to start game or reset after game over.

### Future Enhancements (post-MVP)

- Difficulty slider; particle trails; sound; settings overlay; pause/resume.

### Change Process

- Any change in behavior, constants, or file structure must be updated here first, then implemented. This file is the source of truth.

### Dev Tooling

- Use VS Code Run and Debug with a launch profile.
- For ESM modules, serve over http to avoid file:// CORS.
- Use a tiny dev server (ESM): `node dev-server.js` (default on http://localhost:3000).
- VS Code `.vscode/tasks.json` defines `dev-server` background task; `.vscode/launch.json` references it via `preLaunchTask` and opens http://localhost:3000.

### Embedding (Widget Mode)

- Approach: non-iframe, mount directly into host container using Shadow DOM to isolate styles.
- Provide module `createPong(container, options)` that creates a shadow root, injects minimal DOM (canvas + overlay), and runs the game instance scoped to that root.
- Options: `{ width?: number, height?: number, responsive?: boolean, maxWidth?: number, shadow?: boolean, className?: string }`.
- Exposed controls: `{ start(), stop(), reset(), destroy(), getScores() }`.
- Keyboard handling: attach listeners to the shadow root host; focus host on `start()` to capture keys.
- Custom styling: `className` option applies CSS classes to the game's root div.

### React Support

- Provide pre-built React component: `PongGame` exported from `@carohauta/pong-mini/react`.
- Component handles lifecycle: create/destroy game on mount/unmount, optional score monitoring.
- Props: `options?: PongOptions`, `onScoresChange?: (scores) => void`, `className?: string`.
- Peer dependency: React >=16.8.0.
- Custom styling: `className` prop applies CSS classes to the game's root div for custom styling.

### Packaging

- Convert to npm package.
- Entry: TypeScript `src/pong.ts` → build to `dist/pong.js` with types `dist/pong.d.ts`.
- React: `src/PongGame.tsx` → build to `dist/PongGame.js` with types `dist/PongGame.d.ts`.
- `package.json`: name `@carohauta/pong-mini`, type `module`, exports with `types` and `import` fields to `dist/`.
- Include CSS in package: `src/styles.css`. Provide `shadow` (default) and `shadow: false` modes.
- No build step required for MVP (vanilla ESM). Future: add bundler if desired.
