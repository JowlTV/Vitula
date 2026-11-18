// Tutorial: a Floresta de Karhyn. Na primeira vez que se escolhe uma classe, o herói chega pela floresta,
// aprende os comandos numa trilha curta e, ao achar a saída, vê a história e entra na cidade.
// Depois disso (Save.data.foundKarhyn), escolher o personagem abre o mapa para decidir onde cair.
REGIONS.forest = { name: "Rook Forest", desc: "A floresta antes de Karhyn.", pos: [0, 0], floors: 1, cave: true, theme: "slope", forest: true, tutorial: true, hidden: true };
REGION_MONSTERS.forest = { 1: [["rat", 60], ["bat", 40]] };

// escolheu a classe: floresta na primeira vez, depois o mapa (cidade, encosta…)
function startAdventure(scene) {
  // cada personagem novo começa na Rook Forest; depois de achar Karhyn, escolhe onde cair no mapa
  if (!Save.voc(scene.registry.get("vocation") || "knight").foundKarhyn) {
    scene.registry.set("region", "forest"); scene.registry.set("startFloor", 1);
    stopAllButMusic(scene); scene.scene.start("dungeon");
  } else { scene.registry.set("townSpawn", "gate"); scene.scene.start("town"); }   // sem mapa: sempre cai em Karhyn
}

// as teclas vão marcadas com «…» e o painel as desenha em destaque
const keyOf = id => "«" + Settings.keyLabel((Settings.data.keys[id] || [])[0] || "?") + "»";
const TUT_STEPS = [
  ["move", () => t("tut_move", { k: ["up", "left", "down", "right"].map(keyOf).join(" ") }), e => e.moves >= 6],
  ["attack", () => t("tut_attack", { k: keyOf("attack"), a: keyOf("autoAttack") }), e => e.attackKey],
  ["loot", () => t("tut_loot"), e => e.loot],
  ["heal", () => t("tut_heal", { k: keyOf("heal"), p: keyOf("potion1") }), e => e.heal || e.cast],
  ["bag", () => t("tut_bag", { k: keyOf("bag") }), e => e.bag],
  ["map", () => t("tut_map", { k: keyOf("map") }), e => e.map],
  ["exit", () => t("tut_exit", { e: keyOf("interact"), h: keyOf("recall") }), e => false],
];

