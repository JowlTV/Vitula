// Gerador do esgoto (inspirado em mapas clássicos de esgoto):
//  • TÚNEIS retos com canal de água no meio e passarelas de 2 tiles dos dois lados;
//  • CISTERNAS nos cruzamentos: câmara 7×7 com poço de água no centro e anel de passagem;
//  • SALAS LATERAIS pequenas penduradas nos túneis (onde ficam objetos, baús e a escada);
//  • PONTES de grade cruzando o canal a cada poucos tiles.
// Células: 0 parede, 1 chão, 2 água.
class DungeonGen {
  constructor(w = 64, h = 48) { this.w = w; this.h = h; }

  rand(a, b) { return a + Math.floor(this.rng() * (b - a + 1)); }

  generate(seed, floor = 1) {
    let s = seed >>> 0 || 1;
    this.rng = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    this.cave = floor >= 3;
    if (this.cave) { this.generateCave(floor); return; }
    // quanto mais fundo, mais cisternas na malha (e maior o mapa)
    // (limite: ~112×50 tiles, o máximo que a textura do chão aguenta com folga)
    const [COLS, ROWS, SX] = [[3, 2, 22], [3, 3, 22], [4, 3, 22], [4, 3, 26], [5, 3, 22]][Math.min(4, Math.max(0, floor - 1))];
    const SY = 15, OX = 10, OY = 8;
    this.w = OX + (COLS - 1) * SX + 14; this.h = OY + (ROWS - 1) * SY + 12;
    this.cells = new Uint8Array(this.w * this.h);
    this.waterDir = new Uint8Array(this.w * this.h);  // 1 horizontal, 2 vertical, 3 poço
    this.rooms = []; this.doors = []; this.bridges = []; this.sconces = []; this.drains = []; this.tunnels = [];
    this.bridgeSet = new Set();

    // nós da malha (cisternas)
    const node = (c, r) => ({ c, r, x: OX + c * SX, y: OY + r * SY });
    const nodes = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) nodes.push(node(c, r));
    // árvore aleatória ligando os nós + 2 atalhos
    const id = (c, r) => r * COLS + c, seen = new Set([0]), edges = [];
    const stack = [0];
    while (stack.length) {
      const cur = stack[stack.length - 1], c = cur % COLS, r = Math.floor(cur / COLS);
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [c + dx, r + dy])
        .filter(([x, y]) => x >= 0 && y >= 0 && x < COLS && y < ROWS && !seen.has(id(x, y)));
      if (!nb.length) { stack.pop(); continue; }
      const [nx, ny] = nb[this.rand(0, nb.length - 1)];
      seen.add(id(nx, ny)); edges.push([cur, id(nx, ny)]); stack.push(id(nx, ny));
    }
    for (let k = 0, tries = 0; k < 2 && tries < 30; tries++) {
      const a = this.rand(0, nodes.length - 1), dir = this.rng() < 0.5 ? 1 : COLS;
      const b = a + dir;
      if (b >= nodes.length || (dir === 1 && a % COLS === COLS - 1)) continue;
      if (edges.some(([p, q]) => (p === a && q === b) || (p === b && q === a))) continue;
      edges.push([a, b]); k++;
    }
    // cada nó usado vira cisterna; cada aresta, um túnel
    const used = new Set(edges.flat());
    this.junctions = [];
    for (const i of used) {
      const n = nodes[i];
      const dirs = { n: false, s: false, e: false, w: false };
      for (const [a, b] of edges) {
        const o = a === i ? b : b === i ? a : -1;
        if (o < 0) continue;
        if (o === i + 1) dirs.e = true; else if (o === i - 1) dirs.w = true; else if (o > i) dirs.s = true; else dirs.n = true;
      }
      this.carveJunction(n.x, n.y, dirs);
      this.junctions.push({ x: n.x, y: n.y, dirs });
    }
    for (const [a, b] of edges) this.carveTunnel(nodes[a], nodes[b]);
    // salas laterais
    for (const t of this.tunnels) for (let k = 0; k < 4; k++) this.tryRoom(t);
    this.placeDoors();
  }

  set(x, y, v) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.cells[y * this.w + x] = v; }
  get(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.cells[y * this.w + x] : 0; }
  water(x, y, dir) { this.set(x, y, 2); this.waterDir[y * this.w + x] = dir; }
  bridge(x, y, dir) { this.set(x, y, 1); this.waterDir[y * this.w + x] = dir; if (!this.bridgeSet.has(y * 1000 + x)) { this.bridgeSet.add(y * 1000 + x); this.bridges.push({ x, y, dir }); } }
  isBridge(x, y) { return this.bridgeSet.has(y * 1000 + x); }

  // isFloor = espaço aberto (chão ou água); isWalk = dá para andar; isWater = canal/poço
  isFloor(x, y) { return this.get(x, y) >= 1; }
  isWalk(x, y) { return this.get(x, y) === 1; }
  isWater(x, y) { return this.get(x, y) === 2; }

  // cisterna 7×7 com cantos chanfrados, poço 3×3 no meio e o canal entrando pelas grades
  carveJunction(cx, cy, dirs) {
    for (let y = cy - 3; y <= cy + 3; y++) for (let x = cx - 3; x <= cx + 3; x++) {
      if (Math.abs(x - cx) === 3 && Math.abs(y - cy) === 3) continue;
      this.set(x, y, 1);
    }
    for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) this.water(x, y, 3);
    if (dirs.n) for (const y of [cy - 3, cy - 2]) this.bridge(cx, y, 2);
    if (dirs.s) for (const y of [cy + 2, cy + 3]) this.bridge(cx, y, 2);
    if (dirs.w) for (const x of [cx - 3, cx - 2]) this.bridge(x, cy, 1);
    if (dirs.e) for (const x of [cx + 2, cx + 3]) this.bridge(x, cy, 1);
    this.rooms.push({ x: cx - 3, y: cy - 3, w: 7, h: 7, kind: "cistern", channel: -1 });
  }

  // túnel: passarela(2) + canal(1) + passarela(2), entre duas cisternas
  carveTunnel(a, b) {
    if (a.y === b.y) {
      const x0 = Math.min(a.x, b.x) + 4, x1 = Math.max(a.x, b.x) - 4, cy = a.y;
      for (let x = x0; x <= x1; x++) {
        for (const dy of [-2, -1, 1, 2]) this.set(x, cy + dy, 1);
        this.water(x, cy, 1);
      }
      for (let x = x0 + 3; x <= x1 - 2; x += 6) this.bridge(x, cy, 1);
      this.tunnels.push({ h: true, x0, x1, c: cy });
      // arandelas e saídas de esgoto na parede de cima (a que aparece de frente)
      for (let x = x0 + 1; x <= x1; x += 5) this.sconces.push({ x, y: cy - 3 });
      for (let x = x0 + 3; x <= x1; x += 10) this.drains.push({ x, y: cy - 3 });
    } else {
      const y0 = Math.min(a.y, b.y) + 4, y1 = Math.max(a.y, b.y) - 4, cx = a.x;
      for (let y = y0; y <= y1; y++) {
        for (const dx of [-2, -1, 1, 2]) this.set(cx + dx, y, 1);
        this.water(cx, y, 2);
      }
      for (let y = y0 + 2; y <= y1 - 1; y += 5) this.bridge(cx, y, 2);
      this.tunnels.push({ h: false, y0, y1, c: cx });
    }
  }

  // sala lateral encostada no túnel, ligada por uma abertura de 2 tiles
  tryRoom(t) {
    const rw = this.rand(5, 8), rh = this.rand(4, 6);
    let r, gap;
    if (t.h) {
      if (t.x1 - t.x0 < rw + 2) return;
      const x = this.rand(t.x0 + 1, t.x1 - rw - 1), up = this.rng() < 0.5;
      r = up ? { x, y: t.c - 3 - rh, w: rw, h: rh } : { x, y: t.c + 4, w: rw, h: rh };
      const gx = x + this.rand(1, rw - 2);
      gap = [[gx, up ? t.c - 3 : t.c + 3]];
    } else {
      if (t.y1 - t.y0 < rh + 2) return;
      const y = this.rand(t.y0 + 1, t.y1 - rh - 1), left = this.rng() < 0.5;
      r = left ? { x: t.c - 3 - rw, y, w: rw, h: rh } : { x: t.c + 4, y, w: rw, h: rh };
      const gy = y + this.rand(1, rh - 2);
      gap = [[left ? t.c - 3 : t.c + 3, gy]];
    }
    if (r.x < 2 || r.y < 2 || r.x + r.w > this.w - 2 || r.y + r.h > this.h - 2) return;
    for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) if (this.get(x, y)) return;
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) this.set(x, y, 1);
    for (const [x, y] of gap) this.set(x, y, 1);
    r.kind = "room"; r.channel = -1; r.gap = gap;
    this.rooms.push(r);
  }


  // ---------------------------------------------------------------- caverna natural (andares 3–5)
  // autômato celular → câmaras orgânicas; regiões soltas ligadas por túneis; lagos; câmaras viram "salas".
  generateCave(floor) {
    const [W, H] = [[90, 50], [102, 50], [112, 50]][Math.min(2, floor - 3)];
    this.w = W; this.h = H;
    this.waterDir = new Uint8Array(W * H);
    this.rooms = []; this.doors = []; this.bridges = []; this.sconces = []; this.drains = []; this.tunnels = []; this.junctions = [];
    this.bridgeSet = new Set();
    const I = (x, y) => y * W + x, inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
    let c = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      c[I(x, y)] = (x < 2 || y < 2 || x >= W - 2 || y >= H - 2 || this.rng() < 0.46) ? 0 : 1;
    for (let it = 0; it < 5; it++) {
      const n = new Uint8Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) continue;
        let w1 = 0, w2 = 0;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const wall = !inb(x + dx, y + dy) || !c[I(x + dx, y + dy)];
          if (wall) { w2++; if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) w1++; }
        }
        n[I(x, y)] = (w1 >= 5 || (it < 3 && w2 <= 2)) ? 0 : 1;
      }
      c = n;
    }
    // regiões: mantém a maior e liga as outras (as muito pequenas viram rocha)
    const label = () => {
      const lab = new Int32Array(W * H).fill(-1), sizes = [];
      for (let i = 0; i < W * H; i++) {
        if (!c[i] || lab[i] >= 0) continue;
        const id = sizes.length, q = [i]; lab[i] = id; let n = 0;
        for (let h = 0; h < q.length; h++) {
          const v = q[h], x = v % W, y = (v / W) | 0; n++;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const j = I(x + dx, y + dy);
            if (inb(x + dx, y + dy) && c[j] && lab[j] < 0) { lab[j] = id; q.push(j); }
          }
        }
        sizes.push(n);
      }
      return { lab, sizes };
    };
    let { lab, sizes } = label();
    const main = sizes.indexOf(Math.max(...sizes));
    const mainCells = []; for (let i = 0; i < W * H; i++) if (lab[i] === main) mainCells.push(i);
    // primeiro some com as regiões pequenas (senão um túnel já cavado poderia ser tapado depois)
    for (let i = 0; i < W * H; i++) if (lab[i] >= 0 && lab[i] !== main && sizes[lab[i]] < 14) c[i] = 0;
    for (let id = 0; id < sizes.length; id++) {
      if (id === main || sizes[id] < 14) continue;
      const cells = []; for (let i = 0; i < W * H; i++) if (lab[i] === id) cells.push(i);
      const p = cells[this.rand(0, cells.length - 1)];
      let best = mainCells[0], bd = 1e9;
      for (const m of mainCells) { const d = Math.abs(m % W - p % W) + Math.abs(((m / W) | 0) - ((p / W) | 0)); if (d < bd) { bd = d; best = m; } }
      let x = p % W, y = (p / W) | 0; const tx = best % W, ty = (best / W) | 0;
      while (x !== tx || y !== ty) {
        if (x !== tx && (y === ty || this.rng() < 0.5)) x += Math.sign(tx - x); else y += Math.sign(ty - y);
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) if (x + dx > 1 && y + dy > 1 && x + dx < W - 2 && y + dy < H - 2) c[I(x + dx, y + dy)] = 1;
      }
    }
    this.cells = c;
    // lagos subterrâneos (não podem cortar a caverna)
    const reachAll = () => {
      let start = -1, total = 0;
      for (let i = 0; i < W * H; i++) if (c[i] === 1) { total++; if (start < 0) start = i; }
      const seen = new Uint8Array(W * H), q = [start]; seen[start] = 1;
      for (let h = 0; h < q.length; h++) {
        const v = q[h], x = v % W, y = (v / W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = I(x + dx, y + dy); if (c[j] === 1 && !seen[j]) { seen[j] = 1; q.push(j); } }
      }
      return q.length === total;
    };
    const dt = () => {
      const d = new Int16Array(W * H).fill(-1), q = [];
      for (let i = 0; i < W * H; i++) if (c[i] !== 1) { d[i] = 0; q.push(i); }
      for (let h = 0; h < q.length; h++) {
        const v = q[h], x = v % W, y = (v / W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (!inb(x + dx, y + dy)) continue; const j = I(x + dx, y + dy); if (d[j] < 0) { d[j] = d[v] + 1; q.push(j); } }
      }
      return d;
    };
    const lakes = 1 + (floor >= 4 ? 1 : 0) + (this.rng() < 0.5 ? 1 : 0);
    for (let k = 0, tries = 0; k < lakes && tries < 40; tries++) {
      const d = dt(), cand = []; for (let i = 0; i < W * H; i++) if (d[i] >= 4) cand.push(i);
      if (!cand.length) break;
      const seed = cand[this.rand(0, cand.length - 1)], target = this.rand(20, 44), blob = [seed], set = new Set([seed]);
      for (let h = 0; h < blob.length && blob.length < target; h++) {
        const v = blob[h], x = v % W, y = (v / W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const j = I(x + dx, y + dy);
          if (!set.has(j) && d[j] >= 2 && this.rng() < 0.72) { set.add(j); blob.push(j); }
        }
      }
      for (const i of blob) c[i] = 2;
      if (!reachAll()) { for (const i of blob) c[i] = 1; continue; }
      for (const i of blob) this.waterDir[i] = 3;
      k++;
    }
    // câmaras: centros nos pontos mais abertos, espaçados
    const d = dt(), order = [];
    for (let i = 0; i < W * H; i++) if (c[i] === 1 && d[i] >= 2) order.push(i);
    order.sort((a, b) => d[b] - d[a] || ((a * 2654435761) % 97) - ((b * 2654435761) % 97));
    const centers = [];
    for (const minGap of [13, 9]) {
      for (const i of order) {
        const x = i % W, y = (i / W) | 0;
        if (centers.some(([cx, cy]) => Math.max(Math.abs(cx - x), Math.abs(cy - y)) < minGap)) continue;
        centers.push([x, y, d[i]]);
      }
      if (centers.length >= 5) break;
    }
    centers.length = Math.min(centers.length, 14);
    centers.sort((a, b) => (a[0] + a[1] * 1.5) - (b[0] + b[1] * 1.5)); // a câmara 0 (início) fica no canto de cima/esquerda
    for (const [x, y, dd] of centers) {
      const r = Math.min(4, dd + 1);
      const x0 = Math.max(1, x - r), y0 = Math.max(1, y - r);
      this.rooms.push({ x: x0, y: y0, w: Math.min(W - 2, x + r) - x0 + 1, h: Math.min(H - 2, y + r) - y0 + 1, kind: "chamber", channel: -1, cx: x, cy: y });
    }
  }

  center(i) { const r = this.rooms[i]; return r.cx !== undefined ? { x: r.cx, y: r.cy } : { x: r.x + (r.w >> 1), y: r.y + (r.h >> 1) }; }

  roomOf(x, y) {
    for (let i = 0; i < this.rooms.length; i++) {
      const r = this.rooms[i];
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return i;
    }
    return -1;
  }

  hasDoor(x, y) { return this.doors.some(d => d.x === x && d.y === y); }

  // porta só nas salas abaixo do túnel: a abertura fica na parede de cima da sala (vista de frente)
  // sem portas: as salas ficam abertas, só a passagem entre as pedras
  placeDoors() {
    return;
    for (const r of this.rooms) {
      if (r.kind !== "room") continue;
      for (const [x, y] of r.gap) if (y === r.y - 1) this.doors.push({ x, y });
    }
  }

  // BFS de distâncias; passable(x,y) opcional para contornar obstáculos
  distances(fx, fy, passable, limit = 9999) {
    const d = new Int32Array(this.w * this.h).fill(-1);
    const q = [fx, fy]; d[fy * this.w + fx] = 0;
    for (let h = 0; h < q.length; h += 2) {
      const x = q[h], y = q[h + 1], v = d[y * this.w + x];
      if (v >= limit) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!this.isWalk(nx, ny) || d[ny * this.w + nx] !== -1) continue;
        if (passable && !passable(nx, ny)) continue;
        d[ny * this.w + nx] = v + 1; q.push(nx, ny);
      }
    }
    return d;
  }

  // células andáveis da sala; alongWall = só a borda, sem bloquear a entrada
  roomCells(i, alongWall) {
    const r = this.rooms[i], out = [];
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      if (!this.isWalk(x, y) || this.isBridge(x, y)) continue;
      const edge = x === r.x || y === r.y || x === r.x + r.w - 1 || y === r.y + r.h - 1;
      if (alongWall) {
        if (!edge) continue;
        let blocked = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (this.isWalk(nx, ny) && this.roomOf(nx, ny) === -1) blocked = true;
        }
        if (blocked) continue;
      }
      out.push({ x, y });
    }
    return out;
  }
}
