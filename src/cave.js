// Caverna natural (andares 3–5): desenho orgânico pixel a pixel, decoração e mobília das câmaras.
// O mapa continua em grade (colisão por tile), mas o DESENHO usa campos suaves + ruído:
// as bordas de rocha, a frente da parede e a margem dos lagos ficam irregulares, como no Tibia.
Object.assign(DungeonScene.prototype, {

  // pixels das artes da caverna, já limpos: tira as linhas de "lajota" e as bordas transparentes
  caveTex() {
    const theme = this.slope ? "slope" : "cave";
    if (this._caveTex && this._caveTex.theme === theme) return this._caveTex;
    const read = (k, sx, sy) => {
      const src = this.textures.get(k).getSourceImage();
      // recorte de 64×64 (a encosta usa artes maiores; o desenho lê blocos de 64)
      const w = sx != null ? 64 : src.width, h = sx != null ? 64 : src.height;
      const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      const cx = cv.getContext("2d"); cx.drawImage(src, -(sx || 0), -(sy || 0));
      return { d: cx.getImageData(0, 0, w, h).data, w, h };
    };
    const lum = (d, i) => d[i] * 0.3 + d[i + 1] * 0.6 + d[i + 2] * 0.1;
    // remove linhas escuras de rejunte (colunas/linhas bem mais escuras que a mediana) e a moldura
    const clean = ({ d, w, h }, removeGaps) => {
      const at = (x, y) => (y * w + x) * 4;
      const copy = (from, to) => { for (let k = 0; k < 4; k++) d[to + k] = d[from + k]; };
      if (removeGaps) {
        const colM = [], rowM = [];
        for (let x = 0; x < w; x++) { let s = 0; for (let y = 0; y < h; y++) s += d[at(x, y) + 3] > 128 ? lum(d, at(x, y)) : 0; colM.push(s / h); }
        for (let y = 0; y < h; y++) { let s = 0; for (let x = 0; x < w; x++) s += d[at(x, y) + 3] > 128 ? lum(d, at(x, y)) : 0; rowM.push(s / w); }
        const med = a => a.slice().sort((p, q) => p - q)[a.length >> 1];
        const gc = colM.map((v, x) => v < med(colM) * 0.8 || x < 2 || x > w - 3);
        const gr = rowM.map((v, y) => v < med(rowM) * 0.8 || y < 2 || y > h - 3);
        const near = (gaps, i, n) => { for (let o = 1; o < n; o++) for (const j of [i + o, i - o]) if (j >= 0 && j < n && !gaps[j]) return j; return i; };
        for (let x = 0; x < w; x++) if (gc[x]) { const sx = near(gc, x, w); for (let y = 0; y < h; y++) copy(at(sx, y), at(x, y)); }
        for (let y = 0; y < h; y++) if (gr[y]) { const sy = near(gr, y, h); for (let x = 0; x < w; x++) copy(at(x, sy), at(x, y)); }
      }
      // transparentes: copia o vizinho opaco mais próximo
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (d[at(x, y) + 3] > 128) continue;
        let done = false;
        for (let r = 1; r < 8 && !done; r++) for (let dy = -r; dy <= r && !done; dy++) for (let dx = -r; dx <= r && !done; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h || d[at(nx, ny) + 3] <= 128) continue;
          copy(at(nx, ny), at(x, y)); done = true;
        }
        d[at(x, y) + 3] = 255;
      }
      return d;
    };
    // Encosta dos Goblins: chão de terra e cascalho da montanha, rocha cinza (frente à esquerda, topo à direita)
    const moss = this.slope ? clean(read("slope_floor", 40, 60), false) : clean(read("cave_floor_moss"), true);
    const red = this.slope ? clean(read("slope_floor_b", 20, 120), false) : clean(read("cave_floor_red"), true);
    const top = this.slope ? clean(read("slope_rocks", 64, 0), false) : clean(read("cave_rock_top"), true);
    const face = this.slope ? clean(read("slope_rocks", 0, 0), false) : clean(read("cave_wall_front"), false);
    // paleta da água (miolo do cave_water, do escuro ao claro) e da lama (tons marrons do cave_shore)
    const pal = (img, ok) => {
      const set = new Map();
      for (let y = 8; y < img.h - 8; y++) for (let x = 8; x < img.w - 8; x++) {
        const i = (y * img.w + x) * 4; if (img.d[i + 3] < 200 || !ok(img.d[i], img.d[i + 1], img.d[i + 2])) continue;
        set.set((img.d[i] << 16) | (img.d[i + 1] << 8) | img.d[i + 2], [img.d[i], img.d[i + 1], img.d[i + 2]]);
      }
      return [...set.values()].sort((a, b) => (a[0] * 3 + a[1] * 6 + a[2]) - (b[0] * 3 + b[1] * 6 + b[2]));
    };
    let water = pal(read("cave_water"), () => true);
    if (water.length < 3) water = [[10, 30, 40], [16, 48, 60], [24, 70, 84], [60, 140, 160]];
    let mud = pal(read("cave_shore"), (r, g, b) => r > g && r > b + 14);
    if (mud.length < 2) mud = [[60, 44, 30], [92, 68, 44]];
    const pick = (arr, f) => arr[Math.max(0, Math.min(arr.length - 1, Math.floor(f * arr.length)))];
    this._caveTex = { theme, moss, red, top, face, water, foam: water[water.length - 1], mudD: pick(mud, 0.25), mudL: pick(mud, 0.7) };
    return this._caveTex;
  },

  // ruído de valor suave (grade aleatória interpolada), determinístico por andar
  caveNoise(spacing, seed) {
    const W = this.gen.w * T, H = this.gen.h * T, nx = Math.ceil(W / spacing) + 2, ny = Math.ceil(H / spacing) + 2;
    const a = new Float32Array(nx * ny);
    let s = (seed * 2654435761 + this.floorN * 97) >>> 0;
    for (let i = 0; i < a.length; i++) { s = Math.imul(s ^ (s >>> 15), 2246822519) >>> 0; s = (s + 0x6d2b79f5) >>> 0; a[i] = (s % 10000) / 10000; }
    return (x, y) => {
      const fx = Math.abs(x) / spacing, fy = Math.abs(y) / spacing, ix0 = fx | 0, iy0 = fy | 0;
      let tx = fx - ix0, ty = fy - iy0; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      // coordenadas fora da grade (escalas distorcidas) dão a volta, em vez de ler fora do vetor
      const ix = ix0 % (nx - 1), iy = iy0 % (ny - 1);
      const i = iy * nx + ix, a0 = a[i], a1 = a[i + 1], b0 = a[i + nx], b1 = a[i + nx + 1];
      return (a0 + (a1 - a0) * tx) + ((b0 + (b1 - b0) * tx) - (a0 + (a1 - a0) * tx)) * ty;
    };
  },

  // desenha a caverna inteira direto nos pixels dos blocos do chão (blocos de 2 px = pixel art)
  drawCave(rt) {
    const g = this.gen, W = g.w, H = g.h, TX = this.caveTex();
    const S = new Float32Array(W * H), WA = new Float32Array(W * H), D = new Float32Array(W * H);
    const q = [];
    for (let i = 0; i < W * H; i++) { const fl = g.cells[i] >= 1; S[i] = fl ? 0 : 1; WA[i] = g.cells[i] === 2 ? 1 : 0; D[i] = fl ? 0 : -1; if (fl) q.push(i); }
    for (let h = 0; h < q.length; h++) { // distância (em tiles) da rocha até o espaço aberto: a rocha some no escuro
      const v = q[h], x = v % W, y = (v / W) | 0;
      for (const [dx, dy] of DIRS8) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = ny * W + nx; if (D[j] < 0) { D[j] = D[v] + 1; q.push(j); } }
    }
    const field = (F, x, y, out) => {
      const fx = x / T - 0.5, fy = y / T - 0.5, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      const v = (X, Y) => (X < 0 || Y < 0 || X >= W || Y >= H) ? out : F[Y * W + X];
      const a = v(ix, iy), b = v(ix + 1, iy), c = v(ix, iy + 1), d = v(ix + 1, iy + 1);
      return (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty;
    };
    const nA = this.caveNoise(44, 1), nB = this.caveNoise(13, 2), nWx = this.caveNoise(52, 3), nWy = this.caveNoise(52, 4);
    const nR = this.caveNoise(230, 5), nQ = this.caveNoise(30, 6), nRip = this.caveNoise(16, 7), nG = this.caveNoise(7, 8);
    const solidV = (x, y) => field(S, x, y, 1) + (nA(x, y) - 0.5) * 0.36 + (nB(x, y) - 0.5) * 0.14;
    const F = 40; // altura da frente da rocha (px)
    const chunks = rt.chunks.map(c => ({ c, img: c.ctx.createImageData(c.w, c.h) }));
    const chunkOf = (px, py) => chunks.find(o => px >= o.c.cx && py >= o.c.cy && px < o.c.cx + o.c.w && py < o.c.cy + o.c.h);
    const lastOpen = new Int32Array(W * T / 2).fill(1e9); // y do bloco aberto mais próximo abaixo, por coluna
    const texAt = (d, u, v) => (((v & 63) * 64 + (u & 63)) * 4);
    for (let ty = H - 1; ty >= 0; ty--) for (let tx = 0; tx < W; tx++) {
      const ti = ty * W + tx;
      const deep = S[ti] === 1 && (D[ti] < 0 || D[ti] >= 3);
      let mixS = false, mixW = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = tx + dx, Y = ty + dy, j = Y * W + X;
        const s2 = (X < 0 || Y < 0 || X >= W || Y >= H) ? 1 : S[j], w2 = (X < 0 || Y < 0 || X >= W || Y >= H) ? 0 : WA[j];
        if (s2 !== S[ti]) mixS = true;
        if (w2 !== WA[ti]) mixW = true;
      }
      if (deep && !mixS) { for (let bx = 0; bx < T; bx += 2) lastOpen[(tx * T + bx) >> 1] = 1e9; continue; }
      const ch = chunkOf(tx * T, ty * T), data = ch.img.data, cw = ch.c.w;
      let hs = Math.imul(tx * 73856093 ^ ty * 19349663, 2654435761) >>> 0;
      const offX = hs & 63, offY = (hs >>> 8) & 63;
      for (let by = T - 2; by >= 0; by -= 2) for (let bx = 0; bx < T; bx += 2) {
        const x = tx * T + bx + 1, y = ty * T + by + 1, col = (tx * T + bx) >> 1;
        let r, gg, b;
        const sv = mixS ? solidV(x, y) : S[ti];
        if (sv > 0.5) {
          const dOpen = lastOpen[col] - y;
          if (dOpen > 0 && dOpen <= F) {
            // frente da rocha (pedras azuladas), com a base úmida rente ao chão e um friso claro no alto
            const v = Math.max(0, Math.min(63, Math.round(63 - (dOpen - 1) * 63 / F)));
            const i = texAt(TX.face, x, v);
            const k = dOpen > F - 4 ? 1.25 : dOpen < 5 ? 0.7 : 1;
            r = TX.face[i] * k; gg = TX.face[i + 1] * k; b = TX.face[i + 2] * k;
          } else {
            // topo da rocha: escurece conforme se afasta do espaço aberto; contorno escuro na borda
            const u = x + offX + (nWx(x, y) - 0.5) * 14, v = y + offY + (nWy(x, y) - 0.5) * 14, i = texAt(TX.top, u | 0, v | 0);
            const dd = field(D, x, y, 3);
            let k = Math.max(0, Math.min(1, 1.25 - dd * 0.42)) * (0.85 + nB(x, y) * 0.3);
            if (mixS && sv - 0.5 < 0.03) k *= 0.25;
            r = TX.top[i] * k; gg = TX.top[i + 1] * k; b = TX.top[i + 2] * k;
          }
        } else {
          lastOpen[col] = y;
          let wv = (mixW || WA[ti]) ? field(WA, x, y, 0) + (nB(x, y) - 0.5) * 0.3 + (nA(x, y) - 0.5) * 0.22 : 0;
          // o desenho obedece à colisão: casa de água é sempre água; casa andável nunca vira água (no máximo lama na beira)
          wv = WA[ti] ? Math.max(wv, 0.52) : Math.min(wv, 0.48);
          if (wv > 0.5) {
            // lago: paleta da arte da água, mais escuro no fundo, ondulações finas e espuma na margem
            const depth = Math.min(1, (wv - 0.5) * 2.6), qv = nQ(x * 0.7, y * 1.3) * 0.7 + nG(x, y * 2) * 0.3;
            let c = TX.water[Math.max(0, Math.min(TX.water.length - 1, Math.floor((qv * 0.55 + (1 - depth) * 0.45) * (TX.water.length - 1))))];
            if (Math.abs(nRip(x, y * 2.4) - 0.5) < 0.016) c = TX.water[Math.min(TX.water.length - 1, TX.water.length - 2)];
            if (wv - 0.5 < 0.028) c = TX.foam;
            r = c[0]; gg = c[1]; b = c[2];
          } else {
            // chão: musgo com manchas de terra vermelha, textura "derretida" (sem a grade das lajotas)
            // cada tile pega um pedaço diferente da arte (deslocamento aleatório) + leve ondulação: sem repetição em grade
            const u = (x + offX + (nWx(x, y) - 0.5) * 14) | 0, v = (y + offY + (nWy(x, y) - 0.5) * 14) | 0;
            const isRed = nR(x, y) + (nB(x, y) - 0.5) * 0.22 > 0.66;
            const src = isRed ? TX.red : TX.moss, i = texAt(src, u, v);
            let k = 0.8 + nG(x, y) * 0.35;
            if (mixS) { const occ = Math.max(0, Math.min(1, (sv - 0.12) / 0.38)); k *= 1 - 0.6 * occ; } // sombra junto à rocha
            r = src[i] * k; gg = src[i + 1] * k; b = src[i + 2] * k;
            if (wv > 0.43) { const m = wv > 0.47 ? TX.mudD : TX.mudL; r = m[0]; gg = m[1]; b = m[2]; } // lama da margem
          }
        }
        const lx = tx * T + bx - ch.c.cx, ly = ty * T + by - ch.c.cy;
        for (let oy = 0; oy < 2; oy++) for (let ox = 0; ox < 2; ox++) {
          const o = ((ly + oy) * cw + lx + ox) * 4;
          data[o] = r; data[o + 1] = gg; data[o + 2] = b; data[o + 3] = 255;
        }
      }
    }
    for (const o of chunks) { o.c.ctx.putImageData(o.img, 0, 0); o.c.dirty = true; }
  },

  // vizinhos de rocha (4 direções)
  wallsAround(x, y) { let n = 0; for (const [dx, dy] of DIRS4) if (!this.gen.isFloor(x + dx, y + dy)) n++; return n; },

  // decoração plana da caverna: pedrinhas, ossos, ninhos nos cantos e cogumelos que brilham
  caveDecor() {
    if (this.slope) return this.slopeDecor();
    const g = this.gen, rt = this.floorRT;
    const put = (kind, x, y, scale = 1, alpha = 1) => {
      this.decorUsed.add(key(x, y));
      const k = kind.startsWith("cave_") ? kind : "decor_" + kind;
      rt.draw(this.stamp(k).setOrigin(0.5).setScale(scale).setAlpha(alpha), x * T + T / 2 + Phaser.Math.Between(-8, 8), y * T + T / 2 + Phaser.Math.Between(-6, 6));
    };
    const shrooms = rt.gfx();
    for (let i = 0; i < g.rooms.length; i++) {
      const cells = Phaser.Utils.Array.Shuffle(g.roomCells(i, false).filter(c => !this.decorUsed.has(key(c.x, c.y))));
      const wallCells = cells.filter(c => this.wallsAround(c.x, c.y) >= 1);
      const corners = cells.filter(c => this.wallsAround(c.x, c.y) >= 2);
      // densidade: ~70% do chão limpo, ~20% detalhe pequeno, ~10% objetos
      if (corners.length && g.rng() < 0.5 && i > 0) put("rat_nest", corners[0].x, corners[0].y, 0.85);
      for (let k = 0; k < 2 && wallCells.length; k++) { const c = wallCells.pop(); if (!this.decorUsed.has(key(c.x, c.y))) put("cave_rocks", c.x, c.y, 0.55, 0.9); }
      if (g.rng() < 0.45 && wallCells.length) { const c = wallCells.pop(); put("bones", c.x, c.y, 0.85, 0.85); }
      // cogumelos luminosos: a única luz natural da caverna
      if (g.rng() < 0.7 && wallCells.length) {
        const c = wallCells.pop(), px = c.x * T + T / 2 + Phaser.Math.Between(-12, 12), py = c.y * T + T / 2 + Phaser.Math.Between(-8, 10);
        rt.draw(this.stamp("glow_mushrooms").setOrigin(0.5, 1).setScale(Phaser.Math.FloatBetween(0.8, 1.05)).setFlipX(Math.random() < 0.5).setAlpha(1), px, py + 8);
        this.decorUsed.add(key(c.x, c.y));
        this.lights.push({ x: px, y: py - 6, r: 1.6 * T, water: true, tint: 0x3ab8c8, ph: Math.random() * 10 });
      }
    }
  },

  // mobília das câmaras: pedregulhos que bloqueiam, baú, e um acampamento abandonado por andar
  furnishChamber(i, isFar, blocked) {
    if (this.slope) return this.slopeChamber(i, isFar, blocked);
    const g = this.gen;
    const cells = Phaser.Utils.Array.Shuffle(g.roomCells(i, false).filter(c => !blocked(c.x, c.y)));
    const wallCells = cells.filter(c => this.wallsAround(c.x, c.y) >= 1);
    if (this.campRoom === undefined) this.campRoom = i === 0 ? -1 : i;
    if (this.campRoom === i && wallCells.length >= 4) {
      // acampamento de um caçador que não voltou: tocha (luz = caminho), barris e caixa encostados
      const base = wallCells[0];
      this.addProp(base.x, base.y, "torch_stand");
      const near = wallCells.filter(c => Math.abs(c.x - base.x) + Math.abs(c.y - base.y) <= 3 && !(c.x === base.x && c.y === base.y));
      ["barrel", "crate_intact", "barrel"].forEach((k, n) => { if (near[n] && !blocked(near[n].x, near[n].y)) this.addProp(near[n].x, near[n].y, k); });
      return;
    }
    const n = g.rand(0, 2);
    for (let k = 0; k < n && wallCells.length; k++) { const c = wallCells.pop(); if (!blocked(c.x, c.y)) this.addProp(c.x, c.y, "cave_rocks"); }
    if ((isFar || g.rng() < 0.35) && wallCells.length) { const c = wallCells.pop(); if (!blocked(c.x, c.y)) this.addProp(c.x, c.y, "chest_closed"); }
  },

  // Encosta dos Goblins: decoração plana (montes de pedra e ossos junto à rocha)
  slopeDecor() {
    const g = this.gen, rt = this.floorRT;
    const put = (k, x, y, scale = 1, alpha = 1) => { this.decorUsed.add(key(x, y)); rt.draw(this.stamp(k).setOrigin(0.5).setScale(scale).setAlpha(alpha), x * T + T / 2 + Phaser.Math.Between(-8, 8), y * T + T / 2 + Phaser.Math.Between(-6, 6)); };
    for (let i = 0; i < g.rooms.length; i++) {
      const cells = Phaser.Utils.Array.Shuffle(g.roomCells(i, false).filter(c => !this.decorUsed.has(key(c.x, c.y))));
      const wallCells = cells.filter(c => this.wallsAround(c.x, c.y) >= 1);
      for (let k = 0; k < 2 && wallCells.length; k++) { const c = wallCells.pop(); put("cave_rocks", c.x, c.y, 0.55, 0.9); }
      if (g.rng() < 0.5 && wallCells.length) { const c = wallCells.pop(); put("decor_bones", c.x, c.y, 0.85, 0.85); }
    }
  },

  // Encosta: um acampamento goblin por andar (tenda, totem, cavalete de armas, fogueira acesa e paliçada);
  // nas outras clareiras, tocas na rocha, marcos de pedra, estacas e barricadas
  slopeChamber(i, isFar, blocked) {
    const g = this.gen;
    const cells = Phaser.Utils.Array.Shuffle(g.roomCells(i, false).filter(c => !blocked(c.x, c.y)));
    const wallCells = cells.filter(c => this.wallsAround(c.x, c.y) >= 1);
    const open = cells.filter(c => this.wallsAround(c.x, c.y) === 0);
    if (this.campRoom === undefined) this.campRoom = i === 0 ? -1 : i;
    const fire = c => { this.addProp(c.x, c.y, "slope_campfire"); const p = this.cellPos(c.x, c.y); this.lights.push({ x: p.x, y: p.y - 14, r: 4 * T, warm: true, ph: Math.random() * 10 }); this.addDust(p.x, p.y - 10); };
    if (this.campRoom === i && wallCells.length >= 4 && open.length) {
      const base = open[0]; fire(base);
      const near = wallCells.filter(c => Math.abs(c.x - base.x) + Math.abs(c.y - base.y) <= 5);
      ["slope_tent", "slope_totem", "slope_weapon_rack", "slope_palisade", "barrel"].forEach((k, n) => { if (near[n] && !blocked(near[n].x, near[n].y) && !this.props.has(key(near[n].x, near[n].y))) this.addProp(near[n].x, near[n].y, k); });
      return;
    }
    if (wallCells.length && g.rng() < 0.6) { const c = wallCells.pop(); this.addProp(c.x, c.y, "slope_burrow"); }
    const kinds = ["slope_cairn", "slope_stakes", "slope_barricade", "cave_rocks"];
    for (let k = 0, n = g.rand(1, 3); k < n && wallCells.length; k++) { const c = wallCells.pop(); if (!blocked(c.x, c.y)) this.addProp(c.x, c.y, kinds[g.rand(0, kinds.length - 1)]); }
    if (open.length > 6 && g.rng() < 0.35) fire(open[open.length - 1]);
    if ((isFar || g.rng() < 0.35) && wallCells.length) { const c = wallCells.pop(); if (!blocked(c.x, c.y)) this.addProp(c.x, c.y, "chest_closed"); }
  },

  // monstros soltos pelas passagens (longe do início)
  caveMonsters(start) {
    const g = this.gen, d = g.distances(start.x, start.y), cand = [];
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      if (!this.walkable(x, y) || this.occ.has(key(x, y)) || g.roomOf(x, y) >= 0) continue;
      if (d[y * g.w + x] >= 12) cand.push({ x, y });
    }
    Phaser.Utils.Array.Shuffle(cand);
    const n = Math.floor(cand.length / 120) + 2;
    for (let k = 0; k < n && cand.length; k++) { const c = cand.pop(); this.spawnMonster(weighted(this.floorMonsters()), c.x, c.y); }
  },

  // garantia: nenhum objeto que não quebra pode fechar uma passagem
  fixBlockingProps(start) {
    const g = this.gen;
    for (let pass = 0; pass < 6; pass++) {
      const d = g.distances(start.x, start.y, (x, y) => { const p = this.props.get(key(x, y)); return !p || p.kind in BREAKABLE; });
      const bad = [];
      for (const [k, p] of this.props) {
        if (p.kind in BREAKABLE) continue;
        if (DIRS4.some(([dx, dy]) => g.isWalk(p.x + dx, p.y + dy) && !this.props.has(key(p.x + dx, p.y + dy)) && d[(p.y + dy) * g.w + p.x + dx] < 0)) bad.push(k);
      }
      if (!bad.length) return;
      for (const k of bad) { this.props.get(k).spr.destroy(); this.props.delete(k); }
    }
  },
});

