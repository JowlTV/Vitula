// Protótipo survivors-like do Vitula (Rook Forest). Descartável: não importa nada de src/ e o jogo não importa daqui.
// Pergunta: o combate do Vitula fica divertido como survivors-like (movimento livre, ataques automáticos, hordas, melhorias)?
const W = 960, H = 540, A = "../../assets/";
const ICON = { slash: "slash", front: "icon_front_v2", quake: "icon_area", aura: "icon_aura_v2", arrow: "icon_basic", holy: "spear", volley: "icon_area", missile: "berserk" };
// passivas com arte própria (equipamentos e itens do Vitula), para não confundir com as habilidades
const PICON = { might: "eq:fire_sword", haste: "eq:goddess_pendant", vigor: "eq:golden_armor", swift: "eq:dragon_boots", magnet: "art:i_blue_gem", regen: "heal", crit: "eq:crystal_sword" };
const TOUCH = /iPhone|iPad|Android/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
const fs_ = n => Math.round(TOUCH ? n * 1.45 : n) + "px";   // celular: texto ≥ 14 px reais na tela
const EMPTY = [];
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = tbl => { let t = 0; for (const [, w] of tbl) t += w; let r = Math.random() * t; for (const [k, w] of tbl) if ((r -= w) <= 0) return k; return tbl[0][0]; };
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const TXT = { fontFamily: "Alegreya, serif", color: "#e8dcc0", stroke: "#0c0608", strokeThickness: 4, resolution: 2 };
// a interface é desenhada em coordenadas 960×540; o canvas é 1920×1080 (câmera com zoom 2, como no Vitula)
const UIX = W / 2, UIY = H / 2;
const sf0 = o => { o.setScrollFactor(0); if (o.list) o.list.forEach(sf0); return o; };   // filhos também: senão o clique erra a carta

class Boot extends Phaser.Scene {
  constructor() { super("boot"); }
  preload() {
    const L = this.load;
    for (const p of ["kn_", "ar_"]) for (const d of ["down", "up", "side"]) {
      const f = p === "ar_" ? (d === "up" ? 198 : 200) : 192;
      for (const a of ["idle", "walk"]) L.spritesheet(p + a + "_" + d, `${A}art/${p}${a}_${d}.png`, { frameWidth: f, frameHeight: f });
    }
    for (const p of ["kn_", "ar_"]) L.spritesheet(p + "death", `${A}art/${p}death.png`, { frameWidth: p === "ar_" ? 200 : 192, frameHeight: p === "ar_" ? 200 : 192 });
    L.spritesheet("am_rat", A + "art/am_rat_walk_v2.png", { frameWidth: 70, frameHeight: 70 });
    L.spritesheet("am_rat_death", A + "art/am_rat_death.png", { frameWidth: 70, frameHeight: 70 });
    L.spritesheet("am_bat", A + "art/am_bat_fly_v2.png", { frameWidth: 92, frameHeight: 92 });
    L.spritesheet("am_bat_death", A + "art/am_bat_death.png", { frameWidth: 92, frameHeight: 92 });
    L.spritesheet("am_cave_rat", A + "art/am_cave_rat.png", { frameWidth: 70, frameHeight: 70 });
    L.spritesheet("am_cave_rat_death", A + "art/am_cave_rat_death.png", { frameWidth: 70, frameHeight: 70 });
    L.spritesheet("am_giant_rat", A + "art/am_giant_rat.png", { frameWidth: 108, frameHeight: 108 });
    L.spritesheet("am_giant_rat_death", A + "art/am_giant_rat_death.png", { frameWidth: 108, frameHeight: 108 });
    L.spritesheet("fx_basic_slash", A + "art/fx_basic_slash.png", { frameWidth: 72, frameHeight: 72 });
    L.spritesheet("fx_front_cut", A + "art/fx_front_cut.png", { frameWidth: 230, frameHeight: 230 });
    L.spritesheet("fx_ring_wave", A + "art/fx_ring_wave.png", { frameWidth: 214, frameHeight: 214 });
    L.spritesheet("aura", A + "fx/aura.png", { frameWidth: 144, frameHeight: 144 });
    L.spritesheet("fx_volley", A + "art/fx_volley.png", { frameWidth: 124, frameHeight: 139 });
    L.spritesheet("fx_holy_arrow", A + "art/fx_holy_arrow.png", { frameWidth: 80, frameHeight: 91 });
    L.spritesheet("pfx_arrow", A + "fx/pfx_arrow.png", { frameWidth: 112, frameHeight: 32 });
    L.spritesheet("pfx_hit", A + "fx/pfx_hit.png", { frameWidth: 136, frameHeight: 80 });
    L.spritesheet("pfx_crit", A + "fx/pfx_crit.png", { frameWidth: 216, frameHeight: 136 });
    for (const k of ["forest_floor", "forest_floor_b", "forest_bush", "forest_stump", "forest_log", "forest_deadtree", "forest_mushrooms", "forest_rocks", "torch_stand", "i_blue_gem", "i_red_gem", "i_meat", "carriage_wreck"]) L.image(k, `${A}art/${k}.png`);
    for (const k of new Set([...Object.values(ICON), ...Object.values(PICON)])) L.image("ic_" + k, k.startsWith("eq:") ? `${A}equip/${k.slice(3)}.png` : k.startsWith("art:") ? `${A}art/${k.slice(4)}.png` : `${A}icons/${k}.png`);
    L.image("portrait_knight", A + "ui/portrait_knight.png"); L.image("portrait_archer", A + "ui/portrait_archer.png");
    L.audio("hit", A + "audio/hit.wav"); L.audio("gem", A + "audio/gem.wav"); L.audio("levelup", A + "audio/levelup.wav"); L.audio("hurt", A + "audio/hurt.wav"); L.audio("boss", A + "audio/boss.wav"); L.audio("explode", A + "audio/explode.wav");
  }
  create() {
    const an = (key, tex, rate, rep = -1, frames) => this.anims.create({ key, frames: this.anims.generateFrameNumbers(tex, frames || {}), frameRate: rate, repeat: rep });
    for (const p of ["kn_", "ar_"]) for (const d of ["down", "up", "side"]) { an(p + "idle_" + d, p + "idle_" + d, 6); an(p + "walk_" + d, p + "walk_" + d, 12); }
    for (const p of ["kn_", "ar_"]) an(p + "death", p + "death", 9, 0);
    for (const m of ["rat", "bat", "cave_rat", "giant_rat"]) { an("w_" + m, "am_" + m, m === "bat" ? 12 : 10); an("d_" + m, "am_" + m + "_death", 11, 0); }
    an("fx_basic_slash", "fx_basic_slash", 18, 0, { start: 0, end: 3 }); an("fx_front_cut", "fx_front_cut", 20, 0, { start: 0, end: 6 });
    // ring_wave: o último quadro tem borrões cinzas soltos → só 0-4. holy: 0-2 é o voo, 3-7 é o impacto (antes o voo tocava o impacto em loop)
    an("fx_ring_wave", "fx_ring_wave", 18, 0, { start: 0, end: 4 }); an("aura", "aura", 8); an("fx_volley", "fx_volley", 12, 0);
    an("fx_holy_arrow", "fx_holy_arrow", 14, -1, { start: 0, end: 2 }); an("holy_hit", "fx_holy_arrow", 18, 0, { start: 3, end: 7 });
    an("pfx_arrow", "pfx_arrow", 30); an("pfx_hit", "pfx_hit", 30, 0); an("pfx_crit", "pfx_crit", 30, 0);
    const q = new URLSearchParams(location.search);
    if (q.get("voc")) this.scene.start("play", { voc: q.get("voc") }); else this.scene.start("pick");
  }
}

