// Habilidades novas (nov/26)
//  Cavaleiro: Tremor de Terra (lentidão em área, onda que cresce até 3×) e Égide (aura de defesa que devolve 10% do dano).
//  Arqueiro: Flecha Sagrada com arte própria, Aura do Vento (contorno de energia), Saraivada (chuva de flechas que marca
//  e deixa lento) e Berserker (dano +60%, crítico +15%, flecha básica ricocheteia em até 3 inimigos com explosão sagrada).

// arte das folhas novas (4×2 quadros); se não carregaram, as magias usam os efeitos antigos
function makeSkillAnims(scene) {
  for (const [k, fr] of [["fx_holy_arrow", 8], ["fx_volley", 8]]) {
    if (!scene.textures.exists(k) || scene.anims.exists(k)) continue;
    const tex = scene.textures.get(k), img = tex.getSourceImage(), fw = img.width / 4, fh = img.height / 2;
    if (!tex.has("0")) for (let i = 0; i < fr; i++) tex.add(String(i), 0, (i % 4) * fw, Math.floor(i / 4) * fh, fw, fh);
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    scene.anims.create({ key: k, frames: Array.from({ length: fr }, (_, i) => ({ key: k, frame: String(i) })), frameRate: 14 });
  }
}

Object.assign(DungeonScene.prototype, {
  // contorno de energia no herói (Aura do Vento verde, Berserker vermelho-dourado, Égide azul)
  heroGlow(id, color, on) {
    const h = this.hero, s = h.spr; if (!s || !s.preFX) return;
    h.glows = h.glows || {};
    if (on && !h.glows[id]) h.glows[id] = s.preFX.addGlow(color, 3, 0, false, 0.1, 10);
    if (!on && h.glows[id]) { s.preFX.remove(h.glows[id]); h.glows[id] = null; }
  },
  skillTick(dt) {
    const h = this.hero; if (!h) return;
    h.guardT = Math.max(0, (h.guardT || 0) - dt);
    this.heroGlow("guard", 0x7ab8ff, h.guardT > 0);
    this.heroGlow("flee", 0x9fffb0, (h.fleeT || 0) > 0);
    this.heroGlow("frenzy", 0xffb040, (h.frenzyT || 0) > 0);
    const g = h.glows || {}, p = 2.5 + Math.sin(this.time_ * 10) * 1.2;
    for (const k in g) if (g[k]) g[k].outerStrength = p;
    if (h.guardSpr && h.guardSpr.scene) {
      h.guardSpr.setVisible(h.guardT > 0).setPosition(h.px, h.py - 30).setDepth(h.py + 1).setAlpha(0.35 + 0.15 * Math.sin(this.time_ * 6));
    }
  },
  // flecha do Berserker: explosão sagrada em volta do alvo e ricochete em até 3 inimigos próximos
  berserkHit(t, kind) {
    const dmg = this.baseDamage();
    for (const [dx, dy] of DIRS8) { const m = this.occ.get(key(t.x + dx, t.y + dy)); if (m && !m.dead) this.damageMonster(m, dmg * 0.4, "holy"); }
    this.fx(this.anims.exists("fx_holy_arrow") ? "holy_arrow" : "heal", t.px, t.py - 24, 0.45);
    let from = t; const hit = new Set([t]);
    for (let n = 0; n < 3; n++) {
      const next = this.monsters.filter(m => !m.dead && !hit.has(m) && Math.max(Math.abs(m.x - from.x), Math.abs(m.y - from.y)) <= 4)
        .sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y))[0];
      if (!next) break;
      hit.add(next);
      const src = from, delay = n * 140;
      this.time.delayedCall(delay, () => {
        if (this.finished) return;
        this.shootArrow(src.px, src.py - 24, next.px, next.py - 24, () => { if (!next.dead && !this.finished) this.arrowHit(next, kind, 0.7); }, 1100);
      });
      from = next;
    }
  },
});

