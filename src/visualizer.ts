const SVG_CX = 125;
const SVG_CY = 125;
const ORBIT_R = 90;

interface TrailParticle {
  x: number;
  y: number;
  life: number;
}

const dot = document.getElementById("dot") as Element as SVGCircleElement;
const trailPath = document.getElementById("trailPath") as Element as SVGPathElement;
const trailGradient = document.getElementById("trailFade") as Element as SVGLinearGradientElement;
const particles: TrailParticle[] = [];
let lastSpawnX = SVG_CX;
let lastSpawnY = SVG_CY - ORBIT_R;
let spawnDistance = 0;

export function orbitPos(angle: number): { x: number; y: number } {
  return {
    x: SVG_CX + Math.sin(angle) * ORBIT_R,
    y: SVG_CY - Math.cos(angle) * ORBIT_R,
  };
}

export function resetTrail(angle: number): void {
  particles.length = 0;
  spawnDistance = 0;
  const pos = orbitPos(angle);
  lastSpawnX = pos.x;
  lastSpawnY = pos.y;
  particles.push({ x: pos.x, y: pos.y, life: 1 });
  trailPath.setAttribute("d", "");
  trailPath.style.opacity = "0";
  dot.cx.baseVal.value = pos.x;
  dot.cy.baseVal.value = pos.y;
}

function buildPath(): string {
  const n = particles.length;
  if (n < 2) return "";

  const left = new Array<{ x: number; y: number }>(n);
  const right = new Array<{ x: number; y: number }>(n);

  for (let i = 0; i < n; i++) {
    const p = particles[i];
    const prev = particles[Math.max(i - 1, 0)];
    const next = particles[Math.min(i + 1, n - 1)];

    let tangentX = next.x - prev.x;
    let tangentY = next.y - prev.y;
    const len = Math.hypot(tangentX, tangentY) || 1;
    tangentX /= len;
    tangentY /= len;
    const normalX = -tangentY;
    const normalY = tangentX;
    const pWidth = Math.max(p.life * 14 + 1, 0.001);
    const half = pWidth / 2;

    left[i] = { x: p.x + normalX * half, y: p.y + normalY * half };
    right[i] = { x: p.x - normalX * half, y: p.y - normalY * half };
  }

  let d = `M${left[0].x.toFixed(2)},${left[0].y.toFixed(2)}`;
  for (let i = 1; i < n; i++) {
    d += `L${left[i].x.toFixed(2)},${left[i].y.toFixed(2)}`;
  }
  for (let i = n - 1; i >= 0; i--) {
    d += `L${right[i].x.toFixed(2)},${right[i].y.toFixed(2)}`;
  }
  d += "Z";
  return d;
}

export function renderFrame(dt: number, angle: number, isPlaying: boolean, speed: number): void {
  const pos = orbitPos(angle);
  dot.cx.baseVal.value = pos.x;
  dot.cy.baseVal.value = pos.y;

  const spacing = 3 + speed * 0.05;
  const fadeRate = 1.8 + speed * 0.03;

  if (isPlaying && speed >= 0.5) {
    const dx = pos.x - lastSpawnX;
    const dy = pos.y - lastSpawnY;
    const dist = Math.hypot(dx, dy);

    if (dist > 0.1) {
      spawnDistance += dist;
      while (spawnDistance >= spacing) {
        spawnDistance -= spacing;
        const t = 1 - spawnDistance / dist;
        particles.push({
          x: lastSpawnX + dx * t,
          y: lastSpawnY + dy * t,
          life: 1,
        });
      }
    }
    lastSpawnX = pos.x;
    lastSpawnY = pos.y;
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].life -= dt * fadeRate;
  }
  while (particles.length > 0 && particles[0].life <= 0) {
    particles.shift();
  }

  if (particles.length >= 2) {
    trailPath.setAttribute("d", buildPath());
    trailPath.style.opacity = "1";
    const tail = particles[0];
    const head = particles[particles.length - 1];
    trailGradient.setAttribute("x1", tail.x.toFixed(2));
    trailGradient.setAttribute("y1", tail.y.toFixed(2));
    trailGradient.setAttribute("x2", head.x.toFixed(2));
    trailGradient.setAttribute("y2", head.y.toFixed(2));
  } else {
    trailPath.style.opacity = "0";
  }
}

export function hasParticles(): boolean {
  return particles.length > 0;
}
