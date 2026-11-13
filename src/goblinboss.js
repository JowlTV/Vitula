// Líder Goblin (último andar da Encosta): apresentação, toque de guerra que chama reforços,
// pancada no chão com aviso (3×3 em volta do herói) e fúria abaixo de 40% de vida.
// Ao morrer, a Encosta é libertada e abre a tela de fim da demo.
const LEADER = { slamEvery: 7, slamWarn: 1.1, slamMult: 1.6, horns: [0.7, 0.35], enrageAt: 0.4, lootTime: 15 };

Object.assign(DungeonScene.prototype, {
  leaderTick(m, dt) {
    const h = this.hero, B = m.boss || (m.boss = { intro: false, horns: 0, slamT: 3, enraged: false });
    if (!B.intro) { B.intro = true; this.leaderIntro(m); }
    const f = m.hp / m.maxHp;
    // toque de guerra: chama goblins em volta do chefe
    if (B.horns < LEADER.horns.length && f <= LEADER.horns[B.horns]) {
      B.horns++;
      this.cameras.main.shake(400, 0.006); sfx(this, "boss", 0.55);
      this.msg(t("leader_horn"));
      this.floatText(m.px, m.py - 120, t("leader_horn_short"), "#e0a040");
      const spots = [];
      for (let r = 1; r <= 3 && spots.length < 2 + B.horns; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const x = m.x + dx, y = m.y + dy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !this.walkable(x, y) || this.occ.has(key(x, y)) || (x === h.x && y === h.y)) continue;
        if (spots.length < 2 + B.horns) spots.push({ x, y });
      }
      for (const s of spots) { const g = this.spawnMonster(B.horns === 2 ? "goblin_assassin" : "goblin", s.x, s.y); if (g) g.awake = true; }
    }
    // fúria
    if (!B.enraged && f <= LEADER.enrageAt) {
      B.enraged = true;
      m.data = Object.assign({}, m.data, { atk: m.data.atk * 0.75, step: m.data.step * 0.8, tint: 0xff8a70 });
      this.msg(t("leader_enrage", { name: m.data.name }));
      this.cameras.main.flash(200, 120, 20, 10);
    }
    // pancada no chão: marca as 9 casas em volta do herói, bate depois do aviso
    const dist = Math.max(Math.abs(h.x - m.x), Math.abs(h.y - m.y));
    B.slamT -= dt;
    if (B.slamT <= 0 && dist <= 4 && !h.dead && !B.slam) {
      B.slamT = LEADER.slamEvery * (B.enraged ? 0.7 : 1);
      const cx = h.x, cy = h.y, marks = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!this.walkable(cx + dx, cy + dy)) continue;
        const p = this.cellPos(cx + dx, cy + dy);
        const r = this.add.rectangle(p.x, p.y - T * 0.32, T - 6, T - 6, 0xd02010, 0.22).setStrokeStyle(2, 0xff5030, 0.9).setDepth(p.y - T);
        this.ents.add(r); marks.push(r);
      }
      this.tweens.add({ targets: marks, alpha: 0.85, duration: LEADER.slamWarn * 1000 / 4, yoyo: true, repeat: 1 });
      B.slam = { cx, cy, t: LEADER.slamWarn, marks };
      this.floatText(m.px, m.py - 120, "!", "#ff5030");
    }
    if (B.slam) {
      B.slam.t -= dt;
      if (B.slam.t <= 0) {
        const s = B.slam; B.slam = null;
        s.marks.forEach(r => r.destroy());
        this.monsterSwing(m);
        this.cameras.main.shake(260, 0.012); sfx(this, "explode", 0.5);
        const p = this.cellPos(s.cx, s.cy);
        this.splat(p.x, p.y - 4, 18, 0x4a3a22);
        if (Math.abs(h.x - s.cx) <= 1 && Math.abs(h.y - s.cy) <= 1) this.hurtHero(m.dmg * LEADER.slamMult, 0, "physical");
        else this.floatText(h.px, h.py - 80, t("dodged"), "#a0e0a0");
      }
    }
  },

  leaderIntro(m) {
    this.cameras.main.shake(500, 0.005); sfx(this, "boss", 0.7);
    const c = this.add.container(0, 0).setDepth(25); this.uiLayer.add(c);
    const bar = this.add.rectangle(VIEW_W / 2, VIEW_H * 0.3, VIEW_W, 110, 0x000000, 0.65);
    const a = this.add.text(VIEW_W / 2, VIEW_H * 0.3 - 14, m.data.name, { fontFamily: FONT_TITLE, fontSize: "48px", color: "#e0bc60", stroke: "#0c0608", strokeThickness: 7, resolution: 2 }).setOrigin(0.5);
    const b = txt(this, VIEW_W / 2, VIEW_H * 0.3 + 30, t("leader_title"), 15, "#d8a070").setOrigin(0.5);
    c.add([bar, a, b]); c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 500, yoyo: true, hold: 2200, onComplete: () => c.destroy() });
  },

  leaderDown() {
    // a Encosta foi libertada: alguns segundos para respirar e pegar o saque, depois o fim da demo
    this.msg(t("leader_down"));
    this.cameras.main.flash(600, 255, 230, 180);
    // contagem regressiva de 15 s reais (o relógio da cena anda no ritmo do jogo, por isso o passo é 1000 × ritmo)
    let n = LEADER.lootTime;
    const cd = txt(this, VIEW_W / 2, VIEW_H * 0.22, "", 18, "#e8d8a0", { align: "center" }).setOrigin(0.5).setDepth(26);
    this.uiLayer.add(cd);
    const tick = () => {
      if (this.finished || this.hero.dead) { cd.destroy(); return; }
      if (n <= 0) { cd.destroy(); this.finish(true); return; }
      cd.setText(t("leader_loot_cd", { n })).setColor(n <= 5 ? "#ff9060" : "#e8d8a0");
      if (n <= 5) this.tweens.add({ targets: cd, scale: 1.15, duration: 120, yoyo: true });
      n--;
      this.time.delayedCall(1000 * (Settings.data.speed || 0.75), tick);
    };
    tick();
  },
});

