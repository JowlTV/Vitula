// Abertura de cada personagem novo: três quadros na carruagem (arte própria por classe) antes da Rook Forest.
// 1) lendo os contratos  2) o raio quebra a roda  3) ninguém lá fora, o cavalo foge.
// Depois o jogo começa ao lado da carruagem caída (ver forestWreck, mais abaixo).
// luzes de cada quadro (coordenadas na imagem de 960×536) para o brilho tremer como fogo de verdade
const INTRO_LAMPS = {
  knight_1: [[478, 122], [881, 94]], knight_2: [[222, 242], [529, 164]], knight_3: [[276, 451]],
  archer_1: [[415, 186], [840, 123]], archer_2: [[278, 253], [555, 194]], archer_3: [[292, 484]],
  karhyn: [[406, 319], [617, 304], [472, 334], [561, 328], [783, 225], [700, 135]],
};
// um quadro animado: imagem + lampiões tremeluzindo + chuva, tudo num container que a câmera "empurra" devagar
function animatedPanel(scene, key, lampsKey, opts = {}) {
  const c = scene.add.container(VIEW_W / 2, VIEW_H / 2);
  const img = scene.add.image(0, 0, key), k = VIEW_W / img.width * 1.04; img.setScale(k); c.add(img);
  const s = img.width / 960;   // lampiões marcados na arte de 960 px; vale para qualquer resolução
  for (const [x, y] of INTRO_LAMPS[lampsKey] || []) {
    const g = scene.add.image((x * s - img.width / 2) * k, (y * s - img.height / 2) * k, "light").setTint(0xffb050).setBlendMode(Phaser.BlendModes.ADD).setScale(0.35 * k * s).setAlpha(0.35);
    c.add(g); scene.tweens.add({ targets: g, alpha: { from: 0.22, to: 0.5 }, scale: g.scale * 1.15, duration: Phaser.Math.Between(90, 180), yoyo: true, repeat: -1, repeatDelay: Phaser.Math.Between(0, 220) });
  }
  if (opts.rain !== false) {
    if (!scene.textures.exists("rain_drop")) { const gr = scene.make.graphics({ add: false }); gr.fillStyle(0xffffff).fillRect(0, 0, 1, 12); gr.generateTexture("rain_drop", 1, 12); gr.destroy(); }
    const rf = scene.add.particles(0, 0, "rain_drop", { x: { min: -VIEW_W / 2 - 40, max: VIEW_W / 2 + 80 }, y: -VIEW_H / 2 - 20, lifespan: 900, speedY: { min: 560, max: 700 },
      speedX: { min: -90, max: -60 }, rotate: 8, alpha: { start: opts.rainA || 0.35, end: 0.15 }, tint: 0xb4c4dc, quantity: 2, frequency: 16 });
    c.add(rf);
  }
  return { c, img, k };
}

