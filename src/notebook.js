// Caderno do aventureiro (tecla N): resumo de bolso do Bestiário. A versão completa fica na Biblioteca de Karhyn.
// Mostra só as espécies já avistadas: etapa, abates até a próxima etapa, vida/dano (a partir de "Conhecido") e onde vive.
function closeNotebook(scene) { if (scene.noteBox) { scene.noteBox.destroy(); scene.noteBox = null; } }
function openNotebook(scene, sel = null, intro = false) {
  closeNotebook(scene);
  const c = scene.add.container(0, 0).setDepth(45); scene.uiLayer.add(c); scene.noteBox = c;
  const W = 620, H = 440, X = VIEW_W / 2 - W / 2, Y = VIEW_H / 2 - H / 2;
  c.add(scene.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x000000, 0.55).setOrigin(0).setInteractive().on("pointerdown", () => closeNotebook(scene)));
  c.add(scene.add.rectangle(X, Y, W, H, 0xd8c49a).setOrigin(0).setStrokeStyle(3, 0x5a3e22).setInteractive());
  c.add(scene.add.rectangle(X + 6, Y + 6, W - 12, H - 12, 0xe6d6b0).setOrigin(0));
  c.add(scene.add.rectangle(X + W / 2, Y + 6, 4, H - 12, 0x8a6a44, 0.6).setOrigin(0.5, 0));
  const ink = "#3a2814", T_ = (x, y, s, size = 12, col = ink) => { const o2 = txt(scene, x, y, s, size, col); o2.setShadow(0, 0, "#000", 0, false, false).setStroke("#000", 0); c.add(o2); return o2; };
  T_(X + W / 2, Y + 14, t("note_title"), 17, "#5a2a10").setOrigin(0.5, 0);
  if (intro) T_(X + W / 2, Y + 36, t("note_intro"), 11, "#6a3010").setOrigin(0.5, 0).setWordWrapWidth(W - 60).setAlign("center");
  const top = Y + (intro ? 80 : 46);
  const key = id => { const ma = MON_ANIM[id]; return ma && scene.textures.exists(ma[1]) ? ma[1] : MONSTERS[id].tex; };
  const ids = BEST_ORDER.filter(id => MONSTERS[id]);
  if (!sel || !ids.includes(sel)) sel = ids.find(id => bestTier(id, scene) >= 1) || ids[0];
  // página esquerda: grade de espécies (silhueta = ainda não vista)
  const cols = 4, cw = 66, ch = 66, gx = X + 24, gy = top;
  ids.forEach((id, i) => {
    const x = gx + (i % cols) * cw, y = gy + Math.floor(i / cols) * ch, tier = bestTier(id, scene), on = id === sel;
    const r = scene.add.rectangle(x, y, cw - 6, ch - 6, on ? 0xc8a868 : 0xd8c498).setOrigin(0).setStrokeStyle(on ? 2 : 1, on ? 0x6a3010 : 0x8a6a44).setInteractive({ useHandCursor: true });
    r.on("pointerdown", () => openNotebook(scene, id, intro)); c.add(r);
    const k = key(id); if (scene.textures.exists(k)) { const im = scene.add.image(x + (cw - 6) / 2, y + (ch - 6) / 2, k, 0); im.setScale(44 / Math.max(im.width, im.height)); if (MONSTERS[id].tint) im.setTint(MONSTERS[id].tint); if (!tier) im.setTintFill(0x2a2014).setAlpha(0.7); c.add(im); }
    if (tier >= 4) T_(x + cw - 12, y + 2, "★", 11, "#a05000").setOrigin(1, 0);
  });
  // página direita: ficha curta
  const M = MONSTERS[sel], tier = bestTier(sel, scene), n = bestKills(sel, scene), T = bestTiers(sel), rx = X + W / 2 + 22, rw = W / 2 - 44;
  const k = key(sel);
  if (scene.textures.exists(k)) { const sp = scene.add.image(rx + rw / 2, top + 50, k, 0); sp.setScale(Math.min(3, 90 / Math.max(sp.width, sp.height))); if (M.tint) sp.setTint(M.tint); if (!tier) sp.setTintFill(0x2a2014).setAlpha(0.75); c.add(sp); }
  T_(rx + rw / 2, top + 104, tier ? M.name : "???", 16, "#4a1a0a").setOrigin(0.5, 0);
  T_(rx + rw / 2, top + 126, tier ? t("best_tier_" + tier) + (tier >= 4 ? " ★" : "") : t("best_unknown"), 11, "#6a4a20").setOrigin(0.5, 0);
  const lines = [];
  if (tier) {
    lines.push(tier < 4 ? t("note_next", { n, need: T[tier] }) : t("note_bonus"));
    lines.push(tier >= 2 ? t("note_stats", { hp: Math.round(M.hp), dmg: Math.round(M.dmg), arm: M.arm }) : t("note_unknown"));
    const hab = bestHabitat(sel); if (hab.length) lines.push(hab[0]);
  }
  T_(rx, top + 150, lines.join("\n"), 11, ink).setWordWrapWidth(rw).setLineSpacing(4);
  // missões ativas (por enquanto, o contrato de caça do mural)
  { const ct = Save.voc(scene.vocId).contract, CM = ct && MONSTERS[ct.kind];
    T_(X + 26, Y + H - 58, t("note_missions"), 13, "#4a1a0a");
    T_(X + 26, Y + H - 40, ct ? t("note_contract", { got: Math.min(ct.got || 0, ct.n), n: ct.n, name: CM ? CM.name : "?" }) : t("note_no_missions"), 11, ink).setWordWrapWidth(W / 2 - 50); }
  T_(X + W - 24, Y + H - 26, t("note_foot2"), 10, "#6a5030").setOrigin(1, 0);
  sfx(scene, "pickup", 0.25);
}
for (const S of [DungeonScene, TownScene]) {
  const cr = S.prototype.create;
  S.prototype.create = function (...a) {
    const r = cr.apply(this, a); this.noteBox = null;
    const K = Phaser.Input.Keyboard.KeyCodes;
    for (const n of (Settings.data.keys.notebook || ["N"])) if (K[n] !== undefined) this.input.keyboard.addKey(K[n]).on("down", () => this.noteBox ? closeNotebook(this) : openNotebook(this));
    this.input.keyboard.on("keydown-ESC", () => closeNotebook(this));
    return r;
  };
}
