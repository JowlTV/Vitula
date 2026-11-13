// Luz e atmosfera: mapa de luz (MULTIPLY), oscilação, névoa da guerra, partículas e sangue.
// (métodos da DungeonScene, separados por assunto)
Object.assign(DungeonScene.prototype, {

  // ---------------------------------------------------------------- escuridão e luzes
  // ---------------------------------------------------------------- luz e escuridão
  // mapa de luz em MULTIPLY por cima de tudo: fundo quase preto (#08090d … ~15% de luz ambiente)
  // e cada fonte de luz soma (ADD) um círculo colorido. Fora das luzes, o esgoto fica no breu.
  buildDarkness() {
    if (this.dark) this.dark.destroy();
    this.dark = this.add.renderTexture(0, 0, VIEW_W, VIEW_H).setOrigin(0).setDepth(0).setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.uiLayer.add(this.dark);
    if (!this.glow) { this.glow = this.add.layer().setDepth(899999); this.uiCam.ignore(this.glow); }
    this.glow.removeAll(true);
    this.lightBrush = this.stamp("light").setBlendMode(Phaser.BlendModes.ADD);
    // névoa da guerra estática: o que nunca foi visto fica preto
    if (this.fogG) this.fogG.destroy();
    this.fogG = this.add.graphics().setDepth(900000); // acima do brilho das tochas
    this.uiCam.ignore(this.fogG);
    // vinheta pesada nas bordas (claustrofobia)
    if (!this.textures.exists("vignette")) {
      const ct = this.textures.createCanvas("vignette", VIEW_W, VIEW_H), c = ct.getContext();
      const gr = c.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.28, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.62);
      gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(0.55, "rgba(4,4,8,0.45)"); gr.addColorStop(1, "rgba(2,2,4,0.95)");
      c.fillStyle = gr; c.fillRect(0, 0, VIEW_W, VIEW_H); ct.refresh();
    }
    if (!this.vignette) { this.vignette = this.add.image(0, 0, "vignette").setOrigin(0).setDepth(1); this.uiLayer.add(this.vignette); }
    // cores: menos saturação e mais contraste em todo o mundo (a pedra parece úmida e velha)
    const cam = this.cameras.main;
    if (cam.postFX && !this.gradeFx) {
      this.gradeFx = cam.postFX.addColorMatrix();
      this.gradeFx.saturate(-0.3);
      this.gradeFx.contrast(0.18, true);
    }
    this.drawFog();
  },


  // oscilação estocástica suave da luz (LightFlicker): cada fonte persegue um alvo aleatório
  flicker(l, dt, amp) {
    l.ft = (l.ft || 0) - dt;
    if (l.ft <= 0) { l.ft = 0.06 + Math.random() * 0.18; l.fTarget = 1 + (Math.random() * 2 - 1) * amp; }
    l.f = Phaser.Math.Linear(l.f || 1, l.fTarget || 1, Math.min(1, dt * 10));
    return l.f;
  },


  drawDarkness(dt = 0.016) {
    const cam = this.cameras.main, rt = this.dark, b = this.lightBrush, h = this.hero;
    rt.clear().fill(this.slope ? 0x52505e : 0x14151c, 1);
    const pts = [];
    // raio de luz do herói (como a tocha/Utevo Lux do Tibia): pequeno
    h.light = h.light || {};
    const hf = this.flicker(h.light, dt, 0.04);
    // com a Aura Sagrada ativa, a luz do herói alcança bem mais longe
    const aur = h.auraT > 0 ? 1.8 : 1;
    pts.push({ x: h.px, y: h.py - 20, r: 3.3 * T * hf * aur, tint: h.auraT > 0 ? 0xffe0a8 : 0xd8ccb8 });
    pts.push({ x: h.px, y: h.py - 20, r: 1.7 * T * hf, tint: 0x8a8072 });
    // luminária equipada: lampião (gasta óleo) ou Pingente da Deusa
    const dv = Save.voc(this.vocId), lg = dv.equip.light && EQUIP[dv.equip.light.id];
    if (lg && lg.light) {
      const L = lg.light;
      if (L.fuel && dv.oil > 0) {
        const was = dv.oil; dv.oil = Math.max(0, dv.oil - dt);
        if (Math.floor(was / 10) !== Math.floor(dv.oil / 10)) Save.save();
        if (was > 60 && dv.oil <= 60) this.msg(t("oil_low"));
        if (dv.oil <= 0) { this.msg(t("oil_empty")); Save.save(); }
      }
      if (!L.fuel || dv.oil > 0) {
        const m = gearMult(dv.equip.light), lf = this.flicker(h.lamp = h.lamp || {}, dt, L.fuel ? 0.1 : 0.03);
        pts.push({ x: h.px, y: h.py - 18, r: L.r * T * lf * Math.min(1.3, m), tint: L.tint });
      }
    }
    for (const l of this.lights) {
      const f = this.flicker(l, dt, l.water ? 0.25 : 0.12);
      l.cur = f;
      pts.push({ x: l.x, y: l.y, r: l.r * f, tint: l.water ? l.tint : 0xffa255 });
    }
    // mundo → tela da interface (a interface usa zoom 2; o jogo, o zoom escolhido)
    const kz = cam.zoom / 2;
    for (const p0 of pts) {
      const p = { x: p0.x, y: p0.y, r: p0.r * kz, tint: p0.tint };
      const sx = (p.x - cam.worldView.x) * kz, sy = (p.y - cam.worldView.y) * kz;
      if (sx < -p.r || sy < -p.r || sx > VIEW_W + p.r || sy > VIEW_H + p.r) continue;
      b.setScale(p.r * 2 / 256).setTint(p.tint);
      rt.draw(b, sx, sy);
    }
    // brilho quente das tochas (imagens criadas uma vez por andar)
    for (const l of this.lights) {
      if (l.water) continue;
      if (!l.glow) { l.glow = this.add.image(l.x, l.y, "light").setScale(l.r * 1.4 / 256).setTint(0xff9a40).setBlendMode(Phaser.BlendModes.ADD); this.glow.add(l.glow); }
      l.glow.setAlpha(0.16 * (l.cur || 1) + 0.04);
    }
    // controle das partículas: só emitem perto do herói
    this.ambT = (this.ambT || 0) - dt;
    if (this.ambT <= 0) {
      this.ambT = 0.5;
      for (const e of this.dusts || []) e.emitting = Math.abs(e.x - h.px) < VIEW_W * 0.7 && Math.abs(e.y - h.py) < VIEW_H * 0.7;
    }
    this.dripT = (this.dripT || 0) - dt;
    if (this.dripT <= 0) { this.dripT = 0.25 + Math.random() * 0.35; this.drip(); }
  },


  drawFog() {
    const g = this.gen, f = this.fogG;
    if (!f) return;
    f.clear().fillStyle(0x000000, 1);
    for (let y = 0; y < g.h; y++) {
      let run = -1;
      for (let x = 0; x <= g.w; x++) {
        const hidden = x < g.w && !this.explored[y * g.w + x];
        if (hidden && run < 0) run = x;
        if (!hidden && run >= 0) { f.fillRect(run * T, y * T - 6, (x - run) * T, T + 12); run = -1; }
      }
    }
  },


  // ---------------------------------------------------------------- partículas
  addDust(x, y) {
    if (!this.textures.exists("dot")) { const g = this.make.graphics({ add: false }); g.fillStyle(0xffffff).fillRect(0, 0, 2, 2); g.generateTexture("dot", 2, 2); g.destroy(); }
    const e = this.add.particles(x, y, "dot", {
      lifespan: { min: 2500, max: 4500 }, frequency: 420, quantity: 1,
      x: { min: -60, max: 60 }, y: { min: -50, max: 40 },
      speedX: { min: -6, max: 6 }, speedY: { min: -10, max: -2 },
      alpha: { start: 0.7, end: 0 }, scale: { min: 0.5, max: 1 }, tint: [0xffd9a0, 0xc8b890, 0xa8c088],
      blendMode: "ADD",
    }).setDepth(99990);
    e.emitting = false;
    this.world.add(e);
    (this.dusts = this.dusts || []).push(e);
  },


  // pingo caindo do teto num canal visível, com ondinha na água
  drip() {
    const g = this.gen, h = this.hero;
    for (let tries = 0; tries < 8; tries++) {
      const x = h.x + Phaser.Math.Between(-7, 7), y = h.y + Phaser.Math.Between(-4, 4);
      if (!g.isWater(x, y) || !this.explored[y * g.w + x]) continue;
      const tx = x * T + Phaser.Math.Between(14, T - 14), ty = y * T + Phaser.Math.Between(18, T - 18);
      const d = this.add.rectangle(tx, ty - 90, 2, 5, 0xb8d0c8, 0.8).setDepth(99991);
      this.world.add(d);
      this.tweens.add({ targets: d, y: ty, duration: 380, ease: "Quad.in", onComplete: () => {
        d.destroy();
        const ring = this.add.ellipse(tx, ty, 6, 3).setStrokeStyle(1, 0xc8e0b0, 0.8).setDepth(2);
        this.world.add(ring);
        this.tweens.add({ targets: ring, scaleX: 4, scaleY: 4, alpha: 0, duration: 700, onComplete: () => ring.destroy() });
      } });
      return;
    }
  },


  // sangue pixelado no chão (some aos poucos)
  splat(px, py, n = 10, col = 0x5a0a0a) {
    const gfx = this.add.graphics().setDepth(3);
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * 18;
      const s = 2 + Math.floor(Math.random() * 3);
      gfx.fillStyle(Math.random() < 0.3 ? 0x3a0606 : col, 0.9).fillRect(Math.round(px + Math.cos(a) * d), Math.round(py + Math.sin(a) * d * 0.5), s, s);
    }
    this.world.add(gfx);
    this.tweens.add({ targets: gfx, alpha: 0, delay: 9000, duration: 4000, onComplete: () => gfx.destroy() });
  },
});