class CarriageScene extends Phaser.Scene {
  constructor() { super("carriage"); }
  preload() {
    const v = this.registry.get("vocation") === "archer" ? "archer" : "knight";
    for (let i = 1; i <= 3; i++) if (!this.textures.exists(`intro_${v}_${i}`)) this.load.image(`intro_${v}_${i}`, `assets/intro/${v}_${i}.jpg`);
  }
  create() {
    this.v = this.registry.get("vocation") === "archer" ? "archer" : "knight";
    zoom2(this.cameras.main); this.cameras.main.setBackgroundColor("#050406");
    this.step = -1; this.busy = false; this.layer = this.add.container(0, 0);
    const skip = txt(this, VIEW_W - 14, 12, t("carriage_skip"), 12, COLORS.dim).setOrigin(1, 0).setDepth(10).setInteractive({ useHandCursor: true });
    skip.on("pointerup", e => { e.event && e.event.stopPropagation && e.event.stopPropagation(); this.finish(); });
    this.input.on("pointerup", () => this.next());
    this.input.keyboard.on("keydown", ev => { if (ev.key === "Escape") this.finish(); else this.next(); });
    playMusic(this, "music_title", 0.45);
    this.next();
  }
  next() {
    if (this.busy || this.ended) return;
    this.step++;
    if (this.step > 2) return this.finish();
    this.busy = true; this.time.delayedCall(700, () => { this.busy = false; });
    const old = this.layer; this.layer = this.add.container(0, 0).setAlpha(0);
    // continuidade: 1→2 corta no clarão do raio; 2→3 escurece e reabre mais perto, com a câmera seguindo para a direita
    this.tweens.add({ targets: old, alpha: 0, duration: this.step === 1 ? 120 : 900, onComplete: () => old.destroy() });
    const P = animatedPanel(this, `intro_${this.v}_${this.step + 1}`, `${this.v}_${this.step + 1}`, { rainA: this.step === 0 ? 0.12 : 0.4 });
    this.layer.add(P.c);
    const push = [{ s: 1.0, s2: 1.07, x2: -14 }, { s: 1.06, s2: 1.0, x2: 8 }, { s: 1.08, s2: 1.02, x2: -10 }][this.step];
    P.c.setScale(push.s); this.tweens.add({ targets: P.c, scale: push.s2, x: VIEW_W / 2 + push.x2, duration: 9000, ease: "Sine.out" });
    if (this.step === 0) this.tweens.add({ targets: P.c, y: VIEW_H / 2 + 2, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });   // a carruagem balança na estrada
    // o quadro segue sozinho depois de um tempo (ainda dá para tocar para adiantar)
    if (this.auto) this.auto.remove(); this.auto = this.time.delayedCall([7000, 4200, 7500][this.step], () => this.next());
    if (this.step !== 1) {   // o quadro do raio fica sem texto
      const box = this.add.rectangle(VIEW_W / 2, VIEW_H - 46, VIEW_W - 80, 62, 0x07060a, 0.78).setStrokeStyle(1, 0x5a4a30); this.layer.add(box);
      const line = txt(this, VIEW_W / 2, VIEW_H - 46, t("carriage_" + (this.step + 1)), this.step === 1 ? 34 : 15, this.step === 1 ? "#f0e0b0" : COLORS.text,
        { align: "center", wordWrap: { width: VIEW_W - 130 }, title: this.step === 1 }).setOrigin(0.5); this.layer.add(line);
      const hint = txt(this, VIEW_W - 50, VIEW_H - 24, "▸", 14, COLORS.gold).setOrigin(0.5); this.layer.add(hint);
      this.tweens.add({ targets: hint, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });
    }
    this.tweens.add({ targets: this.layer, alpha: 1, duration: this.step === 1 ? 60 : 900 });
    if (this.step === 1) {   // o raio: clarão, tremor e o estalo
      const f = this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0xe8f0ff, 0).setOrigin(0).setDepth(5);
      this.tweens.add({ targets: f, alpha: { from: 0.95, to: 0 }, duration: 160, repeat: 2, repeatDelay: 70, onComplete: () => f.destroy() });
      this.cameras.main.shake(380, 0.012); sfx(this, "explode", 0.7); this.time.delayedCall(120, () => sfx(this, "break", 0.6));
    }
  }
  finish() {
    if (this.ended) return; this.ended = true;
    const d = Save.voc(this.v); d.carriageSeen = true; Save.save();
    this.cameras.main.fadeOut(600, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      const tx = this.textures, v = this.v;   // libera a memória (importante no celular) depois que a cena fechou
      setTimeout(() => { for (let i = 1; i <= 3; i++) if (tx.exists(`intro_${v}_${i}`)) tx.remove(`intro_${v}_${i}`); }, 1500);
      this.registry.set("region", "forest"); this.registry.set("startFloor", 1);
      stopAllButMusic(this); this.scene.start("dungeon");
    });
  }
}

