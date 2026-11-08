// Magias: lançamento (efeitos ficam em SPELL_FX), aura, efeitos visuais e números flutuantes.
// (métodos da DungeonScene, separados por assunto)
Object.assign(DungeonScene.prototype, {

  // ---------------------------------------------------------------- magias
  cast(spell) {
    const h = this.hero, sp = this.spells[spell];
    if (this.finished || this.paused || h.dead) return;
    if (h.level < sp.level) { this.msg(`${sp.name} é liberada no nível ${sp.level}.`); return; }
    if (h.cds[spell] > 0) return;
    if (h.fury < sp.fury) { this.msg(`${VOCATIONS[this.vocId].resource || "Fúria"} insuficiente para ${sp.name} (${sp.fury}).`); return; }
    h.fury -= sp.fury;
    this.trainMagic(sp.fury);
    h.cds[spell] = sp.cd * this.stats.cooldown;
    // cada magia tem a sua função em SPELL_FX (fácil de somar as das outras vocações)
    if (spell === "heal" || spell === "aura" || spell === "eagle") { h.pose = this.ap + "cast"; h.poseT = 0.45; }
    const fx = SPELL_FX[spell];
    if (fx) fx.call(this, h, sp);
  },


  updateAura(dt) {
    const h = this.hero;
    if (h.auraT <= 0) return;
    h.auraT -= dt; h.auraTick -= dt;
    if (!h.auraSpr || !h.auraSpr.scene) { h.auraSpr = this.add.sprite(h.px, h.py, "fx_aura").setScale(1.35, 0.75).setAlpha(0.85); this.ents.add(h.auraSpr); h.auraSpr.play("fx_aura_loop"); }
    h.auraSpr.setPosition(h.px, h.py - 2).setDepth(h.py - 2);
    if (h.auraTick <= 0) {
      h.auraTick = 0.5;
      for (const m of this.monsters.slice()) {
        if (Math.max(Math.abs(m.x - h.x), Math.abs(m.y - h.y)) <= 1) this.damageMonster(m, this.baseDamage() * 0.55);
      }
      // a aura também regenera 1,5% da vida máxima a cada meio segundo
      this.heal(h.maxHp * 0.015, false);
    }
    if (h.auraT <= 0) { h.auraSpr.stop(); h.auraSpr.setVisible(false); }
  },


  fx(name, x, y, scale, flip = false, angle = 0) {
    const s = this.add.sprite(x, y, "fx_" + name).setScale(scale).setFlipX(flip).setAngle(angle).setDepth(100001);
    this.ents.add(s);
    s.play("fx_" + name);
    s.once("animationcomplete", () => s.destroy());
  },


  floatText(x, y, s, color) {
    const t = txt(this, x, y, s, 14, color).setOrigin(0.5).setDepth(200000);
    this.ents.add(t);
    this.tweens.add({ targets: t, y: y - 22, duration: 700 });
    this.tweens.add({ targets: t, alpha: 0, delay: 300, duration: 400, onComplete: () => t.destroy() });
  },
});

// Efeito de cada magia. Roda com `this` = DungeonScene; h = herói, sp = dados da magia (data.js).
// Para uma nova vocação: adicione a magia em SPELLS (data.js) e a função dela aqui.
const SPELL_FX = {
  heal(h, sp) {
    // 15% da vida máxima + 1% por magic level
    this.heal(h.maxHp * (0.15 + 0.01 * this.mlEff()));
    this.fx("heal", h.px, h.py - 28, 0.7);
    sfx(this, "levelup", 0.2);
  },

  front(h, sp) {
    let [dx, dy] = h.facing; if (!dx && !dy) dx = 1;
    // corte em meia-lua que avança da 1ª à 3ª casa à frente (a mesma área que ele acerta)
    this.heroSwing(dx, dy);
    const a = this.cellPos(h.x + dx, h.y + dy), b = this.cellPos(h.x + dx * 3, h.y + dy * 3);
    if (this.anims.exists("fx_front_cut")) {
      // corte lacerante em linha reta cobrindo as 3 casas à frente
      const len = Math.hypot(dx, dy) * 3 * T, mid = this.cellPos(h.x + dx * 2, h.y + dy * 2);
      const c = this.add.sprite(mid.x, mid.y - 22, "fx_front_cut").setRotation(Math.atan2(dy, dx)).setScale(len / 200, 0.9).setDepth(100001);
      this.ents.add(c); c.play("fx_front_cut"); c.once("animationcomplete", () => c.destroy());
    } else {
    const s = this.add.image(a.x, a.y - 22, "fx_crescent").setRotation(Math.atan2(dy, dx)).setScale(0.9, 1.25)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(100001).setAlpha(0);
    this.ents.add(s);
    this.tweens.add({ targets: s, alpha: 1, duration: 60 });
    this.tweens.add({ targets: s, x: b.x, y: b.y - 22, scaleY: 1.45, duration: 300, ease: "Quad.out" });
    this.tweens.add({ targets: s, alpha: 0, delay: 220, duration: 140, onComplete: () => s.destroy() });
    }
    sfx(this, "hit", 0.5);
    for (let k = 1; k <= 3; k++) {
      const x = h.x + dx * k, y = h.y + dy * k;
      if (!this.gen.isFloor(x, y) || this.isClosedDoor(x, y)) break;
      const m = this.occ.get(key(x, y));
      if (m) this.damageMonster(m, this.baseDamage() * 2.0);
      else if (this.props.has(key(x, y))) { if (this.props.get(key(x, y)).kind in BREAKABLE) this.bumpProp(x, y); break; }
    }
  },

  spin(h, sp) {
    // giro com a espada: 4 cortes em meia-lua varrem as 8 casas em volta (ataque físico, sem fogo)
    this.heroSwing(...h.facing);
    if (this.anims.exists("fx_ground_slam")) {
      // espada cravada no chão: onda de cortes em anel cobrindo as 8 casas em volta
      const s = this.add.sprite(h.px, h.py - 10, "fx_ground_slam").setScale(3 * T / 200).setDepth(h.py + 2);
      this.ents.add(s); s.play("fx_ground_slam"); s.once("animationcomplete", () => s.destroy());
    } else {
    const cx = h.px, cy = h.py - 22, R = 50, cuts = [];
    for (let k = 0; k < 4; k++) {
      const c = this.add.image(cx, cy, "fx_crescent").setScale(1.0, 1.3).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      this.ents.add(c); cuts.push(c);
    }
    const st = { a: 0, al: 0 };
    const place = () => cuts.forEach((c, k) => {
      const ang = st.a + k * Math.PI / 2;
      // a meia-lua aponta para a direita na arte: girando junto com o ângulo, fica tangente ao círculo
      c.setPosition(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R * 0.7).setRotation(ang).setAlpha(st.al * (0.6 + 0.4 * ((k + 1) % 2))).setDepth(cy + Math.sin(ang) * R + 30);
    });
    place();
    this.tweens.add({ targets: st, al: 1, duration: 80, onUpdate: place });
    this.tweens.add({ targets: st, a: Math.PI * 2, duration: 420, ease: "Cubic.out", onUpdate: place,
      onComplete: () => this.tweens.add({ targets: st, al: 0, duration: 120, onUpdate: place, onComplete: () => cuts.forEach(c => c.destroy()) }) });
    }
    
    sfx(this, "explode", 0.35);
    for (const [dx, dy] of DIRS8) {
      const k = key(h.x + dx, h.y + dy);
      if (this.occ.has(k)) {
        const m = this.occ.get(k);
        this.damageMonster(m, this.baseDamage() * 2.0);
        // sangramento: 5% da vida máxima por segundo, durante 3 s
        if (!m.dead) { m.bleedT = 3; m.bleedTick = 1; }
      }
      else if (this.props.has(k) && this.props.get(k).kind in BREAKABLE) this.bumpProp(h.x + dx, h.y + dy);
    }
  },

  aura(h, sp) {
    h.auraT = sp.dur; h.auraTick = 0;
    // o desenho da aura some quando o andar é refeito: recria se tiver sido destruído
    if (!h.auraSpr || !h.auraSpr.scene) { h.auraSpr = this.add.sprite(h.px, h.py, "fx_aura").setScale(1.35, 0.75).setAlpha(0.85); this.ents.add(h.auraSpr); }
    h.auraSpr.setVisible(true).play("fx_aura_loop");
    sfx(this, "explode", 0.25);
  },
};