{ // liga o chefe ao laço dos monstros e à morte
  const um = DungeonScene.prototype.updateMonster;
  DungeonScene.prototype.updateMonster = function (m, dt) {
    um.call(this, m, dt);
    if (m.kind === "goblin_leader" && !m.dead && m.awake && !this.finished) this.leaderTick(m, dt);
  };
  const md = DungeonScene.prototype.monsterDied;
  DungeonScene.prototype.monsterDied = function (m, ...a) {
    if (m.boss && m.boss.slam) { m.boss.slam.marks.forEach(r => r.destroy()); m.boss.slam = null; }
    md.call(this, m, ...a);
    if (m.kind === "goblin_leader" && this.regionId === "goblin_slope" && this.floorN >= this.floors) this.leaderDown();
  };
}

// ---------------------------------------------------------------- tela de fim da demo
class DemoEndScene extends Phaser.Scene {
  constructor() { super("demoEnd"); }
  create(info) {
    info = info || {};
    this.anims.globalTimeScale = 1; this.ready = false;
    zoom2(this.cameras.main); this.cameras.main.setBackgroundColor("#050406");
    stopAllButMusic(this); playMusic(this, "music_end", 0.6);
    if (this.textures.exists("tower_view")) {
      const img = this.add.image(VIEW_W / 2, VIEW_H / 2, "tower_view").setScale(VIEW_W / 512 * 1.1).setAlpha(0.35);
      img.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.tweens.add({ targets: img, scale: VIEW_W / 512 * 1.2, duration: 40000, ease: "Sine.inOut" });
    }
    const veil = this.add.graphics(); veil.fillStyle(0x050406, 0.55).fillRect(0, 0, VIEW_W, VIEW_H);
    // brasas subindo
    for (let i = 0; i < 26; i++) {
      const e = this.add.circle(Phaser.Math.Between(0, VIEW_W), VIEW_H + Phaser.Math.Between(0, 300), Phaser.Math.Between(1, 2), 0xffb050, 0.7);
      this.tweens.add({ targets: e, y: -20, x: e.x + Phaser.Math.Between(-60, 60), alpha: 0, duration: Phaser.Math.Between(7000, 13000), delay: Phaser.Math.Between(0, 6000), repeat: -1 });
    }
    const show = (o, delay, dy = 10) => { o.setAlpha(0); o.y += dy; this.tweens.add({ targets: o, alpha: 1, y: o.y - dy, duration: 1400, delay, ease: "Sine.out" }); return o; };
    if (this.textures.exists("logo_vitula")) { const l = this.add.image(VIEW_W / 2, 74, "logo_vitula"); l.setScale(Math.min(1, 300 / l.width)); show(l, 300); }
    show(this.add.text(VIEW_W / 2, 150, t("demo_end_title"), { fontFamily: FONT_TITLE, fontSize: "56px", color: "#e0bc60", stroke: "#0c0608", strokeThickness: 8, resolution: 2 }).setOrigin(0.5).setShadow(0, 4, "#000", 8, true, true), 900);
    show(this.add.rectangle(VIEW_W / 2, 186, 380, 2, 0x8e2a2c), 1400, 0);
    show(txt(this, VIEW_W / 2, 210, t("demo_end_sub"), 17, "#d8c8a0").setOrigin(0.5), 1800);
    const v = VOCATIONS[info.voc] || {}, min = Math.floor((info.time || 0) / 60), sec = Math.floor((info.time || 0) % 60);
    show(txt(this, VIEW_W / 2, 262, t("demo_end_stats", { voc: v.name || "", lvl: info.level || 1, k: info.kills || 0, g: info.gold || 0, time: `${min}:${String(sec).padStart(2, "0")}` }), 14, COLORS.text, { align: "center", lineSpacing: 6 }).setOrigin(0.5, 0), 2800);
    show(txt(this, VIEW_W / 2, 340, t("demo_end_thanks"), 14, "#c8bca0", { align: "center", wordWrap: { width: 640 }, lineSpacing: 6 }).setOrigin(0.5, 0), 3800);
    show(txt(this, VIEW_W / 2, 412, t("demo_end_tease"), 16, "#e08a60", { align: "center" }).setOrigin(0.5, 0), 5000);
    const btn = (x, label, fn) => {
      const b = this.add.nineslice(x, 478, "button_normal", null, 250, 40, 18, 18, 6, 6).setInteractive({ useHandCursor: true });
      const tx = txt(this, x, 478, label, 15, COLORS.text).setOrigin(0.5);
      b.on("pointerover", () => b.setTexture("button_hover")); b.on("pointerout", () => b.setTexture("button_normal"));
      b.on("pointerup", () => this.ready && fn());
      show(b, 6000, 0); show(tx, 6000, 0);
    };
    btn(VIEW_W / 2 - 135, t("demo_back_town"), () => this.go("town"));
    btn(VIEW_W / 2 + 135, t("demo_menu"), () => this.go("title"));
    this.time.delayedCall(6000, () => { this.ready = true; });
    this.input.keyboard.on("keydown-ENTER", () => this.ready && this.go("town"));
    this.input.keyboard.on("keydown-ESC", () => this.ready && this.go("title"));
    this.cameras.main.fadeIn(1500, 0, 0, 0);
    window.__vitulaDemoEnd = info;
  }
  go(where) {
    if (this.leaving) return; this.leaving = true;
    if (where === "town") this.registry.set("townSpawn", "gate");
    this.cameras.main.fadeOut(800, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start(where));
  }
}
