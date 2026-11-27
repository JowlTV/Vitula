// Mapa da Rook Forest para o protótipo: mata fechada (paredes de árvores) com clareiras ligadas por trilhas,
// como a Rook Forest do Vitula em Phaser. Grade de 64 px: colisão por célula + obstáculos redondos (props).
const MT = 64, MW = 84, MH = 84;          // ~5,4 mil px de lado
const MAP = {
  // ---------------------------------------------------------------- geração
  gen(seed) {
    let s = seed >>> 0; const rng = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const wall = new Uint8Array(MW * MH).fill(1);
    const dig = (cx, cy, r) => { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++)
      if (x > 2 && y > 2 && x < MW - 3 && y < MH - 3 && (x - cx) ** 2 + ((y - cy) * 1.1) ** 2 <= r * r) wall[y * MW + x] = 0; };
    // clareiras: uma grande no centro (o início, com a carruagem) e várias espalhadas
    const rooms = [{ x: MW / 2, y: MH / 2, r: 8.5 }];
    for (let tries = 0; rooms.length < 22 && tries < 600; tries++) {
      const r = 4 + rng() * 4.5, x = 6 + rng() * (MW - 12), y = 6 + rng() * (MH - 12);
      if (rooms.every(o => Math.hypot(o.x - x, o.y - y) > o.r + r + 4)) rooms.push({ x, y, r });
    }
    for (const o of rooms) { dig(o.x, o.y, o.r); for (let k = 0; k < 3; k++) dig(o.x + (rng() - 0.5) * o.r * 1.4, o.y + (rng() - 0.5) * o.r * 1.4, o.r * (0.45 + rng() * 0.3)); }
    // trilhas: árvore geradora mínima + algumas extras (laços, para não virar um corredor sem saída)
    const path = (a, b) => { let x = a.x, y = a.y; const w = 1.6 + rng() * 0.8;
      for (let i = 0; i < 400 && Math.hypot(b.x - x, b.y - y) > 1; i++) { const ang = Math.atan2(b.y - y, b.x - x) + (rng() - 0.5) * 1.1; x += Math.cos(ang) * 0.8; y += Math.sin(ang) * 0.8; dig(x, y, w); } };
    const inT = [0], out = rooms.map((_, i) => i).slice(1);
    while (out.length) { let best = null;
      for (const i of inT) for (const j of out) { const d = Math.hypot(rooms[i].x - rooms[j].x, rooms[i].y - rooms[j].y); if (!best || d < best.d) best = { i, j, d }; }
      path(rooms[best.i], rooms[best.j]); inT.push(best.j); out.splice(out.indexOf(best.j), 1); }
    for (let k = 0; k < 7; k++) { const a = rooms[(rng() * rooms.length) | 0], b = rooms[(rng() * rooms.length) | 0]; if (a !== b && Math.hypot(a.x - b.x, a.y - b.y) < 26) path(a, b); }
    // suaviza: tira árvores soltas no meio da clareira e fecha buracos de 1 célula
    for (let p = 0; p < 2; p++) { const c = wall.slice();
      for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) { let n = 0; for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) n += c[(y + oy) * MW + x + ox];
        wall[y * MW + x] = n >= 5 ? 1 : n <= 2 ? 0 : c[y * MW + x]; } }
    dig(MW / 2, MH / 2, 6);
    return { wall, rooms, rng };
  },
  // ---------------------------------------------------------------- montagem na cena
  build(sc) {
    const G = sc.map = MAP.gen((Math.random() * 1e9) | 0);
    G.isWall = (cx, cy) => cx < 0 || cy < 0 || cx >= MW || cy >= MH || G.wall[cy * MW + cx] === 1;
    G.wallAt = (x, y) => G.isWall(Math.floor(x / MT), Math.floor(y / MT));
    // texturas das paredes: frente com troncos (metade esquerda) e copa vista de cima (metade direita)
    const tx = sc.textures.get("forest_rocks"); if (!tx.has("face")) { tx.add("face", 0, 0, 0, 64, 64); tx.add("top", 0, 64, 0, 64, 64); }
    const bl = sc.add.blitter(0, 0, "forest_rocks").setDepth(-900);
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (G.isWall(x, y)) {
      const face = !G.isWall(x, y + 1);
      bl.create(x * MT, y * MT, face ? "face" : "top").setTint(face ? 0x9aa898 : 0x8a9c90);
    }
    // borda irregular: copas extras por cima da beira da mata (só sobre a parede, para não enganar a colisão)
    G.props = [];
    const prop = (x, y, key, r, scale = 1, block = true) => { const s = sc.add.image(x, y, key).setOrigin(0.5, 1).setDepth(y).setScale(scale).setTint(0xb8c0a8); if (block) G.props.push({ x, y: y - 6, r }); return s; };
    const kinds = [["forest_bush", 18, 1], ["forest_bush", 18, 1], ["forest_stump", 16, 1], ["forest_log", 22, 1], ["forest_deadtree", 18, 1.25], ["forest_rocks_s", 0, 0]];
    G.torches = [];
    for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) {
      if (G.isWall(x, y)) continue;
      const nearWall = G.isWall(x - 1, y) || G.isWall(x + 1, y) || G.isWall(x, y - 1) || G.isWall(x, y + 1);
      const cx = x * MT + MT / 2, cy = y * MT + MT / 2;
      if (Math.hypot(cx - MW * MT / 2, cy - MH * MT / 2) < 260) continue;      // o início fica livre
      const r = G.rng();
      if (nearWall && r < 0.16) { const [k, rr, sc_] = kinds[(G.rng() * 5) | 0]; prop(cx + (G.rng() - 0.5) * 20, cy + 18, k, rr, sc_); }
      else if (!nearWall && r < 0.025) prop(cx, cy + 10, "forest_mushrooms", 0, 0.9, false);
      else if (nearWall && r < 0.19) { const t = prop(cx, cy + 20, "torch_stand", 10, 0.9); t.clearTint(); G.torches.push({ x: cx, y: cy - 30 }); }
    }
    // grade de obstáculos para consulta rápida
    G.pgrid = new Map();
    for (const p of G.props) { const k = Math.floor(p.x / MT) * 1000 + Math.floor(p.y / MT); (G.pgrid.get(k) || G.pgrid.set(k, []).get(k)).push(p); }
    G.dist = new Int16Array(MW * MH).fill(-1); G.heroCell = -1;
    return { x: MW * MT / 2, y: MH * MT / 2 + 40 };
  },
  // empurra um círculo para fora das paredes (por eixo) e dos props; devolve a nova posição
  move(G, x, y, nx, ny, r, props) {
    const blocked = (px, py) => G.wallAt(px - r, py) || G.wallAt(px + r, py) || G.wallAt(px, py - r * 0.6) || G.wallAt(px, py + r * 0.3);
    if (!blocked(nx, y)) x = nx;
    if (!blocked(x, ny)) y = ny;
    if (props) { const gx = Math.floor(x / MT), gy = Math.floor(y / MT);
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) for (const p of G.pgrid.get((gx + ox) * 1000 + gy + oy) || EMPTY) {
        const dx = x - p.x, dy = (y - p.y) * 1.6, d = Math.hypot(dx, dy), m = p.r + r * 0.7;
        if (d < m && d > 0.01) { const px = x + dx / d * (m - d), py = y + dy / d * (m - d) / 1.6; if (!blocked(px, py)) { x = px; y = py; } } } }
    return [x, y];
  },
  // campo de distância (BFS) a partir do herói: os monstros descem o gradiente e contornam a mata
  flow(G, hx, hy) {
    const hc = Math.floor(hy / MT) * MW + Math.floor(hx / MT); if (hc === G.heroCell) return; G.heroCell = hc;
    const D = G.dist; D.fill(-1); const q = new Int32Array(MW * MH); let a = 0, b = 0; q[b++] = hc; D[hc] = 0;
    while (a < b) { const c = q[a++], x = c % MW, y = (c / MW) | 0;
      for (const [ox, oy] of DIR4) { const nx = x + ox, ny = y + oy; if (G.isWall(nx, ny)) continue; const n = ny * MW + nx; if (D[n] < 0) { D[n] = D[c] + 1; q[b++] = n; } } }
  },
  // direção para o próximo passo rumo ao herói (vizinho de menor distância, com diagonais sem cortar quina)
  steer(G, x, y) {
    const cx = Math.floor(x / MT), cy = Math.floor(y / MT), D = G.dist, here = D[cy * MW + cx];
    if (here < 0) return null;
    let best = here, bx = 0, by = 0;
    for (const [ox, oy] of DIR8) { const nx = cx + ox, ny = cy + oy; if (G.isWall(nx, ny)) continue;
      if (ox && oy && (G.isWall(cx + ox, cy) || G.isWall(cx, cy + oy))) continue;
      const d = D[ny * MW + nx]; if (d >= 0 && d < best) { best = d; bx = ox; by = oy; } }
    if (!bx && !by) return null;
    const tx = (cx + bx + 0.5) * MT - x, ty = (cy + by + 0.5) * MT - y, l = Math.hypot(tx, ty) || 1;
    return [tx / l, ty / l];
  },
  // ponto livre e alcançável a uma distância do herói (para nascer monstros fora da tela)
  spawnPoint(G, hx, hy, dmin, dmax) {
    for (let i = 0; i < 40; i++) { const a = Math.random() * Math.PI * 2, d = dmin + Math.random() * (dmax - dmin);
      const x = hx + Math.cos(a) * d, y = hy + Math.sin(a) * d * 0.75, c = Math.floor(y / MT) * MW + Math.floor(x / MT);
      if (!G.wallAt(x, y) && G.dist[c] >= 0) return [x, y]; }
    return null;
  },
};
const DIR4 = [[1, 0], [-1, 0], [0, 1], [0, -1]], DIR8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