// Habilidades do Arqueiro
Object.assign(SPELL_FX, {
  holy(h, sp) {
    const t = this.rangedTarget();
    if (!t) { this.msg("Nenhum alvo ao alcance."); h.cds.holy = 0; h.fury += sp.fury; return; }
    const dx = Math.sign(t.x - h.x), dy = Math.sign(t.y - h.y), side = Math.abs(t.x - h.x) >= Math.abs(t.y - h.y);
    this.heroSwing(side ? dx : 0, side ? 0 : dy);
    this.time.delayedCall(250, () => {
      if (h.dead || this.finished) return;
      const a = this.add.image(h.px, h.py - 40, "arrow").setTint(0xfff0a0).setBlendMode(Phaser.BlendModes.ADD).setScale(1.6).setDepth(100000)
        .setRotation(Math.atan2(t.py - 24 - (h.py - 40), t.px - h.px));
      const glow = this.add.image(h.px, h.py - 40, "light").setTint(0xfff0a0).setBlendMode(Phaser.BlendModes.ADD).setScale(0.35).setDepth(99999);
      this.ents.add(a); this.ents.add(glow);
      const dur = Math.max(80, Math.hypot(t.px - h.px, t.py - h.py) / 1400 * 1000);
      this.tweens.add({ targets: [a, glow], x: t.px, y: t.py - 24, duration: dur, onComplete: () => {
        a.destroy(); glow.destroy();
        if (t.dead || this.finished) return;
        this.damageMonster(t, this.baseDamage() * 2.0);
        this.fx("heal", t.px, t.py - 28, 0.6);
      } });
      sfx(this, "gem", 0.4);
    });
  },
  rain(h, sp) {
    const t = this.rangedTarget(); let [fx, fy] = h.facing; if (!fx && !fy) fy = 1;
    const cx = t ? t.x : h.x + fx * 3, cy = t ? t.y : h.y + fy * 3;
    h.pose = this.ap + "cast"; h.poseT = 0.45;
    const c = this.cellPos(cx, cy);
    for (let i = 0; i < 9; i++) {
      const ox = Phaser.Math.Between(-T, T), oy = Phaser.Math.Between(-T, T);
      const a = this.add.image(c.x + ox, c.y + oy - 220, "arrow").setRotation(Math.PI / 2).setDepth(100000).setScale(1.2);
      this.ents.add(a);
      this.tweens.add({ targets: a, y: c.y + oy - 16, duration: 260, delay: 120 + i * 35, onComplete: () => a.destroy() });
    }
    this.time.delayedCall(420, () => {
      for (const [dx, dy] of [[0, 0], ...DIRS8]) { const m = this.occ.get(key(cx + dx, cy + dy)); if (m) this.damageMonster(m, this.baseDamage() * 1.5); }
      sfx(this, "explode", 0.25);
    });
  },
  eagle(h, sp) {
    h.eagleT = sp.dur;
    this.floatText(h.px, h.py - 90, "Olho de Águia", "#e0d070");
    sfx(this, "levelup", 0.25);
  },
});