// ------------------------------------------------------------ escolha do herói
class Pick extends Phaser.Scene {
  constructor() { super("pick"); }
  create() {
    this.cameras.main.setBackgroundColor("#0b0a0e").setZoom(2).centerOn(W / 2, H / 2);
    this.add.tileSprite(0, 0, W, H, "forest_floor").setOrigin(0).setAlpha(0.35);
    this.add.text(W / 2, 60, "Vitula · Rook Forest (protótipo survivors)", { ...TXT, fontSize: fs_(28), color: "#e0bc60" }).setOrigin(0.5);
    this.add.text(W / 2, 98, "Sobreviva 10 minutos. Os ataques são automáticos: você só anda.", { ...TXT, fontSize: fs_(15) }).setOrigin(0.5);
    [["knight", "Cavaleiro", "Corte, Golpe Frontal, Terremoto e Aura Sagrada. Muita vida."], ["archer", "Arqueiro", "Flechas, Flecha Sagrada, Saraivada e Míssil Sagrado. Mais rápido."]].forEach(([id, n, d], i) => {
      const x = W / 2 + (i ? 150 : -150);
      const r = this.add.rectangle(x, 290, 260, 300, 0x1a1214).setStrokeStyle(2, 0x8a6a3a).setInteractive({ useHandCursor: true });
      this.add.image(x, 220, "portrait_" + id).setDisplaySize(120, 120).setFlipX(id === "archer");
      this.add.text(x, 300, n, { ...TXT, fontSize: fs_(24), color: "#e0bc60" }).setOrigin(0.5);
      this.add.text(x, 360, d, { ...TXT, fontSize: fs_(14), wordWrap: { width: 220 }, align: "center" }).setOrigin(0.5);
      r.on("pointerover", () => r.setStrokeStyle(3, 0xe0bc60)).on("pointerout", () => r.setStrokeStyle(2, 0x8a6a3a));
      r.on("pointerup", () => this.scene.start("play", { voc: id }));
    });
    this.add.text(W / 2, 500, "WASD/setas ou o analógico na tela · Esc pausa", { ...TXT, fontSize: fs_(13), color: "#9a8f80" }).setOrigin(0.5);
  }
}

// ------------------------------------------------------------ partida
class Play extends Phaser.Scene {
  constructor() { super("play"); }
  create(data) {
    const voc = this.voc = data.voc === "archer" ? "archer" : "knight", HC = CFG.hero[voc];
    this.t = 0; this.paused = false; this.over = false; this.kills = 0; this.dmgDone = {};
    this.stats = { maxHp: HC.hp, hp: HC.hp, speed: HC.speed, regen: HC.regen, pickup: HC.pickup, armor: HC.armor, dmg: 1, cd: 1, area: 1, crit: CFG.baseCrit };
    this.level = 1; this.xp = 0; this.need = this.xpNeed(1);
    this.weapons = {}; this.passives = {};
    this.addWeapon(voc === "knight" ? "slash" : "arrow");
    this.mons = []; this.gems = []; this.shots = []; this.heals = [];
    this.spawnAcc = 0; this.nextWave = CFG.spawn.waveEvery; this.nextElite = CFG.elite.every; this.bossDone = false;
    this.lastHit = -9;
    // floresta: chão em mosaico (acompanha a vista) + mata fechada, clareiras e trilhas (map.js)
    this.ground = this.add.tileSprite(0, 0, W + 128, H + 128, "forest_floor").setOrigin(0).setDepth(-1000).setTint(0xb8c0a8);
    const start = MAP.build(this);
    this.torches = this.map.torches;
    // herói
    const ap = this.ap = voc === "archer" ? "ar_" : "kn_";
    this.hero = this.add.sprite(start.x, start.y, ap + "idle_down").setOrigin(0.5, 0.92).setScale(voc === "archer" ? 0.43 : 0.47).play(ap + "idle_down");
    this.heroShadow = this.add.ellipse(0, 0, 40, 12, 0x000000, 0.4);
    this.face = { x: 1, y: 0, dir: "side", left: false };
    this.cameras.main.setZoom(2).startFollow(this.hero, true, 0.15, 0.15).setBackgroundColor("#0e120c").setBounds(0, 0, MW * MT, MH * MT);
    MAP.flow(this.map, this.hero.x, this.hero.y);
    // escuridão: véu com furo de luz no herói e nas tochas
    this.dark = this.add.renderTexture(UIX, UIY, W, H).setOrigin(0).setScrollFactor(0).setDepth(900000);
    this.lightBrush = this.make.graphics({ add: false });
    { const g = this.make.graphics({ add: false }); for (let r = 128; r > 0; r -= 4) g.fillStyle(0xffffff, 0.05).fillCircle(128, 128, r); g.generateTexture("glow", 256, 256); g.destroy(); }
    this.rain = this.add.particles(UIX, UIY, "glow", { x: { min: -40, max: W + 80 }, y: -20, lifespan: 900, speedY: { min: 520, max: 680 }, speedX: { min: -90, max: -60 }, scaleX: 0.006, scaleY: 0.06, alpha: { start: 0.45, end: 0.2 }, tint: 0xb4c4dc, quantity: 2, frequency: 14 }).setScrollFactor(0).setDepth(900001);
    this.buildHud();
    // entrada
    const K = this.input.keyboard;
    this.keys = K.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,ESC,P");
    this.keys.ESC.on("down", () => this.togglePause()); this.keys.P.on("down", () => this.togglePause());
    this.stick = null;
    this.input.on("pointerdown", p => { if (this.paused || this.over || this.choosing) return; this.stick = { id: p.id, x: p.x / 2, y: p.y / 2, dx: 0, dy: 0 }; this.stickG.setVisible(true).setPosition(UIX + p.x / 2, UIY + p.y / 2); });
    this.input.on("pointermove", p => { const s = this.stick; if (!s || s.id !== p.id) return; let dx = p.x / 2 - s.x, dy = p.y / 2 - s.y; const l = Math.hypot(dx, dy); if (l > 50) { dx *= 50 / l; dy *= 50 / l; } s.dx = dx / 50; s.dy = dy / 50; this.knob.setPosition(dx, dy); });
    this.input.on("pointerup", p => { if (this.stick && this.stick.id === p.id) { this.stick = null; this.stickG.setVisible(false); this.knob.setPosition(0, 0); } });
    this.bot = new URLSearchParams(location.search).has("bot");
    window.__proto = this;
  }
  xpNeed(n) { return Math.round(CFG.xp.first + CFG.xp.step * Math.pow(n - 1, CFG.xp.power)); }

