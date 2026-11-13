// Andar: montagem do mapa, chão em canvas, objetos, portas e armadilhas.
// (métodos da DungeonScene, separados por assunto)
Object.assign(DungeonScene.prototype, {

  // ---------------------------------------------------------------- andar
  buildFloor(arrive = "start") {
    // libera as texturas do andar anterior (cada bloco do chão ocupa até 16 MB de vídeo)
    if (this.floorRT) { this.floorRT.destroy(); this.floorRT = null; }
    if (this.world) this.world.destroy(true);
    if (this.ents) this.ents.destroy(true);
    this.world = this.add.layer().setDepth(0);
    this.monsters = []; this.occ = new Map(); this.props = new Map(); this.doors = new Map();
    this.pickups = new Map(); this.spikes = new Map(); this.plates = new Map(); this.clouds = [];
    this.lights = []; this.dusts = []; this.stairs = null; this.campRoom = undefined;
    this.explored = new Uint8Array(this.gen.w * this.gen.h);
    const last = this.floorN === FLOORS;
    if (!this.seeds) this.seeds = {};
    if (this.seeds[this.floorN] == null) this.seeds[this.floorN] = this.bot ? 1234 + this.floorN : (Math.random() * 1e9) | 0;
    this.gen.generate(this.seeds[this.floorN], this.floorN);
    this.explored = new Uint8Array(this.gen.w * this.gen.h);
    const g = this.gen;
    // início: anel da cisterna 0 (o centro é o poço)
    const c0 = g.center(0);
    const start = [[c0.x - 2, c0.y - 2], [c0.x + 2, c0.y - 2], [c0.x - 2, c0.y + 2], [c0.x + 2, c0.y + 2]]
      .map(([x, y]) => ({ x, y })).find(p => g.isWalk(p.x, p.y) && !g.isBridge(p.x, p.y)) || c0;
    const dist = g.distances(start.x, start.y);
    const cellOf = i => { const cs = g.roomCells(i, false); const c = g.center(i); return cs.find(p => p.x === c.x && p.y === c.y) || cs[0] || c; };
    let far = -1, farD = -1;
    for (const want of ["room", "chamber", "cistern"]) {
      for (let i = 1; i < g.rooms.length; i++) {
        if (g.rooms[i].kind !== want) continue;
        const c = cellOf(i), v = dist[c.y * g.w + c.x];
        if (v > farD) { farD = v; far = i; }
      }
      if (far >= 0) break;
    }
    if (far < 0) far = 1;
    this.farRoom = far;

    this.drawStatic();
    this.ents = this.add.layer().setDepth(1); // ordenado por y (setDepth)
    for (const c of g.doors) {
      const r = g.rooms[far];
      const stone = last && c.x >= r.x - 1 && c.x <= r.x + r.w && c.y >= r.y - 1 && c.y <= r.y + r.h;
      this.addDoor(c.x, c.y, stone);
    }
    for (let i = 0; i < g.rooms.length; i++) this.furnish(i, i === 0, i === far, last);
    // tom da luz do ambiente aplicado no herói (caverna esverdeada, esgoto amarronzado)
    this.ambientTint = g.cave ? 0xa8b8a0 : 0xb8b4a6;
    if (g.cave) { this.caveMonsters(start); this.fixBlockingProps(start); }
    this.drawSconces();
    this.waterLights();
    this.drawWallDrains();
    this.tunnelMonsters();
    this.spawnCritters();
    this.groundFog();
    if (!last) {
      // escada fora do canal, na metade de cima da sala mais distante
      const r = g.rooms[far], c = g.center(far);
      const cand = [[c.x, r.y + 1], [c.x + 1, r.y + 1], [c.x - 1, r.y + 1], [c.x, c.y], [c.x - 2, c.y - 2], [c.x + 2, c.y - 2]];
      const ok = ([x, y]) => g.isWalk(x, y) && !g.isBridge(x, y) && !this.spikes.has(key(x, y)) && !this.doorNear(x, y);
      const [sx, sy] = cand.find(ok) || [cellOf(far).x, cellOf(far).y];
      this.stairs = { x: sx, y: sy }; this.clearCell(sx, sy); this.drawStairs();
    }

    // corda de volta para cima (andar 1: sai no bueiro da cidade)
    { const rp = this.cellPos(start.x, start.y);
      const ri = this.add.image(rp.x, rp.y + T / 2 - 4, "rope_v2").setOrigin(0.5, 1).setDepth(rp.y - 40);
      ri.setScale(T * 1.5 / ri.height); this.ents.add(ri); this.rope = { x: start.x, y: start.y }; }
    this.placeAltar(start);
    // herói
    const arr = arrive === "stairs" && this.stairs ? (this.nearStairs() || start) : start;
    this.hero.x = arr.x; this.hero.y = arr.y; this.hero.moveT = 0;
    const p = this.cellPos(start.x, start.y);
    this.hero.shadow = this.add.image(p.x, p.y - 3, "shadow").setScale(0.9, 0.3);
    const ap = this.ap || "kn_", k4 = this.anims.exists(ap + "idle_down");
    this.hero.spr = this.add.sprite(p.x, p.y + 4, ap + "idle_down").setOrigin(0.5, 1).play(ap + "idle_down");
    if (k4) this.hero.spr.setScale(this.heroScale || 0.42);
    this.ents.add([this.hero.shadow, this.hero.spr]);
    this.hero.shadow.setDepth(p.y - 1);
    this.hero.px = p.x; this.hero.py = p.y;

    const cam = this.cameras.main;
    cam.setZoom(this.camZoom());
    cam.setBounds(0, 0, g.w * T, g.h * T);
    this.uiCam.ignore([this.world, this.ents]);
    if (this.glow) this.uiCam.ignore(this.glow);
    cam.startFollow(this.hero.spr, true, 0.35, 0.35, 0, 24); // câmera mais colada no herói (antes atrasava)
    this.floorRT.refresh();
    this.buildDarkness();
    this.updateFlow();
    this.reveal();
    if (this.hudFloor) this.hudFloor.setText(t("floor_display", { name: this.region.name, n: this.floorN, total: FLOORS }));
  },


  // imagem reaproveitada para carimbar na textura do chão (antes criava milhares de objetos por andar)
  stamp(k) {
    this._stamps = this._stamps || {};
    let im = this._stamps[k];
    if (!im || !im.scene) im = this._stamps[k] = this.make.image({ key: k, add: false });
    return im.setOrigin(0.5).clearTint().setAlpha(1).setAngle(0).setFlip(false, false).setScale(1);
  },


  hasTex(k) { return this.textures.exists(k) && this.textures.get(k).key !== "__MISSING" && this.textures.get(k).source[0].width > 32; },


  cellPos(x, y) { return { x: x * T + T / 2, y: y * T + T * 0.82 }; },

  // célula livre ao lado da escada (para quem sobe)
  nearStairs() {
    const s = this.stairs;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const x = s.x + dx, y = s.y + dy;
      if (this.walkable(x, y) && !this.occ.has(key(x, y)) && !this.spikes.has(key(x, y))) return { x, y };
    }
    return null;
  },

  // estátua da Oráculo: aparece em alguns andares, dá uma bênção por estátua (até 3)
  placeAltar(start) {
    this.altar = null; this.altarImg = null;
    if (!this.altarMemo) this.altarMemo = {};
    // o local do altar é sorteado uma vez por corrida e andar (ao voltar ao andar, a estátua continua lá)
    if (this.altarMemo[this.floorN] === undefined) {
      const g = this.gen, n = Save.voc(this.vocId).bless || 0;
      let spot = null;
      if (this.floorN >= 2 && this.floorN < FLOORS && n < 3 && Math.random() <= 0.4) {
        const cands = [];
        for (let y = 1; y < g.h - 1; y++) for (let x = 1; x < g.w - 1; x++) {
          if (!this.walkable(x, y) || this.occ.has(key(x, y)) || this.spikes.has(key(x, y)) || g.isBridge(x, y) || this.doorNear(x, y)) continue;
          // só dentro de salas e com espaço ao redor: a estátua nunca fecha um corredor
          if (g.roomOf(x, y) < 0 || g.roomOf(x, y) === g.roomOf(start.x, start.y)) continue;
          let open = 0; for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]) if (this.walkable(x + dx, y + dy)) open++;
          if (open < 8) continue;
          if (Math.hypot(x - start.x, y - start.y) < 12) continue;
          if (this.stairs && Math.hypot(x - this.stairs.x, y - this.stairs.y) < 4) continue;
          cands.push({ x, y });
        }
        if (cands.length) { const c = Phaser.Utils.Array.GetRandom(cands); spot = { x: c.x, y: c.y, used: false }; }
      }
      this.altarMemo[this.floorN] = spot;
    }
    const a = this.altarMemo[this.floorN];
    if (!a || a.used) return;
    const tex = this.textures.exists("altar_oraculo") ? "altar_oraculo" : "pillar";
    const p = this.cellPos(a.x, a.y);
    const img = this.add.image(p.x, p.y + T / 2 - 4, tex).setOrigin(0.5, 1).setDepth(p.y - 40);
    img.setScale(T * 2 / img.height);
    this.ents.add(img);
    groundShadow(this, img, this.ents, 0.5);
    this.altar = a; this.altarImg = img;
    // luz da deusa: clareia a escuridão em volta, com um halo dourado-pálido pulsando e poeira brilhando sobre a estátua
    this.lights.push({ x: p.x, y: p.y - T * 0.8, r: 3.2 * T, warm: true, ph: Math.random() * 10 });
    const halo = this.add.image(p.x, p.y - T * 0.9, "light").setTint(0xfff0c0).setBlendMode(Phaser.BlendModes.ADD).setScale(1.5, 1.9).setAlpha(0.3).setDepth(img.depth + 1);
    const base = this.add.image(p.x, p.y + T / 2 - 8, "light").setTint(0xffe0a0).setBlendMode(Phaser.BlendModes.ADD).setScale(1.1, 0.4).setAlpha(0.35).setDepth(img.depth - 1);
    this.ents.add([halo, base]);
    this.tweens.add({ targets: [halo, base], alpha: "*=0.6", duration: 2200, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    const motes = this.add.particles(p.x, p.y - T, "light", { x: { min: -22, max: 22 }, y: { min: -50, max: 40 }, lifespan: 2200, speedY: { min: -14, max: -6 },
      scale: { start: 0.014, end: 0.004 }, alpha: { start: 0.9, end: 0 }, tint: 0xfff0c0, frequency: 220, blendMode: "ADD" });
    motes.setDepth(img.depth + 2); this.ents.add(motes);
    img.once("destroy", () => { halo.destroy(); base.destroy(); motes.destroy(); });
    if (a.used) img.setAlpha(0.55);
    this.props.set(key(a.x, a.y), { kind: "altar", spr: img });
  },

  walkable(x, y) { return this.gen.isWalk(x, y) && !this.props.has(key(x, y)); },


  // chão, paredes e decoração plana, desenhados uma vez numa textura
  drawStatic() {
    const g = this.gen;
    const W = g.w * T, H = g.h * T;
    if (this.textures.exists("static_floor")) this.textures.remove("static_floor");
    // chão desenhado em CANVAS 2D (blocos de até 2048 px) e enviado à GPU uma vez só:
    // antes cada carimbo era um desenho na GPU com troca de framebuffer (milhares por andar = loading lento)
    const rt = new FloorCanvas(this, W, H);
    const img = this.stamp("floor").setOrigin(0.5);
    const face = this.stamp("wall_face").setOrigin(0);
    const hash = (x, y) => { let n = (x * 374761393 + y * 668265263) >>> 0; n = Math.imul(n ^ (n >>> 13), 1274126177) >>> 0; return n; };
    if (g.cave) {
      // andares 3–5: caverna orgânica desenhada pixel a pixel (cave.js)
      this.drawCave(rt);
      this.floorRT = rt;
      for (const c of rt.chunks) this.world.add(c.img);
      this.decorFlat();
      return;
    }
    const shade = rt.gfx();
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const px = x * T, py = y * T;
      if (g.isFloor(x, y)) {
        const h = hash(x, y), tone = 0.8 + (h % 100) / 100 * 0.2;
        const c = Math.min(250, Math.round(255 * tone));
        img.setTint(Phaser.Display.Color.GetColor(c, c, Math.min(255, c + 4)));
        rt.draw(img, px + T / 2, py + T / 2);
        if (g.isWater(x, y)) this.drawWater(rt, shade, x, y);
        else if (g.isBridge(x, y)) this.drawBridge(rt, shade, x, y);
        else this.breakerTile(shade, x, y, h);
        continue;
      }
      let near = false;
      for (const [dx, dy] of DIRS8) if (g.isFloor(x + dx, y + dy)) near = true;
      if (!near) continue; // vazio: fica o fundo preto
      // paredes com arte própria (frente de tijolos + topo), se existir
      if (this.hasTex("wall_front") && this.hasTex("wall_top")) {
        const tex = g.isFloor(x, y + 1) ? "wall_front" : "wall_top";
        rt.draw(this.stamp(tex).setOrigin(0).setTint(tex === "wall_top" ? 0xa09ca8 : 0xffffff), px, py);
        if (tex === "wall_front") this.breakerWall(shade, x, y, hash(x, y));
        if (tex === "wall_top") {
          if (g.isFloor(x, y - 1)) shade.fillStyle(0x6a6670, 1).fillRect(px, py, T, 3);
          if (g.isFloor(x - 1, y)) shade.fillStyle(0x56535c, 1).fillRect(px, py, 3, T);
          if (g.isFloor(x + 1, y)) shade.fillStyle(0x56535c, 1).fillRect(px + T - 3, py, 3, T);
        }
        continue;
      }
      // topo da parede: a pedra do chão bem escura
      img.setFlip(false, false).setTint(0x302f36);
      if (g.isFloor(x, y + 1)) {
        rt.draw(img.setCrop(0, 0, T, T / 2), px + T / 2, py + T / 2);
        img.setCrop();
        rt.draw(face, px, py + T / 2);
        shade.fillStyle(0x56535c, 1).fillRect(px, py + T / 2 - 2, T, 2);
      } else {
        rt.draw(img, px + T / 2, py + T / 2);
        if (g.isFloor(x, y - 1)) shade.fillStyle(0x56535c, 1).fillRect(px, py, T, 3);
        if (g.isFloor(x - 1, y)) shade.fillStyle(0x45434c, 1).fillRect(px, py, 3, T);
        if (g.isFloor(x + 1, y)) shade.fillStyle(0x45434c, 1).fillRect(px + T - 3, py, 3, T);
      }
    }
    // sombra de oclusão ao pé das paredes
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      if (!g.isFloor(x, y)) continue;
      if (!g.isFloor(x, y - 1)) shade.fillStyle(0x000000, 0.4).fillRect(x * T, y * T, T, 9);
      if (!g.isFloor(x - 1, y)) shade.fillStyle(0x000000, 0.22).fillRect(x * T, y * T, 6, T);
      if (!g.isFloor(x + 1, y)) shade.fillStyle(0x000000, 0.18).fillRect(x * T + T - 4, y * T, 4, T);
    }
    // musgo acumulado no pé das paredes de tijolos
    for (let y = 1; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      if (!g.isWalk(x, y) || g.isFloor(x, y - 1)) continue;
      const h = hash(x * 7, y * 13);
      for (let k = 0; k < 7; k++) {
        const hx = (h >>> (k * 3)) % (T - 6), hh = 2 + ((h >>> (k * 2)) % 5);
        shade.fillStyle(k % 3 ? 0x3d5a2c : 0x55763a, 0.85).fillRect(x * T + 3 + hx, y * T + 9, 3 + (k % 3), hh);
      }
    }
    this.sewerGrime(rt); // envelhecimento pixel a pixel (cave.js)
    this.floorRT = rt;
    for (const c of rt.chunks) this.world.add(c.img);
    this.decorFlat();
  },


  // detalhes rentes ao chão dos esgotos: grades, lodo, ossos, ninhos, laguinhos
  // ---- água do canal e pontes de grade
  drawWater(rt, gfx, x, y) {
    const g = this.gen, px = x * T, py = y * T, dir = g.waterDir[y * g.w + x];
    if (dir === 3) { // poço da cisterna: mesma água do canal, borda só onde encosta no chão
      if (this.hasTex("water_channel")) {
        if (!this.textures.exists("water_pool")) {
          const src = this.textures.get("water_channel").getSourceImage();
          const ct = this.textures.createCanvas("water_pool", T, T), cx = ct.getContext();
          cx.imageSmoothingEnabled = false;
          const H = src.height, band = Math.round(H * 0.25);
          // metade de cima = faixa de água do canal; metade de baixo = a mesma faixa espelhada
          // (assim a borda de cima e a de baixo são iguais e o poço emenda sem linhas)
          cx.drawImage(src, 0, band, src.width, H - band * 2, 0, 0, T, T / 2);
          cx.save(); cx.translate(0, T); cx.scale(1, -1);
          cx.drawImage(src, 0, band, src.width, H - band * 2, 0, 0, T, T / 2);
          cx.restore();
          ct.refresh();
        }
        rt.draw(this.stamp("water_pool").setOrigin(0.5), px + T / 2, py + T / 2);
      } else gfx.fillStyle(0x23331c, 1).fillRect(px, py, T, T);
      gfx.fillStyle(0x4a4850, 1);
      if (!g.isWater(x, y - 1)) gfx.fillRect(px, py, T, 6);
      if (!g.isWater(x, y + 1)) gfx.fillRect(px, py + T - 6, T, 6);
      if (!g.isWater(x - 1, y)) gfx.fillRect(px, py, 6, T);
      if (!g.isWater(x + 1, y)) gfx.fillRect(px + T - 6, py, 6, T);
      return;
    }
    if (this.hasTex("water_channel")) {
      const im = this.stamp("water_channel").setOrigin(0.5).setAngle(dir === 2 ? 90 : 0);
      rt.draw(im, px + T / 2, py + T / 2);
      // variação: espuma, lodo boiando e manchas escuras quebram a repetição do canal
      let n = (x * 2654435761 + y * 40503) >>> 0;
      const r = () => { n = Math.imul(n ^ (n >>> 15), 2246822519) >>> 0; return (n % 1000) / 1000; };
      if (r() < 0.45) {
        const cnt = 2 + Math.floor(r() * 4);
        for (let k = 0; k < cnt; k++) {
          const ax = px + 8 + r() * (T - 16), ay = py + 18 + r() * (T - 36);
          const w = 2 + Math.floor(r() * 5);
          if (dir === 2) gfx.fillStyle(r() < 0.5 ? 0x9cb070 : 0x1a2414, 0.55).fillRect(ay - py + px, ax - px + py, 2, w);
          else gfx.fillStyle(r() < 0.5 ? 0x9cb070 : 0x1a2414, 0.55).fillRect(ax, ay, w, 2);
        }
      }
      if (r() < 0.18) gfx.fillStyle(0x10160c, 0.45).fillEllipse(px + T / 2 + (r() - 0.5) * 20, py + T / 2, 26, 12);
      return;
    }
    gfx.fillStyle(0x23331c, 1).fillRect(px, py, T, T);
  },


  // variação do chão: rachaduras, musgo, lodo e sujeira (quebra a grade repetida)
  breakerTile(gfx, x, y, seed) {
    const px = x * T, py = y * T, g = this.gen;
    let n = seed >>> 0;
    const r = () => { n = Math.imul(n ^ (n >>> 15), 2246822519) >>> 0; return (n % 1000) / 1000; };
    const v = r();
    if (v < 0.14) { // rachadura
      let cx = px + 10 + r() * (T - 20), cy = py + 10 + r() * (T - 20);
      for (let k = 0; k < 6; k++) { gfx.fillStyle(0x15141a, 0.85).fillRect(cx, cy, 3, 2); cx += 2 + Math.floor(r() * 3); cy += Math.floor(r() * 5) - 2; }
    } else if (v < 0.26) { // lodo / umidade
      gfx.fillStyle(0x1c2414, 0.4).fillEllipse(px + T / 2 + (r() - 0.5) * 24, py + T / 2 + (r() - 0.5) * 24, 30 + r() * 18, 14 + r() * 8);
      gfx.fillStyle(0x3a4a26, 0.35).fillEllipse(px + T / 2 + (r() - 0.5) * 18, py + T / 2 + (r() - 0.5) * 18, 12, 5);
    } else if (v < 0.36) { // sujeira
      for (let k = 0; k < 7; k++) gfx.fillStyle(r() < 0.5 ? 0x2a2218 : 0x1a1612, 0.6).fillRect(px + r() * (T - 4), py + r() * (T - 4), 2 + Math.floor(r() * 3), 2);
    }
    // musgo junto às paredes
    const wallN = !g.isFloor(x, y - 1), wallW = !g.isFloor(x - 1, y), wallE = !g.isFloor(x + 1, y);
    if ((wallN || wallW || wallE) && r() < 0.55) {
      for (let k = 0; k < 9; k++) {
        const mx = wallW ? px + r() * 10 : wallE ? px + T - 12 + r() * 10 : px + r() * (T - 4);
        const my = wallN ? py + 6 + r() * 10 : py + r() * (T - 4);
        gfx.fillStyle([0x2f4a22, 0x3d5e2a, 0x24381a][Math.floor(r() * 3)], 0.75).fillRect(mx, my, 2 + Math.floor(r() * 3), 2);
      }
    }
  },


  // variação da parede de frente: escorridos de umidade e musgo extra
  breakerWall(gfx, x, y, seed) {
    const px = x * T, py = y * T;
    let n = (seed ^ 0x9e3779b9) >>> 0;
    const r = () => { n = Math.imul(n ^ (n >>> 15), 2246822519) >>> 0; return (n % 1000) / 1000; };
    if (r() < 0.35) { const sx = px + 6 + r() * (T - 12); gfx.fillStyle(0x0e1210, 0.35).fillRect(sx, py + 8, 3, 24 + r() * 26); }
    if (r() < 0.3) for (let k = 0; k < 10; k++) gfx.fillStyle(0x34522a, 0.7).fillRect(px + r() * (T - 3), py + T - 10 - r() * 18, 3, 2);
    if (r() < 0.15) gfx.fillStyle(0x0a0a0c, 0.6).fillRect(px + 10 + r() * 30, py + 20 + r() * 20, 6, 3);
  },


  // ponte de tábuas velhas e apodrecidas atravessando o canal
  drawBridge(rt, gfx, x, y) {
    const g = this.gen, px = x * T, py = y * T, dir = g.waterDir[y * g.w + x];
    this.drawWater(rt, gfx, x, y);
    let h = (x * 374761393 + y * 668265263) >>> 0;
    const rnd = () => { h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return (h % 1000) / 1000; };
    const across = dir === 2; // canal vertical: tábuas em pé
    // vigas de apoio por baixo
    gfx.fillStyle(0x2a1d12, 1);
    if (across) { gfx.fillRect(px, py + 10, T, 5); gfx.fillRect(px, py + T - 15, T, 5); }
    else { gfx.fillRect(px + 10, py, 5, T); gfx.fillRect(px + T - 15, py, 5, T); }
    const N = 6, sz = T / N, tones = [0x5e4329, 0x6b4c2f, 0x553b24, 0x4a3420];
    for (let k = 0; k < N; k++) {
      const r1 = rnd();
      if (r1 < 0.1 && k > 0 && k < N - 1) continue;               // tábua faltando: vê-se a água
      const inset = 2 + Math.floor(rnd() * 4), cut = r1 < 0.25 ? Math.floor(rnd() * 14) + 6 : 0; // ponta quebrada
      const c = tones[Math.floor(rnd() * tones.length)];
      const o = k * sz + 1, len = T - inset * 2 - cut, s0 = inset + (rnd() < 0.5 ? cut : 0);
      const R = (a, b, w, hh, col, al = 1) => across ? gfx.fillStyle(col, al).fillRect(px + a, py + b, w, hh) : gfx.fillStyle(col, al).fillRect(px + b, py + a, hh, w);
      // across: tábua vertical (eixo x = posição k); senão horizontal
      if (across) { R(o, s0, sz - 2, len, c); R(o, s0, 2, len, 0x7d5c3a); R(o + sz - 4, s0, 2, len, 0x2f2014); }
      else { R(s0, o, len, sz - 2, c); R(s0, o, len, 2, 0x7d5c3a); R(s0, o + sz - 4, len, 2, 0x2f2014); }
      // veios, podridão verde e pregos
      if (across) { R(o + 4, s0 + 8, 1, len - 16, 0x3b2918); } else { R(s0 + 8, o + 4, len - 16, 1, 0x3b2918); }
      if (rnd() < 0.5) { const m = Math.floor(rnd() * (len - 14)); across ? R(o + 1, s0 + m, sz - 4, 10, 0x3f5a2a, 0.75) : R(s0 + m, o + 1, 10, sz - 4, 0x3f5a2a, 0.75); }
      for (const q of [12, T - 15]) if (q > s0 && q < s0 + len) across ? R(o + 4, q, 2, 2, 0x8a8a8a) : R(q, o + 4, 2, 2, 0x8a8a8a);
    }
  },


  // arandelas: tocha presa na face de tijolos da parede de cima dos túneis
  drawSconces() {
    const g = this.gen;
    this.sconceX = new Set();
    for (const sc of g.sconces) {
      if (g.isFloor(sc.x, sc.y) || !g.isFloor(sc.x, sc.y + 1) || this.doors.has(key(sc.x, sc.y))) continue;
      const img = this.add.image(sc.x * T + T / 2, sc.y * T + T - 4, "torch_stand").setOrigin(0.5, 1).setScale(PROP_H.torch_stand / 60 * 0.85).setDepth(2);
      this.world.add(img); groundShadow(this, img, this.world, 1.3, 0.7);
      this.lights.push({ x: sc.x * T + T / 2, y: sc.y * T + T - 44, r: 3.6 * T, warm: true, ph: Math.random() * 10 });
      this.sconceX.add(key(sc.x, sc.y));
      this.addDust(sc.x * T + T / 2, sc.y * T + T + 10);
    }
  },


  // o lodo do esgoto brilha fraco (luz esverdeada pulsante), um ponto a cada trecho de canal / poço
  waterLights() {
    const g = this.gen;
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      if (!g.isWater(x, y) || (x * 7 + y * 13) % (g.cave ? 11 : 9) !== 0) continue;
      // esgoto: lodo esverdeado; caverna: reflexo azulado do lago
      this.lights.push({ x: x * T + T / 2, y: y * T + T / 2, r: 1.5 * T, water: true, tint: g.cave ? 0x2f7fa8 : 0x5fa040, ph: Math.random() * 10 });
    }
  },


  // decoração plana dos esgotos, seguindo regras: ninhos nos cantos internos, bueiros nos
  // cruzamentos, lodo e ossos rente às paredes — nunca no caminho, em armadilha ou objeto.
  decorFlat() {
    const g = this.gen, rt = this.floorRT;
    this.decorUsed = new Set();
    if (g.cave) { this.caveDecor(); return; }
    const put = (kind, x, y, alpha = 1) => {
      this.decorUsed.add(key(x, y));
      rt.draw(this.stamp("decor_" + kind).setOrigin(0.5).setAlpha(alpha), x * T + T / 2, y * T + T / 2);
    };
    for (let i = 1; i < g.rooms.length; i++) {
      const r = g.rooms[i];
      if (r.kind !== "room") continue;
      const okC = (x, y) => g.isWalk(x, y) && !this.decorUsed.has(key(x, y)) && !r.gap.some(([gx, gy]) => Math.abs(gx - x) + Math.abs(gy - y) <= 1);
      // ninho de ratos num canto de baixo (canto interno de 90°)
      if (g.rng() < 0.6) {
        const cx = g.rng() < 0.5 ? r.x : r.x + r.w - 1, cy = r.y + r.h - 1;
        if (okC(cx, cy)) put("rat_nest", cx, cy);
      }
      // lodo e ossos encostados na parede de baixo
      for (let k = 0; k < 2; k++) {
        const x = g.rand(r.x + 1, r.x + r.w - 2), y = r.y + r.h - 1;
        if (okC(x, y)) put(k ? "bones" : "sludge", x, y, 0.9);
      }
      // poça no chão da sala, esqueleto perto da parede de cima, pilha de caixas num canto de cima
      if (g.rng() < 0.35) { const x = g.rand(r.x + 1, r.x + r.w - 2), y = g.rand(r.y + 1, r.y + r.h - 2); if (okC(x, y)) put("pool", x, y, 0.85); }
      if (g.rng() < 0.22) { const x = g.rand(r.x + 1, r.x + r.w - 2); if (okC(x, r.y)) put("skeleton", x, r.y); }
      if (g.rng() < 0.3) { const cx = g.rng() < 0.5 ? r.x : r.x + r.w - 1; if (okC(cx, r.y)) put("crate_pile", cx, r.y); }
    }
    // bueiros redondos na passarela de baixo dos túneis, longe das pontes e das salas
    for (const t of g.tunnels) {
      const len = t.h ? t.x1 - t.x0 : t.y1 - t.y0;
      if (len < 8) continue;
      const m = t.h ? (t.x0 + t.x1) >> 1 : (t.y0 + t.y1) >> 1;
      const x = t.h ? m : t.c + 2, y = t.h ? t.c + 2 : m;
      let bad = false;
      for (const [dx, dy] of DIRS8) if (g.isBridge(x + dx, y + dy) || g.isBridge(x, y) || (g.isWalk(x + dx, y + dy) && g.roomOf(x + dx, y + dy) >= 0 && g.rooms[g.roomOf(x + dx, y + dy)].kind === "room")) bad = true;
      if (!bad && g.isWalk(x, y)) put(g.rng() < 0.5 ? "manhole" : "grate", x, y);
    }
  },


  drawStairs() {
    const s = this.stairs;
    const img = this.add.image(s.x * T, s.y * T, "stairs").setOrigin(0).setDepth(2);
    this.world.add(img);
    this.stairsGfx = img;
    this.drawMinimap();
  },


  furnish(i, isStart, isFar, last) {
    const g = this.gen, r = g.rooms[i];
    const nearGap = (x, y) => r.gap && r.gap.some(([gx, gy]) => Math.abs(gx - x) <= 1 && Math.abs(gy - y) <= 1);
    const blocked = (x, y) => this.props.has(key(x, y)) || this.decorUsed.has(key(x, y)) || !g.isWalk(x, y) || g.isBridge(x, y) || nearGap(x, y);
    if (isStart) return;
    if (r.kind === "chamber") this.furnishChamber(i, isFar, blocked);
    if (r.kind === "room") {
      // tocha no fundo da sala, só se a parede de cima for de tijolo (sem a passagem)
      const tx = r.x + (r.w >> 1);
      if (!g.isFloor(tx, r.y - 1) && !blocked(tx, r.y)) this.addProp(tx, r.y, "torch_stand");
      // um monte de objetos AGRUPADOS numa parede lateral
      const kinds = ["barrel", "crate_intact", "barrel", "crate_intact", "pot", "urn"];
      const left = g.rng() < 0.5, x = left ? r.x : r.x + r.w - 1;
      const y0 = r.y + 1 + (r.h > 4 ? g.rand(0, 1) : 0);
      for (let y = y0; y < y0 + g.rand(2, 3) && y < r.y + r.h; y++) if (!blocked(x, y)) this.addProp(x, y, kinds[g.rand(0, kinds.length - 1)]);
      // baú no canto de cima oposto
      const bx = left ? r.x + r.w - 1 : r.x;
      if ((g.rng() < 0.45 || isFar) && !blocked(bx, r.y)) this.addProp(bx, r.y, "chest_closed");
      // armadilha: par de espinhos no meio da sala, ou respiradouro de gás com placa
      if (!isFar && g.rng() < 0.4 && r.w >= 6) {
        const cy = r.y + (r.h >> 1), cx = r.x + (r.w >> 1);
        for (const x2 of [cx - 1, cx]) if (!blocked(x2, cy)) this.addSpike(x2, cy);
      } else if (!isFar && g.rng() < 0.3 && !g.isFloor(tx + 1, r.y - 1)) {
        const vx = tx + 1;
        if (!blocked(vx, r.y)) {
          this.floorRT.draw(this.stamp("gas_vent").setOrigin(0.5), vx * T + T / 2, r.y * T + T / 2);
          this.decorUsed.add(key(vx, r.y));
          const py = Math.min(r.y + r.h - 1, r.y + 2);
          if (!blocked(vx, py)) { this.plates.set(key(vx, py), { x: vx, y: r.y }); this.drawPlate(vx, py); }
        }
      }
    }
    // monstros
    const free = Phaser.Utils.Array.Shuffle(g.roomCells(i, false).filter(c => !blocked(c.x, c.y) && !this.occ.has(key(c.x, c.y)) && !this.spikes.has(key(c.x, c.y)) && !this.plates.has(key(c.x, c.y))));
    if (last && isFar) {
      const c = g.center(i);
      const spot = free.slice().sort((a, b) => (Math.abs(a.x - c.x) + Math.abs(a.y - c.y)) - (Math.abs(b.x - c.x) + Math.abs(b.y - c.y)))[0];
      if (spot) { free.splice(free.indexOf(spot), 1); this.spawnMonster("giant_rat", spot.x, spot.y); }
      for (let k = 0; k < 2 && free.length; k++) { const f = free.pop(); this.spawnMonster("cave_rat", f.x, f.y); }
      return;
    }
    const count = r.kind === "room" ? 1 + Math.ceil(this.floorN / 2) + g.rand(0, 1)
      : r.kind === "chamber" ? 1 + Math.ceil(this.floorN / 3) + g.rand(0, 1) : g.rand(1, 2);
    for (let k = 0; k < count && free.length; k++) { const f = free.pop(); this.spawnMonster(weighted(FLOOR_MONSTERS[this.floorN]), f.x, f.y); }
  },


  // saídas de esgoto gradeadas nas paredes de tijolo do fundo, com fio de lodo escorrendo
  drawWallDrains() {
    const rt = this.floorRT;
    const gfx = this.floorRT.gfx();
    for (const d of this.gen.drains) {
      if (this.gen.isFloor(d.x, d.y) || !this.gen.isFloor(d.x, d.y + 1) || (this.sconceX && this.sconceX.has(key(d.x, d.y)))) continue;
      const px = d.x * T, py = d.y * T;
      if (this.hasTex("wall_drain")) { rt.draw(this.stamp("wall_drain").setOrigin(0), px, py); continue; }
      gfx.fillStyle(0x0a090c, 1).fillRect(px + 14, py + 22, T - 28, 26);
      gfx.lineStyle(2, 0x6a5040, 1).strokeRect(px + 14, py + 22, T - 28, 26);
      for (let k = 1; k < 4; k++) gfx.fillStyle(0x7a6050, 1).fillRect(px + 14 + k * (T - 28) / 4 - 1, py + 22, 3, 26);
      gfx.fillStyle(0x4f7a2c, 0.9).fillRect(px + T / 2 - 3, py + 48, 6, 16);
      gfx.fillStyle(0x4f7a2c, 0.6).fillEllipse(px + T / 2, py + T + 6, 26, 10);
    }
    rt.draw(gfx);
  },


  // ratos de ambiente (não atacam): correm rente à parede de baixo e fogem do herói
  spawnCritters() {
    if (!this.anims.exists("am_rat")) return;
    this.critters = [];
    const g = this.gen;
    for (let i = 1; i < g.rooms.length; i++) {
      if (g.rooms[i].kind !== "room" || g.rng() > 0.55) continue;
      const r = g.rooms[i], y = r.y + r.h - 1;
      for (let k = 0; k < g.rand(1, 3); k++) {
        const x0 = r.x * T + 10, x1 = (r.x + r.w) * T - 10;
        const c = this.add.sprite(Phaser.Math.Between(x0, x1), y * T + T - 10, "am_rat").setScale(0.55).setOrigin(0.5, 1).setAlpha(0.9).play("am_rat");
        c.setDepth(c.y);
        this.ents.add(c);
        const run = () => {
          if (!c.active) return;
          const tx = Phaser.Math.Between(x0, x1);
          c.setFlipX(tx < c.x);
          this.tweens.add({ targets: c, x: tx, duration: Math.abs(tx - c.x) * 9 + 200, onComplete: () => this.time.delayedCall(Phaser.Math.Between(800, 4000), run) });
        };
        this.time.delayedCall(Phaser.Math.Between(0, 3000), run);
      }
    }
  },


  // névoa verde tóxica rastejando rente ao chão (abaixo dos personagens, opacidade baixa)
  groundFog() {
    const g = this.gen;
    for (let i = 0; i < g.rooms.length; i++) {
      const r = g.rooms[i];
      for (let k = 0; k < 2; k++) {
        const f = this.add.image((r.x + g.rng() * r.w) * T, (r.y + r.h * (0.4 + g.rng() * 0.5)) * T, "light")
          .setScale(Phaser.Math.FloatBetween(2.4, 3.6), Phaser.Math.FloatBetween(0.5, 0.8)).setTint(g.cave ? 0x4a7a9a : 0x6fae4a).setAlpha(0.07).setBlendMode(Phaser.BlendModes.ADD);
        this.world.add(f);
        this.tweens.add({ targets: f, x: f.x + Phaser.Math.Between(-90, 90), alpha: 0.12, duration: Phaser.Math.Between(5000, 9000), yoyo: true, repeat: -1, ease: "Sine.inOut" });
      }
    }
  },


  doorNear(x, y) { for (const [dx, dy] of DIRS8) if (this.doors.has(key(x + dx, y + dy))) return true; return false; },


  // placa de pressão: base de ferro bem visível
  // placa de pressão: laje de pedra levemente solta (antes parecia uma poça)
  drawPlate(x, y) {
    const g = this.floorRT.gfx(), px = x * T, py = y * T;
    g.fillStyle(0x000000, 0.45).fillRect(px + 10, py + 12, T - 20, T - 20);
    g.fillStyle(0x6a6670, 1).fillRect(px + 12, py + 12, T - 24, T - 26);
    g.fillStyle(0x86828c, 1).fillRect(px + 12, py + 12, T - 24, 3);
    g.fillStyle(0x4a4750, 1).fillRect(px + 12, py + T - 17, T - 24, 3);
    g.lineStyle(1, 0x3a3840, 1).strokeRect(px + 18, py + 18, T - 36, T - 38);
    this.floorRT.draw(g);
    g.destroy();
  },


  clearCell(x, y) {
    const k = key(x, y);
    if (this.props.has(k)) { this.props.get(k).spr.destroy(); this.props.delete(k); }
    if (this.occ.has(k)) { const m = this.occ.get(k); m.spr.destroy(); m.shadow.destroy(); m.bar.destroy(); this.monsters = this.monsters.filter(o => o !== m); this.occ.delete(k); }
  },


  addProp(x, y, kind) {
    const k = key(x, y);
    if (this.props.has(k)) return;
    const p = this.cellPos(x, y);
    const spr = this.add.image(p.x, p.y + 4, kind).setOrigin(0.5, 1).setDepth(p.y);
    if (PROP_H[kind]) spr.setScale(PROP_H[kind] / spr.height);
    this.ents.add(spr);
    groundShadow(this, spr, this.ents, kind === "torch_stand" ? 1.4 : 0.9);
    const pr = { kind, spr, hits: 0, x, y };
    this.props.set(k, pr);
    if (kind === "torch_stand") { this.lights.push({ x: p.x, y: p.y - 38, r: 3.6 * T, warm: true, ph: Math.random() * 10 }); this.addDust(p.x, p.y - 20); }
  },


  addSpike(x, y) {
    const px = x * T, py = y * T, gfx = this.add.graphics().setDepth(1);
    gfx.fillStyle(0x1c1b20, 1).fillRect(px + 3, py + 3, T - 6, T - 6);
    gfx.lineStyle(2, 0x8a6a3a, 1).strokeRect(px + 4, py + 4, T - 8, T - 8);       // borda de ferro enferrujado
    for (const [rx, ry] of [[8, 8], [T - 10, 8], [8, T - 10], [T - 10, T - 10]]) gfx.fillStyle(0x9a8a6a, 1).fillRect(px + rx, py + ry, 3, 3);
    for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) gfx.fillStyle(0x050406, 1).fillRect(px + 16 + k * 14, py + 16 + j * 14, 4, 4); // furos
    const warn = this.add.rectangle(px + T / 2, py + T / 2, T - 8, T - 8, 0xc03020, 0).setDepth(1.5);
    const spr = this.add.image(px + T / 2, py + T / 2, "spikes_extended").setDepth(2).setVisible(false);
    this.world.add([gfx, warn, spr]);
    this.spikes.set(key(x, y), { spr, warn, up: false });
  },


  addDoor(x, y, stone) {
    // a porta fica DENTRO da parede: tijolos atrás, mesma altura do tile, base no chão da sala
    if (this.hasTex("wall_front") && this.hasTex("wall_top")) this.floorRT.draw(this.stamp("wall_front").setOrigin(0), x * T, y * T);
    const spr = this.add.image(x * T + T / 2, y * T + T, stone ? "door_stone_closed" : "door_wood_closed").setOrigin(0.5, 1);
    spr.setScale(T / spr.height).setDepth(5);
    this.world.add(spr);
    this.doors.set(key(x, y), { open: false, spr, stone });
  },


  openDoor(x, y) {
    const d = this.doors.get(key(x, y));
    if (!d || d.open) return false;
    d.open = true;
    // vão aberto mostra o chão (a arte "_floor" tem o miolo escuro transparente)
    this.floorRT.draw(this.stamp("floor").setTint(0xd8d8dc), x * T + T / 2, y * T + T / 2);
    const k = d.stone ? "door_stone_open" : "door_wood_open";
    d.spr.setTexture(this.textures.exists(k + "_floor") ? k + "_floor" : k);
    this.floorRT.refresh();
    sfx(this, "chest", 0.25);
    return true;
  },


  isClosedDoor(x, y) { const d = this.doors.get(key(x, y)); return d && !d.open; },


  // ---------------------------------------------------------------- armadilhas
  updateTraps(dt) {
    this.spikeT += dt;
    const up = (this.spikeT % 2.6) > 1.7;
    const h = this.hero;
    for (const [k, s] of this.spikes) {
      if (s.up !== up) { s.up = up; s.spr.setVisible(up); }
      // aviso: a chapa pisca em vermelho 0,5 s antes dos espinhos subirem
      const ph = this.spikeT % 2.6;
      s.warn.setFillStyle(0xc03020, up ? 0 : (ph > 1.2 ? 0.25 + 0.2 * Math.sin(this.time_ * 30) : 0));
      if (!up) continue;
      const x = k % 1000, y = Math.floor(k / 1000);
      if (h.x === x && h.y === y && h.moveT <= 0 && this.time_ - (h.spikeHit || -9) > 1) { h.spikeHit = this.time_; this.hurtHero(12); }
      const m = this.occ.get(k);
      if (m && !m.fly && this.time_ - (m.spikeHit || -9) > 1) { m.spikeHit = this.time_; this.damageMonster(m, 10); }
    }
    for (const cl of this.clouds.slice()) {
      cl.t -= dt; cl.tick -= dt;
      cl.gfx.setAlpha(Phaser.Math.Clamp(cl.t, 0, 1));
      cl.gfx.rotation += dt * 0.4;
      if (cl.tick <= 0) {
        cl.tick = 0.5;
        for (const [dx, dy] of [[0, 0], ...DIRS8]) {
          const x = cl.x + dx, y = cl.y + dy;
          if (h.x === x && h.y === y) this.hurtHero(6);
          const m = this.occ.get(key(x, y)); if (m) this.damageMonster(m, 6);
        }
      }
      if (cl.t <= 0) { cl.gfx.destroy(); this.clouds.splice(this.clouds.indexOf(cl), 1); }
    }
  },


  triggerVent(vent) {
    this.msg(t("gas_trap"));
    sfx(this, "explode", 0.2);
    const g = this.add.graphics({ x: vent.x * T + T / 2, y: vent.y * T + T / 2 }).setDepth(150000);
    for (let k = 0; k < 10; k++) g.fillStyle(0x6fbf3a, 0.2).fillCircle(Phaser.Math.Between(-T, T), Phaser.Math.Between(-T, T), Phaser.Math.Between(18, 30));
    this.ents.add(g);
    this.clouds.push({ x: vent.x, y: vent.y, t: 4, tick: 0, gfx: g });
  },
});