Object.assign(DungeonScene.prototype, {
  tutStart() {
    Settings.data.autoAttack = false; Settings.save();   // começa no ataque manual
    this.tut = { moves: 0, kills: 0, step: -1 };
    // provisões para aprender a curar e algo no chão para aprender a pegar
    const d = Save.voc(this.vocId); if ((d.potions.health || 0) < 2) { d.potions.health = 2; Save.save(); this.refreshPotionIcons && this.refreshPotionIcons(); }
    const h = this.hero, spots = this.freeNeighbors(h.x, h.y);
    // ratos e morcegos espalhados pela trilha (não é objetivo matá-los)
    const alive = this.monsters.filter(m => !m.dead).length;
    if (alive < 8) { const g = this.gen, far = [...Array(g.w * g.h).keys()].map(i => ({ x: i % g.w, y: (i / g.w) | 0 }))
        .filter(c => g.isWalk(c.x, c.y) && !this.occ.has(key(c.x, c.y)) && Math.abs(c.x - h.x) + Math.abs(c.y - h.y) > 8);
      Phaser.Utils.Array.Shuffle(far).slice(0, 8 - alive).forEach(c => this.spawnMonster(Math.random() < 0.6 ? "rat" : "bat", c.x, c.y)); }
    if (spots[1]) this.drop(spots[1].x, spots[1].y, "bread");
    if (spots[3]) this.drop(spots[3].x, spots[3].y, "gold");
    if (spots[5] && !this.props.has(key(spots[5].x, spots[5].y))) this.addProp(spots[5].x, spots[5].y, "forest_sign");
    // painel do tutorial
    const c = this.add.container(VIEW_W / 2, 62).setDepth(16); this.uiLayer.add(c); this.tutBox = c;
    this.tutBg = this.add.nineslice(0, 0, "panel", null, 560, 70, 16, 16, 16, 16).setOrigin(0.5, 0);
    this.tutHead = txt(this, -262, 10, "", 12, COLORS.gold);
    this.tutText = this.add.container(-262, 28);
    this.tutSkip = txt(this, 262, 10, t("tut_skip"), 11, COLORS.dim).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    this.tutSkip.on("pointerup", () => this.tutEnd(true));
    c.add([this.tutBg, this.tutHead, this.tutText, this.tutSkip]);
    for (const o of c.list) if (o.type === "Text") o.setShadow(1, 1, "#000", 0, true, true);
    // atalhos que contam para o tutorial
    const on = (id, f) => (this.keysIn[id] || []).forEach(k => k.on("down", () => { if (this.tut) { f(); this.tutCheck(); } }));
    on("attack", () => { this.tut.attackKey = true; });
    on("autoAttack", () => { this.tut.auto = true; });
    on("bag", () => { this.tut.bag = true; });
    on("map", () => { this.tut.map = true; });
    this.msg(t("tut_welcome"));
    this.tutCheck();
  },
  // texto com as teclas em destaque: «W» vira uma plaquinha dourada; quebra de linha manual em 520 px
  tutRich(s) {
    const box = this.tutText; box.removeAll(true);
    const W = 520, LH = 22; let x = 0, y = 0;
    for (const tok of s.split(/(«[^»]*»|\s+)/).filter(Boolean)) {
      if (/^\s+$/.test(tok)) { x += 5; continue; }
      const isKey = tok[0] === "«";
      const o = txt(this, 0, 0, isKey ? tok.slice(1, -1) : tok, 14, isKey ? "#ffd870" : COLORS.text).setShadow(1, 1, "#000", 0, true, true);
      const w = o.width + (isKey ? 12 : 0);
      if (x + w > W && x > 0) { x = 0; y += LH; }
      if (isKey) { box.add(this.add.rectangle(x, y + 1, w, LH - 3, 0x4a2e10).setOrigin(0).setStrokeStyle(1, 0xe0bc60)); o.setPosition(x + 6, y + 2); }
      else o.setPosition(x, y + 1);
      box.add(o); x += w;
    }
    return y + LH;
  },
  tutCheck() {
    const e = this.tut; if (!e) return;
    let i = TUT_STEPS.findIndex(([, , done]) => !done(e));
    if (i < 0) i = TUT_STEPS.length - 1;
    if (i !== e.step) {
      if (e.step >= 0) { sfx(this, "pickup", 0.4); this.tweens.add({ targets: this.tutBox, scale: 1.04, duration: 110, yoyo: true }); }
      e.step = i;
    }
    const [id, text] = TUT_STEPS[i];
    this.tutHead.setText(t("tut_head", { n: i + 1, total: TUT_STEPS.length }));
    const hgt = this.tutRich(text());
    this.tutBg.setSize(560, Math.max(70, hgt + 44));
  },
  // fim: achou a saída (ou pulou). Guarda o que ganhou, mostra a história e entra na cidade.
  tutEnd(skipped) {
    if (this.tutDone) return; this.tutDone = true;
    Save.voc(this.vocId).foundKarhyn = true;
    const earned = Math.round(this.goldRun * (this.stats.greed || 1));
    Save.addGold(this.vocId, earned); Save.addKills(this.killsByType); Save.save();
    this.finished = true;
    this.msg(skipped ? t("tut_skipped") : t("tut_found"));
    this.registry.set("townSpawn", "gate");
    this.cameras.main.fadeOut(1200, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => { stopAllButMusic(this); this.scene.start("intro"); });   // a música da floresta continua até Karhyn
  },
});