  // ---------------------------------------------------------- interface
  buildHud() {
    const ui = this.ui = this.add.container(UIX, UIY).setScrollFactor(0).setDepth(1e6);
    ui.add(this.add.image(30, 30, "portrait_" + this.voc).setDisplaySize(44, 44));
    this.hpBar = this.add.rectangle(58, 18, 180, 12, 0xa8202c).setOrigin(0); ui.add([this.add.rectangle(58, 18, 180, 12, 0x140e10).setOrigin(0).setStrokeStyle(1, 0x5a4630), this.hpBar]);
    this.hpT = this.add.text(62, 16, "", { ...TXT, fontSize: fs_(11) }); ui.add(this.hpT);
    this.xpBar = this.add.rectangle(0, 0, 0, 8, 0x5aa0e0).setOrigin(0); ui.add([this.add.rectangle(0, 0, W, 8, 0x101418).setOrigin(0), this.xpBar]);
    this.lvT = this.add.text(58, TOUCH ? 32 : 34, "", { ...TXT, fontSize: fs_(13), color: "#e0bc60" }); ui.add(this.lvT);
    ui.add(this.add.rectangle(W / 2, 30, 110, 40, 0x0c0908, 0.6).setStrokeStyle(1, 0x5a4630));
    this.timeT = this.add.text(W / 2, 16, "", { ...TXT, fontSize: fs_(24), color: "#f0e0b0" }).setOrigin(0.5, 0); ui.add(this.timeT);
    this.killT = this.add.text(W - 14, 16, "", { ...TXT, fontSize: fs_(13) }).setOrigin(1, 0); ui.add(this.killT);
    this.wepRow = this.add.container(14, 60); ui.add(this.wepRow);
    this.msgT = this.add.text(W / 2, 70, "", { ...TXT, fontSize: fs_(16), color: "#ffd870" }).setOrigin(0.5).setAlpha(0); ui.add(this.msgT);
    this.stickG = this.add.container(UIX, UIY).setScrollFactor(0).setDepth(1e6 + 1).setVisible(false);
    this.stickG.add(this.add.circle(0, 0, 56, 0xffffff, 0.08).setStrokeStyle(2, 0xffffff, 0.25)); this.knob = this.add.circle(0, 0, 22, 0xe8d8b0, 0.35); this.stickG.add(this.knob);
    this.bossBar = this.add.container(W / 2, H - 30).setVisible(false); ui.add(this.bossBar);
    this.bossFill = this.add.rectangle(-200, 0, 400, 10, 0xc03020).setOrigin(0, 0.5);
    this.bossBar.add([this.add.rectangle(0, 0, 404, 14, 0x140e10).setStrokeStyle(1, 0x8a6a3a), this.bossFill, this.add.text(0, -18, "Rato Gigante", { ...TXT, fontSize: fs_(13), color: "#ff9080" }).setOrigin(0.5)]);
    sf0(ui); sf0(this.stickG);
    this.refreshWeapons();
  }
  refreshWeapons() {
    this.wepRow.removeAll(true); let x = 0;
    for (const id in this.weapons) { this.wepRow.add([this.add.rectangle(x, 0, 30, 30, 0x1a1214).setOrigin(0).setStrokeStyle(1, 0x8a6a3a), this.add.image(x + 15, 15, "ic_" + ICON[id]).setDisplaySize(26, 26), this.add.text(x + 28, 20, this.weapons[id].lv, { ...TXT, fontSize: fs_(11) }).setOrigin(1, 0)]); x += 34; }
    x += 8;
    for (const id in this.passives) { this.wepRow.add([this.add.rectangle(x, 4, 22, 22, 0x14181a).setOrigin(0).setStrokeStyle(1, 0x5a7a8a), this.add.image(x + 11, 15, "ic_" + PICON[id]).setDisplaySize(18, 18), this.add.text(x + 21, 18, this.passives[id], { ...TXT, fontSize: fs_(10) }).setOrigin(1, 0)]); x += 26; }
    sf0(this.wepRow);
  }
  msg(s) { this.msgT.setText(s).setAlpha(1); this.tweens.killTweensOf(this.msgT); this.tweens.add({ targets: this.msgT, alpha: 0, delay: 2200, duration: 800 }); }
  // números de dano: pool fixo de 48 textos reaproveitados (antes: 1 Text novo por golpe)
  floatNum(x, y, n, crit) {
    const P = this.numPool || (this.numPool = []);
    let t = P.find(o => !o.visible);
    if (!t) { if (P.length >= 48) { if (!crit) return; t = P[(this.numI = ((this.numI || 0) + 1) % P.length)]; this.tweens.killTweensOf(t); }
      else { t = this.add.text(0, 0, "", { ...TXT, fontSize: "12px", strokeThickness: 3 }).setOrigin(0.5).setDepth(800000); P.push(t); } }
    t.setText(Math.round(n)).setFontSize(crit ? 17 : 12).setColor(crit ? "#ffd84a" : "#ffffff").setPosition(x + rnd(-6, 6), y).setAlpha(1).setVisible(true);
    this.tweens.add({ targets: t, y: y - 24, alpha: 0, duration: 650, onComplete: () => t.setVisible(false) });
  }