// ---------------------------------------------------------------- chão em canvas
let FLOOR_SEQ = 0;
class FloorCanvas {
  constructor(scene, W, H) {
    this.scene = scene; this.chunks = []; this.tintCache = new Map();
    const nx = Math.ceil(W / 2048), ny = Math.ceil(H / 2048);
    const CW = Math.ceil(W / nx / 64) * 64, CH = Math.ceil(H / ny / 64) * 64, seq = ++FLOOR_SEQ;
    for (let cy = 0; cy < H; cy += CH) for (let cx = 0; cx < W; cx += CW) {
      const key = `floorc_${seq}_${this.chunks.length}`;
      const tex = scene.textures.createCanvas(key, Math.min(CW, W - cx), Math.min(CH, H - cy));
      const ctx = tex.getContext(); ctx.imageSmoothingEnabled = false;
      const img = scene.add.image(cx, cy, key).setOrigin(0);
      this.chunks.push({ cx, cy, w: tex.width, h: tex.height, tex, ctx, img, dirty: true });
    }
  }
  each(x0, y0, x1, y1, fn) {
    for (const c of this.chunks) {
      if (x1 < c.cx || y1 < c.cy || x0 > c.cx + c.w || y0 > c.cy + c.h) continue;
      c.dirty = true; c.ctx.save(); c.ctx.translate(-c.cx, -c.cy); fn(c.ctx); c.ctx.restore();
    }
  }
  tinted(src, fr, tint) {
    const k = fr.texture.key + "|" + fr.name + "|" + tint;
    let cv = this.tintCache.get(k);
    if (!cv) {
      cv = document.createElement("canvas"); cv.width = fr.cutWidth; cv.height = fr.cutHeight;
      const x = cv.getContext("2d"); x.imageSmoothingEnabled = false;
      x.drawImage(src, fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight, 0, 0, fr.cutWidth, fr.cutHeight);
      x.globalCompositeOperation = "multiply"; x.fillStyle = "#" + tint.toString(16).padStart(6, "0"); x.fillRect(0, 0, cv.width, cv.height);
      x.globalCompositeOperation = "destination-in"; x.drawImage(src, fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight, 0, 0, fr.cutWidth, fr.cutHeight);
      this.tintCache.set(k, cv);
    }
    return cv;
  }
  // carimba uma Image do Phaser (origem, escala, giro, espelho, alpha e tint)
  draw(o, x, y) {
    if (!o || o.isRec || !o.frame) return this;
    const fr = o.frame, src = fr.source.image, tint = o.tintTopLeft !== undefined ? o.tintTopLeft & 0xffffff : 0xffffff;
    const w = fr.cutWidth, h = fr.cutHeight, sx = o.scaleX * (o.flipX ? -1 : 1), sy = o.scaleY * (o.flipY ? -1 : 1);
    const r = Math.max(w * Math.abs(o.scaleX), h * Math.abs(o.scaleY)) + 4;
    const img = tint !== 0xffffff ? this.tinted(src, fr, tint) : null;
    this.each(x - r, y - r, x + r, y + r, ctx => {
      ctx.translate(x, y); if (o.rotation) ctx.rotate(o.rotation); ctx.scale(sx, sy); ctx.globalAlpha = o.alpha;
      const dx = -o.originX * w, dy = -o.originY * h;
      if (img) ctx.drawImage(img, dx, dy); else ctx.drawImage(src, fr.cutX, fr.cutY, w, h, dx, dy, w, h);
    });
    return this;
  }
  // "Graphics" que desenha direto no canvas (mesma API usada pelo jogo)
  gfx() {
    const self = this, col = (c, a) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a === undefined ? 1 : a})`;
    const st = { fill: "#000", line: "#000", lw: 1 };
    const g = {
      isRec: true,
      fillStyle(c, a) { st.fill = col(c, a); return g; },
      lineStyle(w, c, a) { st.lw = w; st.line = col(c, a); return g; },
      fillRect(x, y, w, h) { self.each(x, y, x + w, y + h, ctx => { ctx.fillStyle = st.fill; ctx.fillRect(x, y, w, h); }); return g; },
      strokeRect(x, y, w, h) { self.each(x - 4, y - 4, x + w + 4, y + h + 4, ctx => { ctx.strokeStyle = st.line; ctx.lineWidth = st.lw; ctx.strokeRect(x, y, w, h); }); return g; },
      fillEllipse(x, y, w, h) { self.each(x - w, y - h, x + w, y + h, ctx => { ctx.fillStyle = st.fill; ctx.beginPath(); ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill(); }); return g; },
      clear() { return g; }, destroy() {},
    };
    return g;
  }
  refresh() { for (const c of this.chunks) if (c.dirty) { c.tex.refresh(); c.dirty = false; } }
  destroy() {
    for (const c of this.chunks) { c.img.destroy(); if (this.scene.textures.exists(c.tex.key)) this.scene.textures.remove(c.tex.key); }
    this.chunks = []; this.tintCache.clear();
  }
}
