# Pong Mini

Install

```bash
npm install @carohauta/pong-mini
```

## Vanilla HTML/JS Usage

```html
<link
  rel="stylesheet"
  href="/node_modules/@carohauta/pong-mini/src/styles.css"
/>
<div id="pong-slot" style="max-width:480px"></div>
<script type="module">
  import { createPong } from "@carohauta/pong-mini";
  const slot = document.getElementById("pong-slot");
  const pong = createPong(slot, {
    responsive: true,
    maxWidth: 480,
    shadow: false,
  });
  pong.start();
  // pong.reset(); pong.destroy();
  // const scores = pong.getScores();
  // window.addEventListener('visibilitychange', () => document.hidden ? pong.stop() : pong.start());
</script>
```

## React Usage

```tsx
import { PongGame } from "@carohauta/pong-mini/react";
import "@carohauta/pong-mini/styles.css";

function App() {
  return (
    <PongGame
      options={{ responsive: true, shadow: false, maxWidth: 600 }}
      onScoresChange={(scores) => console.log(scores)}
    />
  );
}
```