{
  const cr = DungeonScene.prototype.create;
  DungeonScene.prototype.create = function (...a) {
    this.tut = null; this.tutDone = false; this.tutBox = null;
    cr.apply(this, a);
    if (this.region && this.region.tutorial) this.tutStart();
  };
  const tm = DungeonScene.prototype.tryMove;
  DungeonScene.prototype.tryMove = function (dx, dy) {
    const before = this.hero.moveT; const r = tm.call(this, dx, dy);
    if (this.tut && this.hero.moveT > 0 && !before) { this.tut.moves++; this.tutCheck(); }
    return r;
  };
  const ca = DungeonScene.prototype.cast;
  DungeonScene.prototype.cast = function (sp, ...a) {
    const before = this.hero && this.hero.cds ? this.hero.cds[sp] || 0 : 0; const r = ca.call(this, sp, ...a);
    if (this.tut && this.hero.cds && (this.hero.cds[sp] || 0) > before) { if (sp === "heal") this.tut.heal = true; else this.tut.cast = true; this.tutCheck(); }
    return r;
  };
  const up = DungeonScene.prototype.usePotion;
  DungeonScene.prototype.usePotion = function (slot) {
    const d = Save.voc(this.vocId), n0 = JSON.stringify(d.potions); const r = up.call(this, slot);
    if (this.tut && JSON.stringify(d.potions) !== n0) { this.tut.heal = true; this.tutCheck(); }
    return r;
  };
  const md = DungeonScene.prototype.monsterDied;
  DungeonScene.prototype.monsterDied = function (m, ...a) { const r = md.call(this, m, ...a); if (this.tut) { this.tut.kills++; this.tutCheck(); } return r; };
  const col = DungeonScene.prototype.collect;
  DungeonScene.prototype.collect = function (k) { const r = col.call(this, k); if (this.tut) { this.tut.loot = true; this.tutCheck(); } return r; };
  // a saída da floresta leva a Karhyn (não a outro andar)
  const ha = DungeonScene.prototype.heroArrived;
  DungeonScene.prototype.heroArrived = function () {
    const h = this.hero;
    if (this.region && this.region.tutorial && this.stairs && h.x === this.stairs.x && h.y === this.stairs.y) {
      const k = key(h.x, h.y); if (this.pickups.has(k)) this.collect(k);
      this.tutEnd(false); return;
    }
    return ha.call(this);
  };
  // na floresta ninguém morre de verdade: o dano chega pela metade
  const hh = DungeonScene.prototype.hurtHero;
  DungeonScene.prototype.hurtHero = function (amount, ...a) { if (this.region && this.region.tutorial) amount *= 0.5; return hh.call(this, amount, ...a); };
}
if (typeof Lang !== "undefined" && Lang.apply) Lang.apply();
// na floresta não há corda de volta: o caminho é para a frente
{ const ur = DungeonScene.prototype.useRope;
  DungeonScene.prototype.useRope = function (...a) {
    if (this.region && this.region.tutorial) { const h = this.hero; if (this.rope && h.x === this.rope.x && h.y === this.rope.y) { this.msg(t("tut_no_rope")); return; } }
    return ur.apply(this, a);
  }; }
// Rook Forest: poucos bichos (no máximo 6) e sem hordas
{ const sm = DungeonScene.prototype.spawnMonster;
  DungeonScene.prototype.spawnMonster = function (kind, x, y) {
    if (this.region && this.region.tutorial && (this.monsters || []).filter(m => !m.dead).length >= 12) return null;
    return sm.call(this, kind, x, y);
  };
  const sw = DungeonScene.prototype.spawnWave;
  DungeonScene.prototype.spawnWave = function (...a) { if (this.region && this.region.tutorial) return false; return sw.apply(this, a); }; }

// Rook Forest: sem Recall, e o mapa já vem todo revelado para achar a saída (nos esgotos o jogador explora sozinho)
{
  const sr = DungeonScene.prototype.startRecall;
  DungeonScene.prototype.startRecall = function (...a) { if (this.region && this.region.tutorial) { this.msg(t("tut_no_recall")); return; } return sr.apply(this, a); };
  const bf = DungeonScene.prototype.buildFloor;
  DungeonScene.prototype.buildFloor = function (...a) {
    const r = bf.apply(this, a);
    if (this.region && this.region.tutorial && this.explored) { this.explored.fill(1); if (this.drawMinimap) this.drawMinimap(); }
    return r;
  };
}