// ---------------------------------------------------------------- esgoto (andares 1–2): mesma técnica da caverna
// Depois de montar os tiles de tijolo e pedra, um passe pixel a pixel envelhece o esgoto:
// sujeira em camadas, sombra suave junto às paredes, musgo irregular na base dos tijolos,
// poças com borda orgânica e umidade escura na beira do canal.
Object.assign(DungeonScene.prototype, {
  sewerGrime(rt) {
    const g = this.gen, W = g.w, H = g.h, TX = this.caveTex();
    const S = new Float32Array(W * H), P = new Float32Array(W * H), WET = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      S[i] = g.isFloor(x, y) ? 0 : 1;
      const hs = Math.imul(x * 73856093 ^ y * 19349663, 2654435761) >>> 0;
      // poças: ~4% do chão andável que não é ponte, nem colado no canal
      if (g.isWalk(x, y) && !g.isBridge(x, y) && hs % 100 < 4 && !DIRS4.some(([dx, dy]) => g.isWater(x + dx, y + dy))) P[i] = 1;
      if (g.isWalk(x, y) && DIRS8.some(([dx, dy]) => g.isWater(x + dx, y + dy))) WET[i] = 1;
    }
    const field = (F, x, y, out) => {
      const fx = x / T - 0.5, fy = y / T - 0.5, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      const v = (X, Y) => (X < 0 || Y < 0 || X >= W || Y >= H) ? out : F[Y * W + X];
      const a = v(ix, iy), b = v(ix + 1, iy), c = v(ix, iy + 1), d = v(ix + 1, iy + 1);
      return (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty;
    };
    const nA = this.caveNoise(40, 11), nB = this.caveNoise(12, 12), nG = this.caveNoise(6, 13), nM = this.caveNoise(18, 14);
    const nF = this.caveNoise(26, 15), nR = this.caveNoise(14, 16);
    // distância (tiles) da parede até o espaço aberto: o topo das paredes some no escuro, como na caverna
    const D = new Float32Array(W * H).fill(-1), q = [];
    for (let i = 0; i < W * H; i++) if (!S[i]) { D[i] = 0; q.push(i); }
    for (let h = 0; h < q.length; h++) { const v = q[h], x = v % W, y = (v / W) | 0;
      for (const [dx, dy] of DIRS8) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = ny * W + nx; if (D[j] < 0) { D[j] = D[v] + 1; q.push(j); } } }
    // paleta da água do esgoto (tons verdes da arte water_channel, do escuro ao claro)
    if (!this._sewerPal) {
      const src = this.textures.get("water_channel").getSourceImage(), cv = document.createElement("canvas");
      cv.width = src.width; cv.height = src.height; const cx = cv.getContext("2d"); cx.drawImage(src, 0, 0);
      const dd = cx.getImageData(0, 0, src.width, src.height).data, set = new Map();
      for (let i = 0; i < dd.length; i += 4) if (dd[i + 3] > 200 && dd[i + 1] > dd[i] + 8 && dd[i + 1] >= dd[i + 2]) set.set((dd[i] << 16) | (dd[i + 1] << 8) | dd[i + 2], [dd[i], dd[i + 1], dd[i + 2]]);
      this._sewerPal = [...set.values()].sort((a, b) => (a[0] * 3 + a[1] * 6 + a[2]) - (b[0] * 3 + b[1] * 6 + b[2]));
      if (this._sewerPal.length < 3) this._sewerPal = [[18, 32, 16], [30, 52, 24], [52, 84, 36], [96, 140, 60]];
    }
    const pal = this._sewerPal;
    for (const ch of rt.chunks) {
      const img = ch.ctx.getImageData(0, 0, ch.w, ch.h), data = img.data;
      for (let ly = 0; ly < ch.h; ly += 2) for (let lx = 0; lx < ch.w; lx += 2) {
        const x = ch.cx + lx + 1, y = ch.cy + ly + 1, tx = (x / T) | 0, ty = (y / T) | 0, ti = ty * W + tx;
        const o0 = (ly * ch.w + lx) * 4;
        if (data[o0 + 3] === 0) continue; // vazio
        let k = (0.8 + nG(x, y) * 0.28) * (0.86 + nA(x, y) * 0.24), mr = -1, mg = 0, mb = 0, mix = 0;
        if (!S[ti] && !g.isWater(tx, ty)) {
          // sombra suave e irregular junto às paredes
          const sv = field(S, x, y, 1) + (nB(x, y) - 0.5) * 0.18;
          k *= 1 - 0.55 * Math.max(0, Math.min(1, (sv - 0.1) / 0.4));
          // musgo na base da parede de cima, com franja irregular
          if (S[ti - W] === 1) {
            const into = y - ty * T, reach = 8 + nM(x, y) * 22;
            if (into < reach) { const tI = (((y & 63) * 64 + (x & 63)) * 4); mr = TX.moss[tI]; mg = TX.moss[tI + 1]; mb = TX.moss[tI + 2]; mix = into < reach - 4 ? 0.8 : 0.45; }
          }
          // umidade escura na beira do canal
          if (WET[ti]) k *= 0.82 + nB(x, y) * 0.12;
          // poças com borda orgânica: escuras, com um reflexo na borda
          const pv = field(P, x, y, 0) + (nB(x, y) - 0.5) * 0.35 + (nA(x, y) - 0.5) * 0.2;
          if (pv > 0.5) { k *= 0.42; mr = 30; mg = 46; mb = 44; mix = pv - 0.5 < 0.04 ? 0.15 : 0.35; if (pv - 0.5 < 0.04) k *= 1.9; }
        } else if (S[ti]) {
          k *= 0.92; // tijolo: só sujeira
          // topo de parede (sem chão logo abaixo): escurece com a distância até sumir no breu
          if (!g.isFloor(tx, ty + 1)) k *= Math.max(0, Math.min(1, 1.15 - field(D, x, y, 3) * 0.5));
        }
        // água do canal e das cisternas: superfície redesenhada (sem os anéis repetidos de cada tile),
        // com correnteza alongada no sentido do canal; pedras do meio-fio e tábuas ficam como estão
        let wc = null;
        if (g.isWater(tx, ty) || g.isBridge(tx, ty)) {
          const r0 = data[o0], g0 = data[o0 + 1], b0 = data[o0 + 2];
          if (g0 > r0 + 8 && g0 >= b0) {
            const dir = g.waterDir[ti];
            const f = dir === 1 ? nF(x * 0.35, y * 1.6) : dir === 2 ? nF(x * 1.6, y * 0.35) : nF(x, y);
            const rip = dir === 1 ? nR(x * 0.5, y * 2.2) : dir === 2 ? nR(x * 2.2, y * 0.5) : nR(x * 1.2, y * 1.2);
            let c = pal[Math.max(0, Math.min(pal.length - 1, Math.floor(f * f * 0.75 * pal.length)))];
            if (Math.abs(rip - 0.5) < 0.018) c = pal[Math.floor(pal.length * 0.7)];
            wc = c;
          }
        }
        for (let oy = 0; oy < 2; oy++) for (let ox = 0; ox < 2; ox++) {
          const o = ((ly + oy) * ch.w + lx + ox) * 4;
          let r = (wc ? wc[0] : data[o]) * k, gg = (wc ? wc[1] : data[o + 1]) * k, b = (wc ? wc[2] : data[o + 2]) * k;
          if (mr >= 0) { r = r * (1 - mix) + mr * k * mix; gg = gg * (1 - mix) + mg * k * mix; b = b * (1 - mix) + mb * k * mix; }
          data[o] = r; data[o + 1] = gg; data[o + 2] = b;
        }
      }
      ch.ctx.putImageData(img, 0, 0); ch.dirty = true;
    }
  },
});