// ── Rook Forest: a carruagem caída ao lado de onde o jogador começa, sangue no chão, o fim da trilha,
// chuva o tempo todo e um raio de vez em quando ──
Object.assign(DungeonScene.prototype, {
  forestWreck(start) {
    (this.wreckObjs || []).forEach(o => o && o.scene && o.destroy()); this.wreckObjs = [];   // o andar pode ser montado mais de uma vez: nunca duas carruagens
    const p = this.cellPos(start.x, start.y), g = this.gen;
    // trilha de terra por onde a carruagem veio: do herói até a borda esquerda do mapa, enquanto houver chão
    const road = this.add.graphics().setDepth(-5); this.world.add(road); this.wreckObjs.push(road);
    for (let x = start.x; x >= 0 && g.isWalk(x, start.y); x--) {
      const c = this.cellPos(x, start.y), a = x === start.x ? 0.12 : 0.28;
      road.fillStyle(0x3a2a1a, a).fillRect(c.x - T / 2, c.y - T * 0.42, T, T * 0.84);
      road.fillStyle(0x24180e, a + 0.1).fillRect(c.x - T / 2, c.y - T * 0.3, T, 4).fillRect(c.x - T / 2, c.y + T * 0.26, T, 4);   // sulcos das rodas
    }
    // a carruagem: na casa de cima (ou de baixo) do herói, sem bloquear o caminho
    const dy = -1;   // regra: a carruagem fica sempre ACIMA do herói (atrás dele na tela), nunca na frente tampando o personagem
    if (this.textures.exists("carriage_wreck")) {
      const w = this.add.image(p.x + T * 0.4, p.y + dy * T * 0.9, "carriage_wreck").setOrigin(0.5, 0.7);
      w.setScale(4.4 * T / w.width).setDepth(p.y - T * 0.5);   // sempre desenhada antes (atrás) do herói
      this.ents.add(w); this.wreckImg = w; this.wreckObjs.push(w);
    }
    // sangue e pegadas indo para dentro da mata
    const b = this.add.graphics().setDepth(-4); this.world.add(b); this.wreckObjs.push(b);
    const rnd = (a, z) => a + Math.random() * (z - a);
    for (let i = 0; i < 9; i++) b.fillStyle(0x5a0a0a, rnd(0.45, 0.75)).fillEllipse(p.x + rnd(-T, T * 2.2), p.y + dy * T * 0.3 + rnd(-T * 0.5, T * 0.6), rnd(6, 22), rnd(4, 12));
    for (let i = 0; i < 7; i++) { const fx = p.x + T * 2 + i * T * 0.45, fy = p.y - dy * T * (0.2 + i * 0.22);
      b.fillStyle(0x1a0c08, 0.7).fillEllipse(fx, fy + (i % 2 ? 5 : -5), 7, 11); if (i < 3) b.fillStyle(0x4a0808, 0.5).fillCircle(fx + 4, fy, 2.5); }
    this.lights.push({ x: p.x - T * 0.6, y: p.y + dy * T * 0.4, r: 3 * T, warm: true, ph: 1 });   // lampião caído
  },
  forestRain() {
    if (!this.textures.exists("rain_drop")) { const gr = this.make.graphics({ add: false }); gr.fillStyle(0xffffff).fillRect(0, 0, 1, 12); gr.generateTexture("rain_drop", 1, 12); gr.destroy(); }
    const rf = this.add.particles(0, 0, "rain_drop", { x: { min: -40, max: VIEW_W + 80 }, y: -20, lifespan: 900, speedY: { min: 520, max: 680 }, speedX: { min: -90, max: -60 },
      rotate: 8, alpha: { start: 0.4, end: 0.2 }, tint: 0xb4c4dc, quantity: LOW_MEM ? 1 : 2, frequency: 14 });
    this.uiLayer.addAt(rf, 0); this.forestRainFx = rf; this.boltT = Phaser.Math.Between(5, 12);
  },
  forestBolt(dt) {
    if (!this.forestRainFx) return;
    this.boltT -= dt; if (this.boltT > 0) return;
    this.boltT = Phaser.Math.Between(12, 30);
    const f = this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0xdfe8ff, 0).setOrigin(0); this.uiLayer.addAt(f, 0);
    this.tweens.add({ targets: f, alpha: { from: 0.5, to: 0 }, duration: 120, repeat: Phaser.Math.Between(1, 2), repeatDelay: Phaser.Math.Between(40, 110), onComplete: () => f.destroy() });
    this.time.delayedCall(Phaser.Math.Between(300, 900), () => sfx(this, "explode", 0.25));   // trovão
  },
});
{
  const bf = DungeonScene.prototype.buildFloor;
  DungeonScene.prototype.buildFloor = function (...a) {
    const r = bf.apply(this, a);
    if (this.forest) {
      if (!this.forestRainFx) this.forestRain();
      if (this.floorN === 1 && this.rope) this.forestWreck(this.rope);
    }
    return r;
  };
  const up = DungeonScene.prototype.update;
  DungeonScene.prototype.update = function (time, delta) {
    const r = up.call(this, time, delta);
    if (this.forest && !this.paused) this.forestBolt(delta / 1000);
    return r;
  };
  const cr = DungeonScene.prototype.create;
  DungeonScene.prototype.create = function (...a) { this.forestRainFx = null; this.wreckObjs = []; return cr.apply(this, a); };
}

