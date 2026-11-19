// Habilidades avançadas (liberadas pela Árvore de Talentos)
//  Cavaleiro: Slasher (5), Modo Berserker (6), Corte em X (7)
//  Arqueiro:  Míssil Sagrado (2), Visão Além do Alcance (6), Barreira de Luz (7)
Object.assign(SPELL_FX, {
  // ---------------- Cavaleiro
  slasher(h, sp) {
    const [dx, dy] = h.facing; this.heroSwing(dx, dy);
    const base = this.baseDamage() * 2.0 * 2.2, mult = this.critMult() + 0.15;   // 120% acima do Golpe Frontal, sempre crítico
    this.time.delayedCall(180, () => {
      if (this.finished) return;
      const p = this.cellPos(h.x + dx * 2, h.y + dy * 2);
      if (this.anims.exists("fx_slasher")) { const fw = this.textures.get("fx_slasher").getSourceImage().width / 4, sl = this.add.sprite(p.x, p.y - 22, "fx_slasher").setScale(3.2 * T / fw).setFlipX(dx < 0).setAngle(dy && !dx ? 90 * dy : 0).setBlendMode(Phaser.BlendModes.ADD).setDepth(100000);
        this.ents.add(sl); sl.play("fx_slasher"); sl.once("animationcomplete", () => sl.destroy()); }
      else this.fx("slash", p.x, p.y - 22, 2.2, dx < 0, dx && dy ? 45 * dx * dy : (dy ? 90 : 0));
      this.cameras.main.flash(90, 255, 230, 200);
      for (let k = 1; k <= 3; k++) {
        const x = h.x + dx * k, y = h.y + dy * k; if (!this.gen.isFloor(x, y) || this.isClosedDoor(x, y)) break;
        const m = this.occ.get(key(x, y)); if (m && !m.dead) { this.damageMonster(m, base * mult); this.splat(m.px, m.py - 4, 6); this.floatText(m.px, m.py - 60, window.t("crit_float"), "#ffd040"); }
      }
      sfx(this, "hit", 0.5);
    });
  },
  kberserk(h, sp) {
    h.kberT = sp.dur;
    this.floatText(h.px, h.py - 90, window.t("kberserk_float"), "#ff5040");
    this.cameras.main.flash(160, 255, 60, 40);
    sfx(this, "levelup", 0.3);
  },
  xcut(h, sp) {
    const [dx, dy] = h.facing; this.heroSwing(dx, dy);
    const cx = h.x + dx, cy = h.y + dy, dmg = this.baseDamage() * 2.0 * 1.8, p = this.cellPos(cx, cy);
    this.time.delayedCall(180, () => {
      if (this.finished) return;
      if (this.anims.exists("fx_xcut")) { const fw = this.textures.get("fx_xcut").getSourceImage().width / 4, x = this.add.sprite(p.x, p.y - 26, "fx_xcut").setScale(3 * T / fw).setBlendMode(Phaser.BlendModes.ADD).setDepth(100000);
        this.ents.add(x); x.play("fx_xcut"); x.once("animationcomplete", () => x.destroy()); }
      else { this.fx("slash", p.x, p.y - 22, 1.5, false, 45); this.fx("slash", p.x, p.y - 22, 1.5, true, -45); }
      for (const [ox, oy] of [[0, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const m = this.occ.get(key(cx + ox, cy + oy)); if (!m || m.dead) continue;
        this.damageMonster(m, dmg);
        if (!m.dead) { const tot = m.hp * (m.elite ? 0.1 : 0.3); m.bleed = { t: 5, dps: tot / 5 }; this.splat(m.px, m.py, 5); }
      }
      sfx(this, "hit", 0.5);
    });
  },
  // ---------------- Arqueiro
  missile(h, sp) {
    const tg = this.rangedTarget();
    const [dx, dy] = tg ? [Math.sign(tg.x - h.x), Math.sign(tg.y - h.y)] : h.facing;
    if (!this.spendArrow()) { h.cds.missile = 0; h.fury += sp.fury; return; }
    this.heroSwing(dx && Math.abs(dx) >= Math.abs(dy) ? dx : 0, dx && Math.abs(dx) >= Math.abs(dy) ? 0 : dy);
    const dmg = this.baseDamage() * 2.0 * 1.8, hits = [];
    let x = h.x, y = h.y;
    for (let k = 1; k <= 9 && hits.length < 3; k++) {
      x += dx; y += dy; if (!this.gen.isFloor(x, y) || this.isClosedDoor(x, y)) break;
      const m = this.occ.get(key(x, y)); if (m && !m.dead) hits.push(m);
    }
    const end = hits.length ? { x: hits[0].px, y: hits[0].py + 6 } : this.cellPos(x, y), ang = Math.atan2(dy, dx);   // para e explode no primeiro bicho
    const nm = this.anims.exists("fx_missile"), has = nm || this.anims.exists("fx_holy_arrow");
    const a = nm ? this.add.sprite(h.px, h.py - 40, "fx_missile", "1").setScale(1.6 * T / (this.textures.get("fx_missile").getSourceImage().width / 4))
      : has ? this.add.sprite(h.px, h.py - 40, "fx_holy_arrow", "1").setScale(1.3) : this.add.image(h.px, h.py - 40, "arrow").setTint(0xfff0a0).setScale(3);
    if (nm) a.play({ key: "fx_missile", repeat: -1, startFrame: 0, frameRate: 14 }).on("animationupdate", (an, fr) => { if (+fr.textureFrame > 3) a.setFrame("0"); });
    a.setRotation(ang).setFlipY(dx < 0).setBlendMode(Phaser.BlendModes.ADD).setDepth(100000); this.ents.add(a);   // para a esquerda: espelha para não ficar de cabeça para baixo
    // brilho forte: halo dourado + luz que clareia a tela enquanto o míssil voa
    const halo = this.add.image(a.x, a.y, "light").setTint(0xfff0b0).setBlendMode(Phaser.BlendModes.ADD).setScale(0.54).setAlpha(0.57).setDepth(99999); this.ents.add(halo);
    const L = { x: a.x, y: a.y, r: 2.7 * T, warm: true, ph: 1 }; this.lights.push(L);
    const fly = Math.max(70, Math.hypot(end.x - h.px, end.y - 30 - (h.py - 40)) / 1600 * 1000);   // velocidade constante (perto = chega rápido)
    this.tweens.add({ targets: [a, halo, L], x: end.x, y: end.y - 30, duration: fly, onComplete: () => {
      if (nm) { const b = this.add.sprite(end.x, end.y - 30, "fx_missile", "4").setScale(a.scaleX * 1.1).setBlendMode(Phaser.BlendModes.ADD).setDepth(100001); this.ents.add(b); b.play({ key: "fx_missile", startFrame: 4, frameRate: 10 }); b.once("animationcomplete", () => b.destroy()); }
      a.destroy(); this.tweens.add({ targets: halo, scale: 1.3, alpha: 0, duration: 380, onComplete: () => halo.destroy() });
      this.time.delayedCall(350, () => { this.lights = this.lights.filter(o => o !== L); }); } });
    this.cameras.main.flash(120, 153, 144, 114, true);
    this.time.delayedCall(fly, () => {
      if (this.finished) return;
      for (const m of hits) {
        if (m.dead) continue;
        this.damageMonster(m, dmg, "holy");
        if (!m.dead) { const nx = m.x + dx, ny = m.y + dy; if (this.canEnter(nx, ny, m)) { this.moveMonster(m, nx, ny); if (!(m.slowT > 0) || m.holySlow) { m.slowT = 3; m.holySlow = true; } } }   // empurra 1 casa
      }
    });
    sfx(this, "gem", 0.5);
  },
  farsight(h, sp) { h.farT = sp.dur; this.floatText(h.px, h.py - 90, window.t("farsight_float"), "#fff0a0"); sfx(this, "levelup", 0.25); },
  barrier(h, sp) {
    const [fx, fy] = h.facing, px = fy ? 1 : 0, py = fx ? 1 : 0;   // perpendicular ao olhar
    const cells = [];
    for (const s of [-1, 0, 1]) {
      const x = h.x + fx * 2 + px * s, y = h.y + fy * 2 + py * s;
      if (!this.gen.isFloor(x, y) || this.occ.has(key(x, y))) continue;
      const p = this.cellPos(x, y);
      const g = this.add.image(p.x, p.y - 26, "light").setTint(0xfff0a0).setBlendMode(Phaser.BlendModes.ADD).setScale(0.55, 0.9).setAlpha(0.8).setDepth(p.y + 1);
      this.ents.add(g); cells.push({ x, y, g });
    }
    this.barrierCells = cells; this.barrierT = sp.dur;
    sfx(this, "gem", 0.4);
  },
});

Object.assign(DungeonScene.prototype, {
  skill3Tick(dt) {
    const h = this.hero; if (!h) return;
    h.kberT = Math.max(0, (h.kberT || 0) - dt); h.farT = Math.max(0, (h.farT || 0) - dt);
    if (this.heroGlow) { this.heroGlow("kber", 0xff3020, h.kberT > 0); this.heroGlow("far", 0xfff0a0, h.farT > 0); }
    for (const m of this.monsters.slice()) {
      const b = m.bleed; if (!b || m.dead) continue;
      b.t -= dt; b.acc = (b.acc || 0) + dt;
      if (b.acc >= 0.5) { this.damageMonster(m, b.dps * b.acc); b.acc = 0; if (!m.dead) this.splat(m.px, m.py, 1); }
      if (b.t <= 0) m.bleed = null;
    }
    if (this.barrierT > 0) {
      this.barrierT -= dt;
      for (const c of this.barrierCells) c.g.setAlpha(0.6 + 0.25 * Math.sin(this.time_ * 8 + c.x));
      if (this.barrierT <= 0) { for (const c of this.barrierCells) c.g.destroy(); this.barrierCells = []; }
    }
  },
  barrierAt(x, y) { return this.barrierT > 0 && (this.barrierCells || []).some(c => c.x === x && c.y === y); },
  // golpe básico durante o Modo Berserker: atinge os 2 seguintes em linha e cura 25% do dano base
  berserkCleave(t) {
    const h = this.hero, dx = Math.sign(t.x - h.x), dy = Math.sign(t.y - h.y);
    for (let k = 1; k <= 2; k++) { const m = this.occ.get(key(t.x + dx * k, t.y + dy * k)); if (m && !m.dead) this.damageMonster(m, this.baseDamage()); }
    this.heal(this.baseDamage() * 0.25);
  },
  // flecha básica durante a Visão Além do Alcance: marca; no 3º acerto, explode em 50% do dano recebido (dano verdadeiro)
  farMark(t, dmgBefore) {
    t.marks = (t.marks || 0) + 1;
    if (t.marks === 1) t.markHp0 = dmgBefore;
    if (t.marks >= 3 && !t.dead) {
      const taken = Math.max(0, t.markHp0 - t.hp); t.marks = 0;
      const pop = taken * 0.5;
      if (pop > 0) { t.hp -= pop; this.floatText(t.px, t.py - 64, `${Math.round(pop)}`, "#fff0a0"); this.fx("heal", t.px, t.py - 28, 0.7); if (t.hp <= 0) this.damageMonster(t, 1); }
    }
  },
});

{
  const P = DungeonScene.prototype;
  const up = P.update;
  P.update = function (time, delta) { const r = up.call(this, time, delta); if (!this.paused) this.skill3Tick(delta / 1000 * (Settings.data.speed || 1)); return r; };
  const bd = P.baseDamage; P.baseDamage = function () { return bd.call(this) * ((this.hero && this.hero.kberT > 0) ? 1.4 : 1); };
  const ce = P.canEnter; P.canEnter = function (x, y, m) { if (this.barrierAt(x, y)) return false; return ce.call(this, x, y, m); };
  const rn = P.rangeNow; P.rangeNow = function () { return rn.call(this) + ((this.hero.farT || 0) > 0 ? 6 : 0); };
  const ah = P.arrowHit;
  P.arrowHit = function (t, kind, mult) {
    const far = (this.hero.farT || 0) > 0 && kind !== "holy_skill";
    const hp0 = t.hp;
    const r = ah.call(this, t, far ? "holy" : kind, mult);
    if (far && ARROWS.holy) this.farMark(t, hp0);
    return r;
  };
}
