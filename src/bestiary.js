// Bestiário: cada espécie se revela conforme você a abate (contagem salva por conta, todas as vocações somam).
// Etapas: 1 Avistado (nome, imagem, onde vive) · 2 Conhecido (vida, dano, armadura, comportamento)
//         3 Dominado (fraquezas, resistências, lore) · ★ Completo (+5% de dano e −5% de dano recebido contra a espécie)
// Consultado na Biblioteca de Karhyn.
const BEST_ORDER = ["rat", "bat", "cave_rat", "slime", "spider", "poison_spider", "giant_spider", "skeleton", "giant_rat",
  "goblin", "goblin_scavenger", "goblin_assassin", "goblin_leader"];
const BEST_BONUS = 0.05;

function bestTiers(id) {
  const M = MONSTERS[id];
  if (M.elite) return [1, 3, 10, 25];
  if (M.xp >= 60 || id === "poison_spider") return [1, 25, 100, 250];
  return [1, 50, 250, 500];
}
// abates: salvos + os desta descida (que só são gravados ao voltar)
function bestKills(id, scene) {
  const live = scene && scene.killsByType ? scene.killsByType[id] || 0 : 0;
  return ((Save.data.bestiary || {})[id] || 0) + live;
}
function bestTier(id, scene) { const n = bestKills(id, scene), T = bestTiers(id); let k = 0; while (k < 4 && n >= T[k]) k++; return k; }
function bestComplete(id, scene) { return bestTier(id, scene) >= 4; }

// onde a espécie aparece: andares do esgoto, da encosta, e chefes
function bestHabitat(id) {
  const out = [], rng = a => a.length ? (a.length === 1 ? String(a[0]) : `${a[0]}–${a[a.length - 1]}`) : "";
  const sew = Object.keys(FLOOR_MONSTERS).filter(f => FLOOR_MONSTERS[f].some(([k]) => k === id)).map(Number);
  if (sew.length) out.push(t("best_where_floors", { region: REGIONS.karhyn_sewers.name, f: rng(sew) }));
  for (const r in REGION_MONSTERS) {
    const fl = Object.keys(REGION_MONSTERS[r]).filter(f => REGION_MONSTERS[r][f].some(([k]) => k === id)).map(Number);
    if (fl.length) out.push(t("best_where_floors", { region: REGIONS[r].name, f: rng(fl) }));
  }
  for (const r in REGIONS) if (REGIONS[r].boss === id) out.push(t("best_where_boss", { region: REGIONS[r].name, f: REGIONS[r].floors || FLOORS }));
  if (id === "giant_rat") out.push(t("best_where_boss", { region: REGIONS.karhyn_sewers.name, f: FLOORS }));
  return [...new Set(out)];
}