// ── Entrada dos esgotos: uma cena rápida (arte da classe) com o título "Esgotos de Karhyn", toda vez que se entra ──
Object.assign(DungeonScene.prototype, {
  sewerCard() {
    const v = this.vocId === "archer" ? "archer" : "knight", key = `sewer_${v}`;
    const show = () => {
      if (!this.textures.exists(key) || this.finished) return;
      const c = this.add.container(0, 0).setDepth(40); this.uiLayer.add(c); this.paused = true; this.sewerCardBox = c;
      c.add(this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x000000, 1).setOrigin(0));
      const P = animatedPanel(this, key, "", { rainA: 0 }); c.add(P.c);
      const torch = this.add.image((201 - 480) * P.k + VIEW_W / 2, (149 - 268) * P.k + VIEW_H / 2, "light").setTint(0xffa040).setBlendMode(Phaser.BlendModes.ADD).setScale(0.45).setAlpha(0.4);
      c.add(torch); this.tweens.add({ targets: torch, alpha: 0.65, duration: 120, yoyo: true, repeat: -1, repeatDelay: 60 });
      const tt = this.add.text(VIEW_W / 2, VIEW_H - 70, t("sewers_title"), { fontFamily: FONT_TITLE, fontSize: "29px", color: "#e0bc60", stroke: "#0c0608", strokeThickness: 7, resolution: 2 })
        .setOrigin(0.5).setShadow(0, 3, "#000", 6, true, true).setAlpha(0); c.add(tt);
      c.setAlpha(0);
      this.tweens.add({ targets: P.c, scale: 1.06, duration: 2600, ease: "Sine.out" });
      this.tweens.add({ targets: c, alpha: 1, duration: 350 });
      this.tweens.add({ targets: tt, alpha: 1, y: VIEW_H - 78, duration: 700, delay: 300 });
      const close = () => { if (c.closing) return; c.closing = true; this.tweens.add({ targets: c, alpha: 0, duration: 500, onComplete: () => { c.destroy(); this.sewerCardBox = null; if (!this.pauseBox) this.paused = false; } }); };
      setTimeout(close, 2300);   // fora do relógio da cena (que fica parado enquanto o jogo está pausado)
      this.input.once("pointerdown", close); this.input.keyboard.once("keydown", close);
    };
    if (this.textures.exists(key)) show();
    else { this.load.image(key, `assets/intro/${v}_sewers.jpg`); this.load.once("complete", show); this.load.start(); }
  },
});
{
  const cr = DungeonScene.prototype.create;
  DungeonScene.prototype.create = function (...a) {
    const r = cr.apply(this, a);
    if (this.regionId === "karhyn_sewers" && (this.registry.get("startFloor") || 1) === 1) this.sewerCard();
    return r;
  };
}
