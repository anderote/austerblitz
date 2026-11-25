import {
  HEIGHT,
  WIDTH,
  corps,
  position,
  posts,
  route,
  roadLength,
  stats,
  type Battle,
  type Corps,
} from './battle';
import { mulberry32 } from '../map/prng';

const dirs = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
const direction = (angle: number) =>
  dirs[(Math.round(angle / (Math.PI / 4)) + 8) % 8];
const frames = new Map<string, HTMLCanvasElement>();
type Brush = CanvasRenderingContext2D;
function surface(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
async function load(kind: string, pose: string, dir: string, frame: number) {
  const image = new Image();
  image.src =
    '/sprites/poses/' + kind + '/' + pose + '/' + dir + '/0/' + frame + '.png';
  await image.decode();
  for (const tint of ['walking', 'running', 'dying'].includes(pose)
    ? ['walker', 'runner', 'brute']
    : ['line', 'rifle', 'gun']) {
    const c = surface(image.width, image.height),
      g = c.getContext('2d')!;
    g.drawImage(image, 0, 0);
    if (tint !== 'line' && tint !== 'gun') {
      const pixels = g.getImageData(0, 0, c.width, c.height),
        p = pixels.data;
      for (let i = 0; i < p.length; i += 4) {
        if (!p[i + 3]) continue;
        const r = p[i],
          green = p[i + 1],
          blue = p[i + 2];
        if (tint === 'rifle') {
          if (r > green * 1.6 && r > blue * 1.5) {
            p[i] = r * 0.32;
            p[i + 1] = r * 0.54;
            p[i + 2] = r * 0.32;
          }
        } else {
          const l = r * 0.35 + green * 0.53 + blue * 0.12;
          p[i] = l * (tint === 'brute' ? 1.18 : 0.76) + 12;
          p[i + 1] = l * (tint === 'runner' ? 0.82 : 1.07) + 12;
          p[i + 2] = l * 0.61 + 12;
        }
      }
      g.putImageData(pixels, 0, 0);
      if (tint !== 'rifle' && pose !== 'dying') {
        // Keep the authored stride below the shoulders. Replace the tall shako
        // with a forward-leaning bare head and an arm reaching into the march.
        const angle = (dirs.indexOf(dir) * Math.PI) / 4;
        const dx = Math.round(Math.cos(angle) * 3),
          dy = Math.round(Math.sin(angle) * 2);
        const lean = 16 + dx,
          bob = frame % 2;
        g.clearRect(0, 0, c.width, 17);
        g.fillStyle = tint === 'brute' ? '#766956' : '#758464';
        g.fillRect(lean - 2, 12 + bob, 5, 5);
        g.fillStyle = '#b9bea0';
        g.fillRect(lean - 2, 12 + bob, 4, 2);
        g.fillStyle = '#512f2c';
        g.fillRect(lean + Math.sign(dx), 14 + bob, 2, 1);
        g.strokeStyle = '#99a281';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(16, 19);
        g.lineTo(17 + dx * 2, 18 + dy + bob);
        g.lineTo(17 + dx * 3, 17 + dy + bob);
        g.stroke();
      }
    }
    frames.set([kind, pose, dir, frame, tint].join('/'), c);
  }
}
export async function loadTroops() {
  const jobs: Promise<void>[] = [];
  for (const dir of dirs)
    for (const [pose, n] of Object.entries({
      idle: 1,
      aiming: 1,
      reloading: 1,
      firing: 1,
      walking: 4,
      running: 5,
      dying: 1,
    })) {
      for (let f = 0; f < n; f++)
        jobs.push(load('line-infantry', pose, dir, f));
      if (pose === 'idle' || pose === 'firing')
        jobs.push(load('cannon-12', pose, dir, 0));
    }
  await Promise.all(jobs);
}
function sprite(
  g: Brush,
  kind: string,
  pose: string,
  dir: string,
  f: number,
  tint: string,
  x: number,
  y: number,
  scale: number,
) {
  const image = frames.get([kind, pose, dir, f, tint].join('/'));
  if (image)
    g.drawImage(
      image,
      Math.round(x - 16 * scale),
      Math.round(y - 29 * scale),
      32 * scale,
      36 * scale,
    );
}
function road(g: Brush, color: string, width: number) {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.lineJoin = 'round';
  g.beginPath();
  route.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.stroke();
}
function terrain() {
  const c = surface(WIDTH, HEIGHT),
    g = c.getContext('2d')!,
    r = mulberry32(1848);
  g.fillStyle = '#646c49';
  g.fillRect(0, 0, WIDTH, HEIGHT);
  for (let i = 0; i < 7000; i++) {
    g.fillStyle = ['#69704c', '#5c6546', '#737752', '#606948'][i % 4];
    g.fillRect(r() * WIDTH, r() * HEIGHT, 2 + r() * 8, 1 + r() * 3);
  }
  road(g, '#525a40', 47);
  road(g, '#818062', 42);
  road(g, '#908769', 33);
  for (let i = 0; i < 2000; i++) {
    const p = position(r() * roadLength, (r() - 0.5) * 38);
    g.fillStyle = i % 2 ? '#a19778' : '#817b5d';
    g.fillRect(p.x, p.y, 2 + r() * 3, 1);
  }
  function tree(x: number, y: number, s: number) {
    g.fillStyle = '#484e39';
    g.fillRect(x - 2 * s, y - 6 * s, 5 * s, 7 * s);
    for (let j = 0; j < 3; j++) {
      const w = (10 - 2 * j) * s,
        base = y - (4 + j * 6) * s;
      g.fillStyle = ['#384b39', '#43583e', '#516544'][j];
      g.beginPath();
      g.moveTo(x - w, base);
      g.lineTo(x - 2 * s, base - 13 * s);
      g.lineTo(x + w, base);
      g.fill();
    }
  }
  const trees: number[][] = [];
  for (const [x, y, w, h] of [
    [0, 6, 170, 108],
    [310, 5, 273, 42],
    [707, 176, 151, 213],
    [9, 303, 62, 37],
    [292, 425, 320, 46],
  ]) {
    for (let i = 0; i < (w * h) / 180; i++)
      trees.push([x + r() * w, y + r() * h, 0.62 + r() * 0.72]);
  }
  trees.sort((a, b) => a[1] - b[1]).forEach(([x, y, s]) => tree(x, y, s));
  // Timber blockhouse and palisade at the end of the road.
  for (const y of [343, 389])
    for (let x = 21; x < 102; x += 6) {
      g.fillStyle = '#403d30';
      g.fillRect(x, y, 5, 13);
      g.fillStyle = '#ab9469';
      g.fillRect(x, y, 2, 8);
    }
  g.fillStyle = '#524734';
  g.fillRect(32, 346, 46, 30);
  for (let i = 0; i < 5; i++) {
    g.fillStyle = '#867255';
    g.fillRect(33, 348 + i * 6, 44, 2);
  }
  g.fillStyle = '#343c34';
  g.beginPath();
  g.moveTo(26, 349);
  g.lineTo(52, 330);
  g.lineTo(82, 349);
  g.fill();
  g.fillStyle = '#282e26';
  g.fillRect(59, 362, 11, 14);
  g.fillStyle = '#c4b794';
  g.fillRect(49, 311, 2, 22);
  g.fillStyle = '#933f30';
  g.fillRect(51, 311, 14, 7);
  return c;
}
const ground = terrain();
export function drawField(
  g: Brush,
  b: Battle,
  selected: number,
  clock: number,
  preview: Corps,
) {
  g.imageSmoothingEnabled = false;
  g.drawImage(ground, 0, 0);
  const [px, py] = posts[selected],
    company = b.companies[selected];
  const radius = company
    ? stats(b, company).range
    : Math.round(corps[preview].range * (1 + 0.12 * b.tech.survey));
  g.fillStyle = '#efe3aa0d';
  g.strokeStyle = '#eadea174';
  g.lineWidth = 1;
  g.setLineDash([4, 5]);
  g.beginPath();
  g.arc(px, py, radius, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.setLineDash([]);
  posts.forEach(([x, y], i) => {
    g.fillStyle = i === selected ? '#cbb47a' : '#96916e';
    g.fillRect(x - 24, y + 1, 49, 6);
    g.fillStyle = '#494737';
    g.fillRect(x - 24, y + 7, 49, 3);
    for (let j = 0; j < 6; j++) {
      g.fillStyle = '#685e44';
      g.fillRect(x - 23 + j * 8, y + 1, 1, 6);
    }
    if (!b.companies[i]) {
      g.fillStyle = '#e7e0bb';
      g.font = 'bold 14px monospace';
      g.textAlign = 'center';
      g.fillText('+', x, y - 6);
    }
  });
  for (const f of b.fallen) {
    g.globalAlpha = Math.min(0.8, 3 - f.age);
    sprite(
      g,
      'line-infantry',
      'dying',
      direction(f.angle),
      0,
      f.kind,
      f.x,
      f.y,
      1,
    );
  }
  g.globalAlpha = 1;
  const actors: { y: number; draw: () => void }[] = [];
  b.companies.forEach((c, i) => {
    if (!c) return;
    const [x, y] = posts[i],
      dir = direction(c.angle);
    const offsets =
      c.kind === 'gun'
        ? [[0, 0]]
        : c.kind === 'line'
          ? [
              [-13, 0],
              [-4, -4],
              [6, 0],
              [16, -4],
            ]
          : [
              [-6, 0],
              [7, -3],
            ];
    for (const [dx, dy] of offsets)
      actors.push({
        y: y + dy,
        draw: () => {
          const gun = c.kind === 'gun',
            pose =
              c.shotAge < 0.14
                ? 'firing'
                : gun
                  ? 'idle'
                  : c.shotAge < 0.7
                    ? 'reloading'
                    : b.phase === 'wave'
                      ? 'aiming'
                      : 'idle';
          sprite(
            g,
            gun ? 'cannon-12' : 'line-infantry',
            pose,
            dir,
            0,
            c.kind,
            x + dx,
            y + dy,
            gun ? 1.35 : 1,
          );
          if (!gun) {
            g.strokeStyle = '#463925';
            g.lineWidth = 2;
            g.beginPath();
            g.moveTo(x + dx, y + dy - 10);
            const a = pose === 'reloading' || pose === 'idle' ? -1.35 : c.angle;
            g.lineTo(x + dx + Math.cos(a) * 12, y + dy - 10 + Math.sin(a) * 8);
            g.stroke();
          }
        },
      });
  });
  for (const z of b.enemies) {
    const p = position(z.distance, z.offset),
      run = z.kind === 'runner',
      scale = z.kind === 'brute' ? 1.6 : 1.07;
    actors.push({
      y: p.y,
      draw: () => {
        const frame = Math.floor(clock * (run ? 11 : 6) + z.id) % (run ? 5 : 4);
        sprite(
          g,
          'line-infantry',
          run ? 'running' : 'walking',
          direction(p.angle),
          frame,
          z.kind,
          p.x,
          p.y,
          scale,
        );
        if (z.hp < z.maxHp) {
          g.fillStyle = '#3c352b';
          g.fillRect(p.x - 7, p.y - 25 * scale, 14, 2);
          g.fillStyle = '#d7aa70';
          g.fillRect(p.x - 7, p.y - 25 * scale, (14 * z.hp) / z.maxHp, 2);
        }
      },
    });
  }
  actors.sort((a, d) => a.y - d.y).forEach((a) => a.draw());
  for (const s of b.shots) {
    if (s.age < 0.11) {
      g.strokeStyle = s.gun ? '#fff1ad' : '#edd69c';
      g.lineWidth = s.gun ? 2 : 1;
      g.beginPath();
      g.moveTo(s.x, s.y - 10);
      g.lineTo(s.tx, s.ty - 9);
      g.stroke();
    }
    for (let i = 0; i < 4; i++) {
      g.fillStyle = 'rgba(220,216,190,' + 0.36 * (1 - s.age / 0.45) + ')';
      g.fillRect(
        s.x + i * 3 - 3,
        s.y - 14 - i * 2 - s.age * 16,
        4 + s.age * 9,
        4 + s.age * 7,
      );
    }
    if (s.gun) {
      g.strokeStyle = 'rgba(234,202,141,' + 0.65 * (1 - s.age / 0.45) + ')';
      g.beginPath();
      g.arc(s.tx, s.ty - 7, 4 + s.age * 72, 0, Math.PI * 2);
      g.stroke();
    }
  }
}