Object.assign(SPELL_FX, {
  quake(h, sp) {
    this.heroSwing(...h.facing);
    this.cameras.main.shake(380, 0.006);
    sfx(this, "explode", 0.45);
    // a onda cresce aos poucos até 3× o tamanho base, em volta do herói (uma só, não mais repetida)
    if (this.anims.exists("fx_ring_wave")) {
      const base = 3 * T / 200, s = this.add.sprite(h.px, h.py - 10, "fx_ring_wave").setScale(base).setDepth(h.py - 2).setTint(0xd8b080);
      this.ents.add(s); s.play({ key: "fx_ring_wave", repeat: 1 });
      this.tweens.add({ targets: s, scale: base * 3, duration: 900, ease: "Sine.out" });
      this.tweens.add({ targets: s, alpha: 0, delay: 650, duration: 300, onComplete: () => s.destroy() });
    }
    for (let k = 0; k < 10; k++) { const a = Math.random() * Math.PI * 2, r = Phaser.Math.Between(20, 2 * T); this.splat(h.px + Math.cos(a) * r, h.py + Math.sin(a) * r * 0.7, 1); }
    for (const m of this.monsters) {
      if (m.dead || Math.max(Math.abs(m.x - h.x), Math.abs(m.y - h.y)) > 2) continue;
      m.slowT = sp.dur; m.flash = 0.3;
      this.floatText(m.px, m.py - 46, window.t("slow_float"), "#8ab4ff");
    }
  },
  guard(h, sp) {
    h.guardT = sp.dur;
    if (!h.guardSpr || !h.guardSpr.scene) { h.guardSpr = this.add.image(h.px, h.py - 30, "light").setTint(0x7ab8ff).setBlendMode(Phaser.BlendModes.ADD).setScale(0.9, 1.1); this.ents.add(h.guardSpr); }
    this.floatText(h.px, h.py - 90, window.t("guard_float"), "#9fd0ff");
    sfx(this, "levelup", 0.25);
  },
  holy(h, sp) {
    const tg = this.rangedTarget();
    if (!tg) { this.msg(window.t("no_target")); h.cds.holy = 0; h.fury += sp.fury; return; }
    if (!this.spendArrow()) { h.cds.holy = 0; h.fury += sp.fury; return; }
    const dx = Math.sign(tg.x - h.x), dy = Math.sign(tg.y - h.y), side = Math.abs(tg.x - h.x) >= Math.abs(tg.y - h.y);
    this.heroSwing(side ? dx : 0, side ? 0 : dy);
    this.time.delayedCall(250, () => {
      if (h.dead || this.finished) return;
      const has = this.anims.exists("fx_holy_arrow"), ang = Math.atan2(tg.py - 24 - (h.py - 40), tg.px - h.px);
      const a = has ? this.add.sprite(h.px, h.py - 40, "fx_holy_arrow", "1").setScale(0.7) : this.add.image(h.px, h.py - 40, "arrow").setTint(0xfff0a0).setScale(1.6);
      a.setRotation(ang).setBlendMode(Phaser.BlendModes.ADD).setDepth(100000);
      const glow = this.add.image(h.px, h.py - 40, "light").setTint(0xfff0a0).setBlendMode(Phaser.BlendModes.ADD).setScale(0.35).setDepth(99999);
      this.ents.add(a); this.ents.add(glow);
      const dur = Math.max(80, Math.hypot(tg.px - h.px, tg.py - h.py) / 1400 * 1000);
      this.tweens.add({ targets: [a, glow], x: tg.px, y: tg.py - 24, duration: dur, onComplete: () => {
        a.destroy(); glow.destroy();
        if (tg.dead || this.finished) return;
        this.damageMonster(tg, this.baseDamage() * 2.0, "holy");
        if (has) { const b = this.add.sprite(tg.px, tg.py - 24, "fx_holy_arrow").setScale(1.0).setBlendMode(Phaser.BlendModes.ADD).setDepth(100001); this.ents.add(b); b.play({ key: "fx_holy_arrow", startFrame: 3 }); b.once("animationcomplete", () => b.destroy()); }
        else this.fx("heal", tg.px, tg.py - 28, 0.6);
      } });
      sfx(this, "gem", 0.4);
    });
  },
  flee(h, sp) {
    h.fleeT = sp.dur;
    this.floatText(h.px, h.py - 90, window.t("flee_float"), "#9fe08a");
    sfx(this, "pickup", 0.4);
  },
  volley(h, sp) {
    const tg = this.rangedTarget();
    if (!tg) { this.msg(window.t("no_target")); h.cds.volley = 0; h.fury += sp.fury; return; }
    const cx = tg.x, cy = tg.y, p = this.cellPos(cx, cy);
    this.heroSwing(Math.sign(cx - h.x), 0);
    if (this.anims.exists("fx_volley")) {
      const s = this.add.sprite(p.x, p.y - 8, "fx_volley").setOrigin(0.5, 0.8).setScale(2.3 * T / (this.textures.get("fx_volley").getSourceImage().width / 4)).setDepth(p.y + 2);
      this.ents.add(s); s.play("fx_volley"); s.once("animationcomplete", () => s.destroy());
    } else for (let k = 0; k < 9; k++) this.time.delayedCall(k * 40, () => this.shootArrow(p.x + Phaser.Math.Between(-60, 60), p.y - 260, p.x + Phaser.Math.Between(-50, 50), p.y - 10, () => {}, 1400));
    sfx(this, "pickup", 0.3);
    this.time.delayedCall(330, () => {
      if (this.finished) return;
      for (const m of this.monsters.slice()) {
        if (m.dead || Math.max(Math.abs(m.x - cx), Math.abs(m.y - cy)) > 1) continue;
        m.slowT = sp.dur;
        this.damageMonster(m, this.baseDamage() * 1.2);
      }
      sfx(this, "hit", 0.4);
    });
  },
  frenzy(h, sp) {
    h.frenzyT = sp.dur;
    this.floatText(h.px, h.py - 90, window.t("frenzy_float"), "#ffb040");
    this.fx("heal", h.px, h.py - 28, 0.8);
    this.cameras.main.flash(180, 255, 180, 80);
    sfx(this, "levelup", 0.25);
  },
});

{
  const up = DungeonScene.prototype.update;
  DungeonScene.prototype.update = function (time, delta) { const r = up.call(this, time, delta); if (!this.paused) this.skillTick(delta / 1000 * (Settings.data.speed || 1)); return r; };
  const cr = DungeonScene.prototype.create;
  DungeonScene.prototype.create = function (...a) { makeSkillAnims(this); return cr.apply(this, a); };
  // Égide: +40% de defesa e devolve 10% do golpe a quem atacou
  const dv = DungeonScene.prototype.defenseValue;
  DungeonScene.prototype.defenseValue = function () { const v = dv.call(this); return (this.hero && this.hero.guardT > 0) ? v * 1.4 : v; };
  const hh = DungeonScene.prototype.hurtHero;
  DungeonScene.prototype.hurtHero = function (amount, pure = 0, el = "physical") {
    const m = this._attacker; this._attacker = null;
    const r = hh.call(this, amount, pure, el);
    if (m && !m.dead && this.hero.guardT > 0 && amount > 0) {
      const back = Math.max(1, amount * 0.1);
      this.damageMonster(m, back);
    }
    return r;
  };
}