// ---------------------------------------------------------------- bônus em combate e aviso de etapa
{
  const dm = DungeonScene.prototype.damageMonster;
  DungeonScene.prototype.damageMonster = function (m, amount, ...a) {
    if (m && !m.dead && bestComplete(m.kind, this)) amount *= 1 + BEST_BONUS;
    return dm.call(this, m, amount, ...a);
  };
  const um = DungeonScene.prototype.updateMonster;
  DungeonScene.prototype.updateMonster = function (m, dt) { this.curMon = m; try { return um.call(this, m, dt); } finally { this.curMon = null; } };
  const hh = DungeonScene.prototype.hurtHero;
  DungeonScene.prototype.hurtHero = function (amount, ...a) {
    const m = this.curMon; if (m && bestComplete(m.kind, this)) amount *= 1 - BEST_BONUS;
    return hh.call(this, amount, ...a);
  };
  const md = DungeonScene.prototype.monsterDied;
  DungeonScene.prototype.monsterDied = function (m, ...a) {
    const before = MONSTERS[m.kind] ? bestTier(m.kind, this) : 0;
    const r = md.apply(this, [m, ...a]);
    if (MONSTERS[m.kind]) {
      const after = bestTier(m.kind, this);
      if (after > before) {
        const name = MONSTERS[m.kind].name;
        this.msg(t("best_unlock", { name, tier: t("best_tier_" + after) }) + (after === 4 ? " " + t("best_bonus_on") : ""));
        // Bestiário completo: chance de ganhar um item; raridade conforme a dificuldade da espécie
        if (after === 4 && Math.random() < 0.6) {
          const M = MONSTERS[m.kind], r = M.elite ? 3 : (M.xp >= 60 || m.kind === "poison_spider") ? 2 : 1, d = Save.voc(this.vocId), lv = this.hero.level;
          const pool = Object.keys(EQUIP).filter(id => equipOk(id, this.vocId) && (EQUIP[id].lvl || 1) <= lv + 3 && !EQUIP[id].light);
          const id = pool[Math.floor(Math.random() * pool.length)];
          if (id) { const g = gearNew(id, r); d.gear.push(g); Save.save(); this.msg(t("best_reward", { gear: gearName(g), rarity: RARITY[r].name })); if (this.lootLog) this.lootLog("i_spell_book", gearName(g), "#ffa030", { hex: 0x8a6a30 }); }
        }
        if (this.lootLog) this.lootLog("i_spell_book", t("best_unlock_short", { name, tier: t("best_tier_" + after) }), after === 4 ? "#ffa030" : COLORS.gold, { hex: 0x8a6a30 });
        sfx(this, "levelup", 0.25);
      }
      if (!Save.data.bestTip) { Save.data.bestTip = true; Save.save(); openBestiary(this, m.kind); this.msg(t("best_tip_n")); }
    }
    return r;
  };
}

// na primeira criatura derrotada: ensina o bestiário e onde lê-lo (Biblioteca de Karhyn)
DungeonScene.prototype.bestTipShow = function (name) {
  const W = 470, c = this.add.container(VIEW_W / 2 - W / 2, VIEW_H - 250).setDepth(45).setAlpha(0); this.uiLayer.add(c);
  const body = txt(this, 66, 34, t("best_tip", { name }), 13, COLORS.text, { wordWrap: { width: W - 84 } });
  const H = Math.max(84, body.height + 48);
  c.add(this.add.nineslice(0, 0, "panel", null, W, H, 16, 16, 16, 16).setOrigin(0));
  if (this.textures.exists("i_spell_book")) c.add(this.add.image(34, H / 2, "i_spell_book").setDisplaySize(40, 40));
  c.add(txt(this, 66, 12, t("best_tip_title"), 14, COLORS.gold)); c.add(body);
  this.tweens.add({ targets: c, alpha: 1, duration: 300 });
  this.time.delayedCall(9000, () => this.tweens.add({ targets: c, alpha: 0, duration: 600, onComplete: () => c.destroy() }));
};