  // ---------------------------------------------------------- armas e melhorias
  addWeapon(id) { this.weapons[id] = { lv: 1, t: 0.3 }; if (id === "aura") this.auraFx = null; }
  wv(id, k) { const w = this.weapons[id], L = CFG.weaponLevel, B = CFG.weapons[id]; const n = w.lv - 1;
    if (k === "dmg") return B.dmg * (B.flatDmg ? 1 : 1 + L.dmg * n) * this.stats.dmg * CFG.dmgMult;
    if (k === "cd") return B.cd * Math.max(L.cdFloor, Math.pow(1 - L.cd, n)) * this.stats.cd;
    if (k === "area") return (1 + L.area * n) * this.stats.area; }
  offers() {
    const out = [], have = Object.keys(this.weapons);
    for (const id in CFG.weapons) { const B = CFG.weapons[id]; if (B.voc !== this.voc) continue;
      if (!have.includes(id)) { if (have.length < 4) out.push({ kind: "new", id, name: B.name, desc: "Nova habilidade", icon: ICON[id] }); }
      else out.push({ kind: "up", id, name: `${B.name} ${this.weapons[id].lv + 1}`, desc: this.upDesc(id, this.weapons[id].lv + 1), icon: ICON[id] }); }
    for (const id in CFG.passives) { const P = CFG.passives[id], n = this.passives[id] || 0; if (!P.max || n < P.max) out.push({ kind: "passive", id, name: `${P.name} ${n + 1}`, desc: P.desc, icon: PICON[id] }); }
    Phaser.Utils.Array.Shuffle(out);
    // uma arma nova sempre aparece enquanto houver vaga (o jogador monta a build)
    const ni = out.findIndex(o => o.kind === "new"); if (ni > 0 && Math.random() < 0.7) { const [o] = out.splice(ni, 1); out.unshift(o); }
    return out.slice(0, CFG.choices);
  }
  upDesc(id, lv) {
    if (id === "missile") return `+1 projétil (${lv} por rajada), −8% de recarga`;
    if (id === "arrow" && CFG.shots(id, lv) > CFG.shots(id, lv - 1)) return `+1 flecha por disparo, +22% de dano, −8% de recarga`;
    if (id === "holy") return "+22% de dano, −8% de recarga, atravessa +1 inimigo";
    return "+22% de dano, −8% de recarga, +10% de área";
  }
  apply(o) {
    if (o.kind === "new") this.addWeapon(o.id);
    else if (o.kind === "up") this.weapons[o.id].lv++;
    else { const P = CFG.passives[o.id], s = this.stats; this.passives[o.id] = (this.passives[o.id] || 0) + 1;
      if (P.dmg) s.dmg += P.dmg; if (P.cd) s.cd *= 1 - P.cd; if (P.speed) s.speed *= 1 + P.speed; if (P.pickup) s.pickup *= 1 + P.pickup; if (P.regen) s.regen += P.regen; if (P.crit) s.crit += P.crit;
      if (P.hp) { const add = s.maxHp * P.hp; s.maxHp += add; s.hp = Math.min(s.maxHp, s.hp + add); } }
    this.refreshWeapons();
  }
  levelUp() {
    this.choosing = true; this.physicsPause(true); this.sound.play("levelup", { volume: 0.4 });
    const c = this.add.container(UIX, UIY).setScrollFactor(0).setDepth(2e6); this.chooseBox = c;
    c.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.65).setOrigin(0));
    c.add(this.add.text(W / 2, 92, `Nível ${this.level}!`, { ...TXT, fontSize: fs_(30), color: "#e0bc60" }).setOrigin(0.5));
    c.add(this.add.text(W / 2, 126, TOUCH ? "Toque numa melhoria" : "Escolha uma melhoria (1, 2, 3 ou clique)", { ...TXT, fontSize: fs_(14), color: "#9a8f80" }).setOrigin(0.5));
    const opts = this.offers(), cw = 240, x0 = W / 2 - (opts.length * (cw + 16) - 16) / 2;
    const choose = i => { if (!this.chooseBox || !opts[i]) return; this.apply(opts[i]); c.destroy(); this.chooseBox = null; this.choosing = false; this.physicsPause(false); this.input.keyboard.off("keydown", kh); };
    opts.forEach((o, i) => {
      const x = x0 + i * (cw + 16), col = o.kind === "new" ? 0xe0bc60 : o.kind === "up" ? 0x9fd08a : 0x8ab8e8;
      const r = this.add.rectangle(x, 160, cw, 240, 0x1a1214, 0.96).setOrigin(0).setStrokeStyle(2, col).setInteractive({ useHandCursor: true });
      r.on("pointerover", () => r.setStrokeStyle(4, col)).on("pointerout", () => r.setStrokeStyle(2, col)).on("pointerup", () => this.time.delayedCall(1, () => choose(i)));   // fora do evento: destruir a carta dentro do próprio clique travava os cliques seguintes
      c.add([r, this.add.rectangle(x + cw / 2, 222, 72, 72, 0x0c0a08).setStrokeStyle(1, col), this.add.image(x + cw / 2, 222, "ic_" + o.icon).setDisplaySize(62, 62),
        this.add.text(x + 14, 168, String(i + 1), { ...TXT, fontSize: fs_(14), color: "#9a8f80" }),
        this.add.text(x + cw / 2, 282, o.kind === "new" ? "NOVA" : o.kind === "up" ? "MELHORAR" : "PASSIVA", { ...TXT, fontSize: fs_(11), color: Phaser.Display.Color.IntegerToColor(col).rgba }).setOrigin(0.5),
        this.add.text(x + cw / 2, 304, o.name, { ...TXT, fontSize: fs_(18), color: "#f0e0b0" }).setOrigin(0.5),
        this.add.text(x + cw / 2, 340, o.desc, { ...TXT, fontSize: fs_(13), wordWrap: { width: cw - 24 }, align: "center" }).setOrigin(0.5, 0)]);
    });
    sf0(c);
    const kh = ev => { const n = parseInt(ev.key, 10); if (n >= 1 && n <= opts.length) choose(n - 1); };
    this.input.keyboard.on("keydown", kh);
    if (this.bot) this.time.delayedCall(50, () => choose(0));
  }
  physicsPause(on) { this.anims.globalTimeScale = on ? 0 : 1; this.tweens.timeScale = on ? 0 : 1; }
  togglePause() {
    if (this.over || this.choosing) return;
    this.paused = !this.paused; this.physicsPause(this.paused);
    if (this.paused) { this.pauseBox = this.add.container(UIX, UIY).setScrollFactor(0).setDepth(2e6);
      this.pauseBox.add([this.add.rectangle(0, 0, W, H, 0x000000, 0.6).setOrigin(0), this.add.text(W / 2, H / 2 - 20, "Pausa", { ...TXT, fontSize: fs_(32), color: "#e0bc60" }).setOrigin(0.5),
        this.add.text(W / 2, H / 2 + 20, "Esc continua", { ...TXT, fontSize: fs_(14) }).setOrigin(0.5)]); sf0(this.pauseBox); }
    else if (this.pauseBox) { this.pauseBox.destroy(); this.pauseBox = null; }
  }

  // ---------------------------------------------------------- monstros
  spawn(kind, x, y, elite) {
    const M = CFG.monsters[kind], k = kind === "giant_rat", grow = 1 + CFG.hpGrowth * this.t;
    let hp = k ? M.hp * CFG.bossHpMult * grow / 4 : M.hp * CFG.hpMult * grow;
    if (elite) hp *= CFG.elite.hpMult;
    const s = this.add.sprite(x, y, "am_" + kind).setOrigin(0.5, 0.85).play({ key: "w_" + kind, startFrame: (Math.random() * 6) | 0 }).setScale(M.scale * (elite ? CFG.elite.scale : 1));
    if (elite) s.setTint(0xff9a8a);
    const m = { kind, s, x, y, hp, max: hp, dmg: M.dmg * CFG.dmgMult * (1 + CFG.dmgGrowth * this.t) * (elite ? 1.6 : 1), speed: M.speed * rnd(0.9, 1.1), xp: elite ? CFG.elite.xp : M.xp, r: k ? 34 : elite ? 20 : 13, elite: !!elite, boss: k, fly: kind === "bat", hitT: 0, flash: 0, slow: 0 };
    this.mons.push(m); return m;
  }
  spawner(dt) {
    const S = CFG.spawn, alive = this.mons.length;
    const rate = S.base + S.perMin * this.t / 60;
    this.spawnAcc += rate * dt;
    const mix = S.mix.filter(([t0]) => this.t >= t0).pop()[1];
    while (this.spawnAcc >= 1) { this.spawnAcc--; if (alive >= S.cap) break;
      const p = MAP.spawnPoint(this.map, this.hero.x, this.hero.y, S.ringMin, S.ringMax); if (p) this.spawn(pick(mix), p[0], p[1]); }
    if (this.t >= this.nextWave) { this.nextWave += S.waveEvery;
      for (let i = 0; i < S.waveSize + this.t / 30; i++) { const p = MAP.spawnPoint(this.map, this.hero.x, this.hero.y, 480, 620); if (p) this.spawn(pick(mix), p[0], p[1]); }
      this.msg("Uma horda cerca você!"); }
    if (this.t >= this.nextElite) { this.nextElite += CFG.elite.every; const p = MAP.spawnPoint(this.map, this.hero.x, this.hero.y, 520, 640); if (p) this.spawn(pick(mix), p[0], p[1], true); this.msg("Um campeão se aproxima!"); }
    if (!this.bossDone && !this.boss && this.t >= CFG.run.bossAt) { const bp = MAP.spawnPoint(this.map, this.hero.x, this.hero.y, 520, 700) || [this.hero.x + 300, this.hero.y]; this.boss = this.spawn("giant_rat", bp[0], bp[1]); this.bossBar.setVisible(true); this.sound.play("boss", { volume: 0.5 }); this.msg("O Rato Gigante sai da mata!"); this.cameras.main.shake(400, 0.006); }
  }
  hurtMon(m, dmg, src) {
    if (m.dead) return;
    const crit = Math.random() < this.stats.crit; if (crit) dmg *= CFG.critMult;
    m.hp -= dmg; m.flash = 0.12; this.dmgDone[src] = (this.dmgDone[src] || 0) + Math.min(dmg, m.hp + dmg);
    this.floatNum(m.x, m.y - 30 * m.s.scaleY / 0.6, dmg, crit);
    if (crit && this.time.now - (this.critFxT || 0) > 90) { this.critFxT = this.time.now; const f = this.add.sprite(m.x, m.y - 10, "pfx_crit").play("pfx_crit").setScale(0.45).setDepth(m.y + 5); f.once("animationcomplete", () => f.destroy()); }
    if (m.hp <= 0) this.kill(m);
  }
  kill(m) {
    m.dead = true; this.kills++;
    m.s.play("d_" + m.kind).setDepth(m.y - 40); m.s.clearTint(); this.tweens.add({ targets: m.s, alpha: 0, delay: 600, duration: 400, onComplete: () => m.s.destroy() });
    this.dropGem(m.x, m.y, m.xp);
    if (Math.random() < CFG.drops.heal) { const h = this.add.image(m.x, m.y, "i_meat").setDepth(m.y); this.heals.push({ x: m.x, y: m.y, s: h }); }
    if (m.boss) { this.boss = null; this.bossDone = true; this.bossBar.setVisible(false); this.msg("O Rato Gigante caiu! Sobreviva até o fim."); this.sound.play("boss", { volume: 0.5 }); for (let i = 0; i < 20; i++) this.dropGem(m.x + rnd(-80, 80), m.y + rnd(-60, 60), 5); }
  }
  dropGem(x, y, v) {
    if (this.gems.length > CFG.xp.gemMerge) { const g = this.gems[(Math.random() * this.gems.length) | 0]; g.v += v; g.s.setScale(Math.min(2, 1 + g.v / 20)); return; }
    const s = this.add.image(x, y, v >= 5 ? "i_red_gem" : "i_blue_gem").setDepth(y - 1).setScale(v >= 5 ? 1.2 : 1);
    this.gems.push({ x, y, v, s, pull: false });
  }

  // ---------------------------------------------------------- laço
  update(_, dtMs) {
    // ?speed=N (teste): N passos de simulação por quadro, para ver a partida inteira rápido
    const n = this.speedN || (this.speedN = +new URLSearchParams(location.search).get("speed") || 1);
    for (let i = 0; i < n; i++) this.step(Math.min(0.05, dtMs / 1000));
  }
  step(dt) {
    if (this.paused || this.choosing || this.over) return;
    this.t += dt;
    const st = this.stats;
    // movimento livre (8 direções analógicas)
    let mx = 0, my = 0; const k = this.keys;
    if (k.A.isDown || k.LEFT.isDown) mx -= 1; if (k.D.isDown || k.RIGHT.isDown) mx += 1; if (k.W.isDown || k.UP.isDown) my -= 1; if (k.S.isDown || k.DOWN.isDown) my += 1;
    if (this.stick) { mx = this.stick.dx; my = this.stick.dy; }
    if (this.bot) [mx, my] = this.botMove();
    const l = Math.hypot(mx, my);
    if (l > 0.1) { mx /= Math.max(1, l); my /= Math.max(1, l);
      [this.hero.x, this.hero.y] = MAP.move(this.map, this.hero.x, this.hero.y, this.hero.x + mx * st.speed * dt, this.hero.y + my * st.speed * dt, 14, true);
      this.face = { x: mx, y: my, dir: Math.abs(mx) >= Math.abs(my) ? "side" : my < 0 ? "up" : "down", left: Math.abs(mx) >= Math.abs(my) ? mx < 0 : this.face.left }; }
    const an = this.ap + (l > 0.1 ? "walk_" : "idle_") + this.face.dir;
    if (this.hero.anims.currentAnim.key !== an) this.hero.play(an, true);
    this.hero.setFlipX(this.face.dir === "side" && this.face.left).setDepth(this.hero.y);
    this.heroShadow.setPosition(this.hero.x, this.hero.y - 4).setDepth(this.hero.y - 1);
    { const wv = this.cameras.main.worldView; const gx = Math.floor(wv.x / 64) * 64 - 64, gy = Math.floor(wv.y / 64) * 64 - 64; this.ground.setPosition(gx, gy); this.ground.tilePositionX = gx; this.ground.tilePositionY = gy; }
    this.flowT = (this.flowT || 0) - dt; if (this.flowT <= 0) { this.flowT = 0.2; MAP.flow(this.map, this.hero.x, this.hero.y); }
    st.hp = Math.min(st.maxHp, st.hp + st.regen * dt);
    this.spawner(dt);
    this.moveMonsters(dt);
    this.fireWeapons(dt);
    this.moveShots(dt);
    this.pickups(dt);
    this.drawDark();
    this.refreshHud();
    if (this.t >= CFG.run.length) this.end(true);
  }
  botMove() {   // teste automático: foge do monstro mais perto e pega gemas
    let ax = 0, ay = 0;
    for (const m of this.mons) { const dx = this.hero.x - m.x, dy = this.hero.y - m.y, d = Math.hypot(dx, dy) || 1; if (d < 220) { ax += dx / d / d * 80; ay += dy / d / d * 80; } }
    let g = null, gd = 1e9; for (const o of this.gems) { const d = Math.hypot(o.x - this.hero.x, o.y - this.hero.y); if (d < gd) { gd = d; g = o; } }
    if (g && gd < 500) { const dx = g.x - this.hero.x, dy = g.y - this.hero.y, d = gd || 1; ax += dx / d * 0.8; ay += dy / d * 0.8; }
    if (Math.hypot(ax, ay) < 0.2) { ax = Math.cos(this.t * 0.7); ay = Math.sin(this.t * 0.5); }
    return [ax, ay];
  }
  moveMonsters(dt) {
    const hx = this.hero.x, hy = this.hero.y - 10, st = this.stats;
    // separação barata por grade (evita que a horda vire um ponto só)
    // chave numérica e baldes reaproveitados (sem strings nem arrays novos por quadro)
    const cell = 40, grid = this.grid || (this.grid = new Map()), K = (gx, gy) => (gx + 4096) * 8192 + (gy + 4096);
    for (const b of grid.values()) b.length = 0;
    for (const m of this.mons) { if (m.dead) continue; const k = K((m.x / cell) | 0, (m.y / cell) | 0); let b = grid.get(k); if (!b) grid.set(k, b = []); b.push(m); }
    if (grid.size > 3000) grid.clear();
    const wv = this.cameras.main.worldView, vx0 = wv.x - 80, vy0 = wv.y - 80, vx1 = wv.x + W + 80, vy1 = wv.y + H + 80;
    for (const m of this.mons) {
      if (m.dead) continue;
      let dx = hx - m.x, dy = hy - m.y; const d = Math.hypot(dx, dy) || 1;
      const sp = m.speed * (m.slow > 0 ? 0.5 : 1); m.slow -= dt;
      let vx = dx / d * sp, vy = dy / d * sp;
      if (!m.fly && d > MT * 1.5) { const f = MAP.steer(this.map, m.x, m.y); if (f) { vx = f[0] * sp; vy = f[1] * sp; } }
      const gx = (m.x / cell) | 0, gy = (m.y / cell) | 0;
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) for (const o of grid.get(K(gx + ox, gy + oy)) || EMPTY) {
        if (o === m) continue; const ex = m.x - o.x, ey = m.y - o.y, e = Math.hypot(ex, ey) || 1, min = m.r + o.r;
        if (e < min) { vx += ex / e * (min - e) * 6; vy += ey / e * (min - e) * 6; }
      }
      if (m.fly) { m.x += vx * dt; m.y += vy * dt; } else [m.x, m.y] = MAP.move(this.map, m.x, m.y, m.x + vx * dt, m.y + vy * dt, Math.min(m.r, 20), false);
      // fora da tela: só posição (sem depth/tint/flip) e invisível
      const on = m.boss || (m.x > vx0 && m.x < vx1 && m.y > vy0 && m.y < vy1);
      m.s.x = m.x; m.s.y = m.y; if (m.s.visible !== on) m.s.setVisible(on);
      m.flash -= dt;
      if (on) { m.s.depth = m.y; m.s.flipX = dx < 0; const ts = m.flash > 0 ? 1 : m.elite ? 2 : 0;
        if (ts !== m.ts) { m.ts = ts; if (ts === 1) m.s.setTintFill(0xffffff); else if (ts === 2) m.s.setTint(0xff9a8a); else m.s.clearTint(); } }
      // contato: morde se encostar
      m.hitT -= dt;
      if (d < m.r + 16 && m.hitT <= 0 && this.t - this.lastHit > CFG.hero.iframes) {
        m.hitT = 0.8; this.lastHit = this.t;
        const dmg = Math.max(1, m.dmg - st.armor); st.hp -= dmg; this.sound.play("hurt", { volume: 0.25 });
        this.hero.setTint(0xff9090); this.time.delayedCall(120, () => this.hero.clearTint());
        if (st.hp <= 0) return this.end(false);
      }
      if (d > 1500 && !m.boss) { const p = MAP.spawnPoint(this.map, hx, hy, 560, 700); if (p) [m.x, m.y] = p; }   // ficou muito para trás: reaparece perto, em lugar livre
    }
    let j = 0; for (let i = 0; i < this.mons.length; i++) if (!this.mons[i].dead) this.mons[j++] = this.mons[i]; this.mons.length = j;
    if (this.boss) this.bossFill.setSize(400 * Math.max(0, this.boss.hp / this.boss.max), 10);
  }
  nearest(maxD = 9999, from = this.hero) {
    let best = null, bd = maxD;
    for (const m of this.mons) { if (m.dead) continue; const d = Math.hypot(m.x - from.x, m.y - from.y); if (d < bd) { bd = d; best = m; } }
    return best;
  }
  fireWeapons(dt) {
    for (const id in this.weapons) {
      const w = this.weapons[id]; w.t -= dt;
      if (id === "aura") this.auraTick(w);
      if (w.t > 0) continue;
      const B = CFG.weapons[id], dmg = this.wv(id, "dmg"), area = this.wv(id, "area"), h = this.hero;
      if (id === "slash") { const t = this.nearest(B.range * area + 30); if (!t) { w.t = 0.15; continue; }
        const ang = Math.atan2(t.y - h.y, t.x - h.x);
        const f = this.add.sprite(h.x + Math.cos(ang) * 46, h.y - 20 + Math.sin(ang) * 40, "fx_basic_slash").play("fx_basic_slash").setRotation(ang).setScale(1.3 * area).setDepth(h.y + 50); f.once("animationcomplete", () => f.destroy());
        for (const m of this.mons) { if (m.dead) continue; const dx = m.x - h.x, dy = m.y - h.y, d = Math.hypot(dx, dy); if (d < B.range * area && Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - ang)) < B.arc / 2) this.hurtMon(m, dmg * rnd(0.85, 1.15), id); }
        this.sound.play("hit", { volume: 0.12 }); }
      else if (id === "front") { const t = this.nearest(B.range * area); if (!t) { w.t = 0.2; continue; }
        const ang = Math.atan2(t.y - h.y, t.x - h.x), ca = Math.cos(ang), sa = Math.sin(ang);
        const f = this.add.sprite(h.x + ca * 110 * area, h.y - 20 + sa * 110 * area, "fx_front_cut").play("fx_front_cut").setRotation(ang).setScale(0.9 * area).setDepth(h.y + 50); f.once("animationcomplete", () => f.destroy());
        for (const m of this.mons) { if (m.dead) continue; const dx = m.x - h.x, dy = m.y - h.y, along = dx * ca + dy * sa, side = Math.abs(-dx * sa + dy * ca); if (along > 0 && along < B.range * area && side < B.width * area) this.hurtMon(m, dmg * rnd(0.9, 1.1), id); } }
      else if (id === "quake") { const R = B.radius * area;
        const f = this.add.sprite(h.x, h.y - 10, "fx_ring_wave").play("fx_ring_wave").setScale(R / 100).setDepth(h.y - 5); f.once("animationcomplete", () => f.destroy());
        this.cameras.main.shake(120, 0.003);
        for (const m of this.mons) if (!m.dead && Math.hypot(m.x - h.x, m.y - h.y) < R) { this.hurtMon(m, dmg * rnd(0.9, 1.1), id); m.slow = 1.2; } }
      else if (id === "arrow" || id === "holy") { const t = this.nearest(700); if (!t) { w.t = 0.15; continue; }
        const extra = CFG.shots(id, w.lv) - 1;
        for (let i = 0; i <= extra; i++) this.shoot(id, t, dmg, B.pierce + (id === "holy" ? w.lv : 0), (i - extra / 2) * 0.12); }
      else if (id === "volley") { const t = this.nearest(600); if (!t) { w.t = 0.2; continue; }
        const R = B.radius * area, cx = t.x, cy = t.y;
        for (let k = 0; k < B.hits; k++) this.time.delayedCall(k * 330, () => {
          const f = this.add.sprite(cx, cy - 30, "fx_volley").play("fx_volley").setScale(R / 70).setDepth(cy + 40); f.once("animationcomplete", () => f.destroy());
          for (const m of this.mons) if (!m.dead && Math.hypot(m.x - cx, m.y - cy) < R) { this.hurtMon(m, dmg * rnd(0.9, 1.1), id); m.slow = 1.5; } }); }
      else if (id === "missile") {   // um só ataque: uma rajada com 1 projétil por nível, em sequência, cada um num alvo diferente (os mais perto)
        const n = CFG.shots(id, w.lv), near = this.mons.filter(m => !m.dead && Math.hypot(m.x - h.x, m.y - h.y) < 650).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y));
        if (!near.length) { w.t = 0.2; continue; }
        for (let i = 0; i < n; i++) this.time.delayedCall(i * 70, () => { const t = near[i % near.length]; if (!this.over) this.shoot(id, t.dead ? (this.nearest() || t) : t, dmg, 1, (i % 2 ? 1 : -1) * 0.5, true); }); }
      w.t = this.wv(id, "cd");
    }
  }
  auraTick(w) {
    const h = this.hero, R = CFG.weapons.aura.radius * this.wv("aura", "area");
    if (!this.auraFx) this.auraFx = this.add.sprite(h.x, h.y, "aura").play("aura").setAlpha(0.55).setBlendMode(Phaser.BlendModes.ADD);
    this.auraFx.setPosition(h.x, h.y - 8).setScale(R / 60, R / 60 * 0.62).setDepth(h.y - 2);
    if (w.t > 0) return;
    for (const m of this.mons) if (!m.dead && Math.hypot(m.x - h.x, m.y - h.y + 18) < R) this.hurtMon(m, this.wv("aura", "dmg"), "aura");
    w.t = this.wv("aura", "cd");
  }
  shoot(id, t, dmg, pierce, spread = 0, homing = false) {
    const h = this.hero, B = CFG.weapons[id], ang = Math.atan2(t.y - 20 - (h.y - 40), t.x - h.x) + spread;
    const key = id === "arrow" ? "pfx_arrow" : "fx_holy_arrow";
    const s = this.add.sprite(h.x, h.y - 40, key).play(key).setRotation(ang).setScale(id === "arrow" ? 0.5 : id === "holy" ? 1.05 : 0.85).setDepth(h.y + 60);
    if (id !== "arrow") s.setBlendMode(Phaser.BlendModes.ADD); if (id === "missile") s.setTint(0x9cc8ff);   // míssil azulado, para não confundir com a Flecha Sagrada
    this.shots.push({ id, s, x: h.x, y: h.y - 40, vx: Math.cos(ang) * B.speed, vy: Math.sin(ang) * B.speed, dmg, pierce, hit: new Set(), life: 1.6, target: homing ? t : null });
  }
  moveShots(dt) {
    for (const p of this.shots) {
      if (p.target && !p.target.dead) { const a = Math.atan2(p.target.y - 20 - p.y, p.target.x - p.x), sp = Math.hypot(p.vx, p.vy), cur = Math.atan2(p.vy, p.vx), na = cur + Phaser.Math.Angle.Wrap(a - cur) * Math.min(1, dt * 6); p.vx = Math.cos(na) * sp; p.vy = Math.sin(na) * sp; p.s.setRotation(na); }
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; p.s.setPosition(p.x, p.y).setDepth(p.y + 60);
      for (const m of this.mons) { if (m.dead || p.hit.has(m) || Math.hypot(m.x - p.x, m.y - 20 - p.y) > m.r + 10) continue;
        p.hit.add(m); this.hurtMon(m, p.dmg * rnd(0.9, 1.1), p.id);
        const f = p.id === "arrow" ? this.add.sprite(m.x, m.y - 14, "pfx_hit").play("pfx_hit").setScale(0.5) : this.add.sprite(m.x, m.y - 18, "fx_holy_arrow").play("holy_hit").setScale(p.id === "holy" ? 0.8 : 0.45).setBlendMode(Phaser.BlendModes.ADD);
        f.setDepth(m.y + 6); f.once("animationcomplete", () => f.destroy());
        if (--p.pierce <= 0) { p.life = 0; break; } }
      if (p.life <= 0) { if (p.id !== "arrow") { const f = this.add.sprite(p.x, p.y, "fx_holy_arrow").play("holy_hit").setScale(0.5).setDepth(p.y + 60).setBlendMode(Phaser.BlendModes.ADD); f.once("animationcomplete", () => f.destroy()); } p.s.destroy(); }
    }
    this.shots = this.shots.filter(p => p.life > 0);
  }
  pickups(dt) {
    const h = this.hero, st = this.stats;
    for (const g of this.gems) {
      const dx = h.x - g.x, dy = h.y - 20 - g.y, d = Math.hypot(dx, dy);
      if (d < st.pickup) g.pull = true;
      if (g.pull) { const sp = 420 + (st.pickup - d) * 2; g.x += dx / (d || 1) * sp * dt; g.y += dy / (d || 1) * sp * dt; g.s.setPosition(g.x, g.y); }
      if (d < 18) { g.taken = true; g.s.destroy(); this.xp += g.v; this.sound.play("gem", { volume: 0.08 }); }
    }
    this.gems = this.gems.filter(g => !g.taken);
    for (const c of this.heals) if (Math.hypot(h.x - c.x, h.y - c.y) < 30) { c.taken = true; c.s.destroy(); st.hp = Math.min(st.maxHp, st.hp + st.maxHp * CFG.drops.healPct); this.floatNum(h.x, h.y - 70, st.maxHp * CFG.drops.healPct, false); }
    this.heals = this.heals.filter(c => !c.taken);
    if (this.xp >= this.need && !this.choosing) { this.xp -= this.need; this.level++; this.need = this.xpNeed(this.level); this.levelUp(); }
  }
  drawDark() {
    const cam = this.cameras.main, rt = this.dark;
    rt.clear().fill(0x141a12, 0.5);
    const b = this.make.image({ key: "glow", add: false });
    const hole = (x, y, r) => { b.setScale(r / 128); rt.erase(b, x - cam.worldView.x, y - cam.worldView.y); };
    hole(this.hero.x, this.hero.y - 30, 300 * (this.weapons.aura ? 1.25 : 1));
    for (const p of this.shots) if (p.id === "holy") hole(p.x, p.y, 150);
    for (const t of this.torches) if (Math.abs(t.x - this.hero.x) < 700 && Math.abs(t.y - this.hero.y) < 450) hole(t.x, t.y, 170);
  }
  refreshHud() {
    const st = this.stats;
    this.hpBar.setSize(180 * Math.max(0, st.hp / st.maxHp), 12); this.hpT.setText(`${Math.ceil(st.hp)} / ${Math.round(st.maxHp)}`);
    this.xpBar.setSize(W * Math.min(1, this.xp / this.need), 8); this.lvT.setText(`Nível ${this.level}`);
    this.timeT.setText(fmtT(this.t)); this.killT.setText(`Abates: ${this.kills}  ·  na tela: ${this.mons.length}`);
  }
  end(win) {
    if (this.over) return; this.over = true; this.physicsPause(false);
    if (!win) this.hero.play(this.ap + "death");
    const c = this.add.container(UIX, UIY).setScrollFactor(0).setDepth(2e6);
    const rows = Object.entries(this.dmgDone).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${CFG.weapons[k].name}: ${Math.round(v)}`).join("\n");
    c.add([this.add.rectangle(0, 0, W, H, 0x000000, 0.72).setOrigin(0),
      this.add.text(W / 2, 120, win ? "Você sobreviveu à Rook Forest!" : "Você caiu na Rook Forest", { ...TXT, fontSize: fs_(30), color: win ? "#e0bc60" : "#ff8070" }).setOrigin(0.5),
      this.add.text(W / 2, 170, `Tempo ${fmtT(this.t)} · Nível ${this.level} · Abates ${this.kills}`, { ...TXT, fontSize: fs_(16) }).setOrigin(0.5),
      this.add.text(W / 2, 205, "Dano por habilidade:\n" + rows, { ...TXT, fontSize: fs_(14), align: "center" }).setOrigin(0.5, 0),
      this.add.text(W / 2, 470, TOUCH ? "Toque para jogar de novo" : "Clique ou Enter para jogar de novo", { ...TXT, fontSize: fs_(14), color: "#9a8f80" }).setOrigin(0.5)]);
    sf0(c);
    window.__end = { win, t: this.t, level: this.level, kills: this.kills, dmg: this.dmgDone, weapons: this.weapons, passives: this.passives };
    const again = () => this.scene.start("pick");
    this.time.delayedCall(800, () => { this.input.once("pointerup", again); this.input.keyboard.once("keydown-ENTER", again); });
  }
}

window.game = new Phaser.Game({ type: Phaser.AUTO, width: W * 2, height: H * 2, roundPixels: true, parent: "game", backgroundColor: "#0b0a0e", pixelArt: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, input: { activePointers: 3 }, scene: [Boot, Pick, Play] });