// ---------------------------------------------------------------- o livro (Biblioteca de Karhyn)
function openBestiary(scene, sel) {
  closeBestiary(scene);
  const c = scene.add.container(0, 0).setDepth(40); scene.uiLayer.add(c); scene.bestBox = c;
  const W = 880, H = 500, X = VIEW_W / 2 - W / 2, Y = VIEW_H / 2 - H / 2;
  c.add(scene.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x000000, 0.65).setOrigin(0).setInteractive());
  c.add(scene.add.nineslice(X, Y, "panel", null, W, H, 16, 16, 16, 16).setOrigin(0));
  const T_ = (x, y, s, size = 13, col = COLORS.text, o) => { const o2 = txt(scene, x, y, s, size, col, o); c.add(o2); return o2; };
  T_(VIEW_W / 2, Y + 22, t("best_title"), 24, COLORS.gold).setOrigin(0.5);
  const seen = BEST_ORDER.filter(id => bestTier(id, scene) > 0).length, done = BEST_ORDER.filter(id => bestComplete(id, scene)).length;
  T_(VIEW_W / 2, Y + 48, t("best_progress", { s: seen, d: done, n: BEST_ORDER.length }), 12, COLORS.dim).setOrigin(0.5);
  T_(X + W - 22, Y + 16, "ESC", 11, COLORS.dim).setOrigin(1, 0);
  sel = sel || BEST_ORDER.find(id => bestTier(id, scene) > 0) || BEST_ORDER[0];
  // ---- lista
  const lx = X + 22, ly = Y + 70, rowH = 31;
  BEST_ORDER.forEach((id, i) => {
    const tier = bestTier(id, scene), on = id === sel, y = ly + i * rowH;
    const r = scene.add.rectangle(lx, y, 260, rowH - 4, on ? 0x3a2e1c : 0x16120f, 1).setOrigin(0).setStrokeStyle(1, on ? 0xe0bc60 : 0x3a3024).setInteractive({ useHandCursor: true });
    r.on("pointerup", () => openBestiary(scene, id)); c.add(r);
    const ma = MON_ANIM[id], key = ma && scene.textures.exists(ma[1]) ? ma[1] : MONSTERS[id].tex;
    if (scene.textures.exists(key)) {
      const im = scene.add.image(lx + 18, y + (rowH - 4) / 2, key, 0); im.setScale(26 / Math.max(im.width, im.height));
      if (MONSTERS[id].tint) im.setTint(MONSTERS[id].tint);
      if (!tier) im.setTintFill(0x050404).setAlpha(0.8);
      c.add(im);
    }
    T_(lx + 38, y + 7, tier ? MONSTERS[id].name : "???", 13, tier ? (tier >= 4 ? "#ffb050" : COLORS.text) : COLORS.dim);
    T_(lx + 252, y + 8, "★".repeat(Math.max(0, tier - 1)) + "☆".repeat(3 - Math.max(0, tier - 1)), 11, tier >= 4 ? "#ffb050" : COLORS.gold).setOrigin(1, 0);
  });
  // ---- página
  const px = X + 310, py = Y + 70, pw = W - 330, M = MONSTERS[sel], tier = bestTier(sel, scene), n = bestKills(sel, scene), T = bestTiers(sel);
  c.add(scene.add.rectangle(px, py, pw, H - 84, 0x120e0c, 0.85).setOrigin(0).setStrokeStyle(1, 0x5a4630));
  const ma = MON_ANIM[sel], key = ma && scene.textures.exists(ma[1]) ? ma[1] : M.tex;
  const ix = px + 110, iy = py + 120;
  c.add(scene.add.image(ix, iy + 10, "light").setScale(0.7).setTint(tier >= 4 ? 0xd07010 : 0x6a4a2a).setAlpha(tier ? 0.55 : 0.15).setBlendMode(Phaser.BlendModes.ADD));
  if (scene.textures.exists(key)) {
    const sp = scene.add.sprite(ix, iy, key, 0); sp.setScale(Math.min(4, 170 / Math.max(sp.width, sp.height)));
    sp.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    if (M.tint) sp.setTint(M.tint);
    if (!tier) sp.setTintFill(0x050404).setAlpha(0.85); else if (scene.anims.exists(key)) sp.play(key);
    c.add(sp);
  }
  const tx = px + 230, tw = pw - 250;
  T_(tx, py + 18, tier ? M.name : "???", 24, tier >= 4 ? "#ffb050" : COLORS.gold);
  T_(tx, py + 50, tier ? t("best_tier_" + tier) : t("best_unknown"), 13, tier >= 4 ? "#ffb050" : "#c8b890");
  // barra até a próxima etapa
  const next = T[Math.min(3, tier)], prev = tier ? T[tier - 1] : 0, f = tier >= 4 ? 1 : Phaser.Math.Clamp((n - prev) / Math.max(1, next - prev), 0, 1);
  c.add(scene.add.rectangle(tx, py + 76, tw, 10, 0x2a2420).setOrigin(0));
  c.add(scene.add.rectangle(tx, py + 76, tw * f, 10, tier >= 4 ? 0xd08020 : 0x8e6a30).setOrigin(0));
  T_(tx, py + 90, tier >= 4 ? t("best_kills_done", { n }) : t("best_kills_next", { n, next, tier: t("best_tier_" + (tier + 1)) }), 11, COLORS.dim);
  let y = py + 112;
  const head = s => { T_(tx, y, s, 14, COLORS.gold); y += 19; };
  const row = (k, v, col = COLORS.text) => { T_(tx + 6, y, k, 12, COLORS.dim); T_(tx + tw, y, v, 12, col).setOrigin(1, 0); y += 17; };
  const lock = need => { T_(tx + 6, y, t("best_locked", { tier: t("best_tier_" + need), n: T[need - 1] }), 12, "#7a6a58", { fontStyle: "italic" }); y += 22; };
  // etapa 1: onde vive
  head(t("best_h_where"));
  if (tier >= 1) { for (const w of bestHabitat(sel)) { T_(tx + 6, y, "• " + w, 12, COLORS.text, { wordWrap: { width: tw - 6 } }); y += 17; } y += 4; } else lock(1);
  // etapa 2: atributos e comportamento
  head(t("best_h_stats"));
  if (tier >= 2) {
    // duas colunas para caber na página
    const half = (tw - 16) / 2, cell = (k, v, col) => { T_(tx + 6 + col * (half + 16), y, k, 12, COLORS.dim); T_(tx + 6 + col * (half + 16) + half - 6, y, v, 12, COLORS.text).setOrigin(1, 0); };
    cell(t("best_hp"), String(M.hp), 0); cell(t("best_dmg"), String(Math.round(M.dmg)), 1); y += 17;
    cell(t("best_arm"), String(M.arm), 0); cell(t("best_xp"), String(M.xp), 1); y += 17;
    cell(t("best_speed"), M.step <= 0.4 ? t("best_fast") : M.step >= 0.6 ? t("best_slow") : t("best_normal"), 0); y += 19;
    const b = T_(tx + 6, y, t("best_beh_" + sel), 12, "#d8c8a0", { wordWrap: { width: tw - 6 } }); y += b.height + 8;
  } else lock(2);
  // etapa 3: fraquezas e lore
  head(t("best_h_lore"));
  if (tier >= 3) {
    const R = MONSTER_RES[sel] || {}, weak = Object.keys(R).filter(k => R[k] < 0), strong = Object.keys(R).filter(k => R[k] > 0);
    const fmt = ks => ks.map(k => `${ELEMENTS[k].name} ${R[k] > 0 ? "+" : ""}${Math.round(R[k] * 100)}%`).join(" · ") || t("best_none");
    row(t("best_weak"), fmt(weak), "#7ee07e"); row(t("best_strong"), fmt(strong), "#e09070");
    const l = T_(tx + 6, y + 2, "“" + t("best_lore_" + sel) + "”", 12, "#c8b890", { wordWrap: { width: tw - 6 }, fontStyle: "italic" }); y += l.height + 8;
  } else lock(3);
  // rodapé da página (debaixo da imagem, largura toda)
  const foot = tier >= 4 ? t("best_bonus_active", { p: Math.round(BEST_BONUS * 100) }) : t("best_bonus_hint", { n: T[3], p: Math.round(BEST_BONUS * 100) });
  T_(px + 16, py + 250, foot, 11, tier >= 4 ? "#ffb050" : COLORS.dim, { wordWrap: { width: 196 } });
  for (const o of c.list) if (o.type === "Text") o.setShadow(1, 1, "#000000", 0, true, true);
  scene.bestSel = sel;
}
function closeBestiary(scene) { if (scene.bestBox) { scene.bestBox.destroy(); scene.bestBox = null; } }
