// Mochila (tecla I): equipamentos, status agrupados e inventário. O jogo pausa enquanto está aberta.
Object.assign(DungeonScene.prototype, {

  toggleBag() {
    if (this.finished || this.paused || this.attrBox) return;
    this.bagOpen = !this.bagOpen;
    if (this.bagBox) { this.bagBox.destroy(); this.bagBox = null; }
    hideItemCard(this);
    if (this.bagOpen) this.buildBag();
  },

  buildBag() {
    if (this.bagBox) this.bagBox.destroy();
    hideItemCard(this);
    const c = this.add.container(0, 0).setDepth(30); this.uiLayer.add(c); this.bagBox = c;
    const h = this.hero, d = Save.voc(this.vocId);
    this.input.mouse && this.input.mouse.disableContextMenu();
    c.add(this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x000000, 0.6).setOrigin(0).setInteractive());
    const W = 860, H = 500, X = VIEW_W / 2 - W / 2, Y = VIEW_H / 2 - H / 2 - 8;
    c.add(this.add.nineslice(X, Y, "panel", null, W, H, 16, 16, 16, 16).setOrigin(0));
    const T_ = (x, y, s, size = 13, col = COLORS.text, o) => { const t = txt(this, x, y, s, size, col, o); c.add(t); return t; };
    T_(VIEW_W / 2, Y + 22, t("bag_title"), 24, COLORS.gold).setOrigin(0.5);
    T_(X + W - 22, Y + 16, "I / ESC fecha", 11, COLORS.dim).setOrigin(1, 0);

    // ---- equipamentos (layout do Tibia)
    const ex = X + 30, ey = Y + 64, S = 50, G = 10;
    T_(ex, ey - 22, t("equipment"), 15, COLORS.gold);
    const slots = [[t("slot_amulet"), 0, 0], [t("slot_helmet"), 1, 0], [t("slot_backpack"), 2, 0], [t("slot_weapon"), 0, 1], [t("slot_armor"), 1, 1], [t("slot_shield"), 2, 1],
      [t("slot_ring"), 0, 2], [t("slot_legs"), 1, 2], [t("slot_light"), 2, 2], [t("slot_boots"), 1, 3]];
    // detalhes do item sob o mouse (linha no rodapé da mochila)
    const tip = T_(X + 30, Y + H - 34, t("bag_tip"), 12, COLORS.dim, { wordWrap: { width: W - 60 } });
    const showTip = (g, extra = "") => { const E = EQUIP[g.id], R = RARITY[g.r], low = this.hero.level < E.lvl, bad = !equipOk(g.id, this.vocId);
      tip.setText(`${gearName(g)} · ${R.name}${t("tip_level", { n: E.lvl })}${bad ? t("tip_wrong_voc") : ""}${extra}\n${equipStats(g)}${E.desc ? " — " + E.desc : ""}`).setColor(low || bad ? "#e08070" : R.color); };
    const _sn = n => { const m = { helmet: t("slot_helmet"), weapon: t("slot_weapon"), armor: t("slot_armor"), shield: t("slot_shield"), legs: t("slot_legs"), boots: t("slot_boots"), light: t("slot_light") }; return Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k])); }; const slotOf = _sn();
    for (const [name, cx, cy] of slots) {
      const sx = ex + cx * (S + G), sy = ey + cy * (S + 22), sl = slotOf[name], g = sl && d.equip[sl], id = g && g.id;
      c.add(this.add.nineslice(sx, sy, "slot", null, S, S, 4, 4, 4, 4).setOrigin(0));
      T_(sx + S / 2, sy + S + 2, name, 10, COLORS.dim).setOrigin(0.5, 0);
      if (id && EQUIP[id]) {
        c.add(this.add.rectangle(sx + 3, sy + 3, S - 6, S - 6).setOrigin(0).setStrokeStyle(2, RARITY[g.r].hex, g.r ? 1 : 0));
        c.add(this.add.image(sx + S / 2, sy + S / 2, "eq_" + id).setScale(1.25));
        if (g.p) T_(sx + S - 4, sy + S - 14, `+${g.p}`, 10, RARITY[g.r].color).setOrigin(1, 0);
        const hit = this.add.rectangle(sx, sy, S, S, 0, 0.001).setOrigin(0).setInteractive({ useHandCursor: true }); c.add(hit);
        hit.on("pointerover", () => { showTip(g, t("tip_worn")); showItemCard(this, g, { worn: true, hint: t("card_hint_unequip") }); });
        hit.on("pointerout", () => hideItemCard(this));
        hit.on("pointerup", () => { this.unequipSlot(sl); this.buildBag(); });
      }
    }

    // ---- status
    const sx = X + 240, sy = Y + 64;
    const sk = id => { const s = Save.skill(this.vocId, id); return `${s.lvl}  (${Math.floor(100 * s.tries / skillTriesNeeded(id, s.lvl))}%)`; };
    const ml = d.ml, mlPct = Math.floor(100 * ml.spent / mlNeeded(this.vocId, ml.lvl));
    const mx = this.maxDamage();
    const groups = [
      [t("attack_label"), [[t("base_dmg"), `${Math.round(mx * 0.6)}–${Math.round(mx)}` + (this.stats.weapon && !this.ranged && this.stats.weapon.elDmg ? ` +${this.stats.weapon.elDmg} ${ELEMENTS[this.stats.weapon.el].name.toLowerCase()}` : "")], [t("atk_speed"), `${this.attacksPerSec().toFixed(2)} ${t("hits_per_sec")}`], [t("critical"), `${(this.critChance() * 100).toFixed(1).replace(".", ",")}% (×1,8)`]].concat(this.ranged ? [[t("arrows_label"), `${arrowCount(Save.voc(this.vocId))} / ${arrowCap(Save.voc(this.vocId))}`]] : [])],
      [t("defense_label"), [[t("total_hp"), `${Math.ceil(h.hp)} / ${Math.round(h.maxHp)}`], [t("defense_value"), this.defenseValue().toFixed(1)], [t("block_chance"), `${Math.round(this.blockChance() * 100)}%`],
        [t("regen_label"), t("regen_line", { hp: (this.stats.recovery || 0).toFixed(1).replace(".", ","), res: (this.stats.manaReg || 0).toFixed(1).replace(".", ","), kind: VOCATIONS[this.vocId].mana ? t("word_mana") : t("word_fury") })],
        [t("resistances"), Object.keys(this.stats.res || {}).filter(k => this.stats.res[k]).map(k => `${ELEMENTS[k].name} ${this.stats.res[k] > 0 ? "+" : ""}${Math.round(this.stats.res[k] * 100)}%`).join(" · ") || t("no_resist")]]],
      [t("skills_label"), [this.ranged ? ["Distance", sk("distance") + (this.buffOn("hunter") ? "  +10" : "")] : ["Sword", sk("sword") + (this.buffOn("berserker") ? "  +10" : "")], ["Shield", sk("shield")],
        ["Magic level", `${ml.lvl}  (${mlPct}%)` + (this.buffOn("mage") ? "  +10" : "")]]],
      [t("progress_label"), [[t("level_label"), String(h.level) + (this.promo() ? ` · ${this.promo().name}` : "")], [t("total_xp"), String(Math.floor(d.xpTotal || 0))],
        [t("xp_next"), String(Math.ceil(this.xpNext() - h.xp))]]],
    ];
    let yy = sy - 22;
    for (const [title, rows] of groups) {
      T_(sx, yy, title, 15, COLORS.gold); yy += 20;
      for (const [k, v] of rows) { T_(sx + 8, yy, k, 12, COLORS.dim); T_(sx + 300, yy, v, 12, COLORS.text).setOrigin(1, 0); yy += 17; }
      yy += 6;
    }

    // ---- inventário: abas Mochila / Poções
    const ix = X + 580, iy = Y + 54, iw = W - 600;
    const tab = this.bagTab || "items";
    [["items", t("tab_backpack")], ["potions", t("tab_potions")]].forEach(([id, label], k) => {
      const on = tab === id, bx = ix + k * (iw / 2);
      const b = this.add.rectangle(bx, iy, iw / 2 - 4, 24, on ? 0x3a2e1c : 0x1a1612, 1).setOrigin(0).setStrokeStyle(1, on ? 0xe0bc60 : 0x4a3a2a).setInteractive({ useHandCursor: true });
      b.on("pointerup", () => { this.bagTab = id; this.buildBag(); }); c.add(b);
      T_(bx + (iw / 2 - 4) / 2, iy + 12, label, 13, on ? COLORS.gold : COLORS.dim).setOrigin(0.5);
    });
    // linha de recursos (ouro, chaves, óleo), sempre visível
    const ry = iy + 36;
    c.add(this.add.image(ix + 8, ry + 8, "i_gold_coin").setScale(1));
    T_(ix + 20, ry, t("bag_gold_line", { run: this.goldRun, saved: Save.gold(this.vocId) }), 11, COLORS.gold);

    { const L = d.equip.light && EQUIP[d.equip.light.id], oil = Math.ceil((d.oil || 0) / 60);
      T_(ix, ry + 19, L ? (L.light.fuel ? t("oil_label", { n: oil }) + (d.oil > 0 ? "" : " · " + t("oil_empty")) : t("goddess_light")) : t("no_light"), 11, L && (!L.light.fuel || d.oil > 0) ? "#ffd27a" : COLORS.dim); }
    // capacidade (peso)
    { const cap = capOf(this.vocId, h.level), ld = loadOf(this.vocId), f = Math.min(1, ld / cap), st = capState(this);
      const col = st === 2 ? "#e07060" : st === 1 ? "#e0b060" : COLORS.text;
      T_(ix, ry + 38, t("cap_line", { w: fmtOz(ld), c: cap }) + (st ? " · " + t(st === 2 ? "cap_slow20" : "cap_slow5") : ""), 11, col);
      c.add(this.add.rectangle(ix, ry + 54, iw, 5, 0x2a2420).setOrigin(0));
      c.add(this.add.rectangle(ix, ry + 54, iw * f, 5, st === 2 ? 0xc04030 : st === 1 ? 0xc09030 : 0x6a8a3a).setOrigin(0)); }
    const top = ry + 76;
    if (tab === "items") {
      // a mochila desenhada, com as casas marcadas
      const cols = 6, rows = 5, GS = 40, gw = cols * GS, gh = rows * GS, gx0 = ix + (iw - gw) / 2, gy0 = top + 40;
      const bag = this.add.graphics(); c.add(bag);
      const bx = gx0 - 12, by = gy0 - 26, bw = gw + 24, bh = gh + 38;
      bag.fillStyle(0x3a2616, 1).fillRoundedRect(bx, by, bw, bh, 14);                     // couro
      bag.fillStyle(0x4c3220, 1).fillRoundedRect(bx + 4, by + 4, bw - 8, 20, 10);           // aba de cima
      bag.lineStyle(2, 0x1e140c, 1).strokeRoundedRect(bx, by, bw, bh, 14);
      bag.lineStyle(1, 0x6a4a2c, 0.9).strokeRoundedRect(bx + 4, by + 4, bw - 8, bh - 8, 11);  // costura
      bag.fillStyle(0x8a6a3a, 1).fillRect(bx + bw / 2 - 10, by + 14, 20, 12);               // fivela
      bag.fillStyle(0x2a1a0e, 1).fillRect(bx + bw / 2 - 5, by + 17, 10, 6);
      T_(ix + iw / 2, top - 2, t("stored_gear", { n: d.gear.length }) + (d.essence ? ` · ${t("essences_label", { n: d.essence })}` : ""), 12, COLORS.gold).setOrigin(0.5, 0);
      for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++)
        c.add(this.add.rectangle(gx0 + k * GS + 2, gy0 + r * GS + 2, GS - 4, GS - 4, 0x1a120c, 1).setOrigin(0).setStrokeStyle(1, 0x5a4026, 1));
      const page = d.gear.slice(0, cols * rows);
      page.forEach((g, i) => {
        const id = g.id; if (!EQUIP[id]) return;
        const gx = gx0 + (i % cols) * GS + 2, gy = gy0 + Math.floor(i / cols) * GS + 2, ok = equipOk(id, this.vocId) && h.level >= EQUIP[id].lvl;
        if (g.r || !ok) c.add(this.add.rectangle(gx, gy, GS - 4, GS - 4).setOrigin(0).setStrokeStyle(2, ok ? RARITY[g.r].hex : 0x8a2a2a, 1));
        const im = this.add.image(gx + (GS - 4) / 2, gy + (GS - 4) / 2, "eq_" + id); if (!ok) im.setAlpha(0.45); c.add(im);
        if (g.p) T_(gx + GS - 7, gy + GS - 17, `+${g.p}`, 9, RARITY[g.r].color).setOrigin(1, 0);
        const hit = this.add.rectangle(gx, gy, GS - 4, GS - 4, 0, 0.001).setOrigin(0).setInteractive({ useHandCursor: true }); c.add(hit);
        hit.on("pointerover", () => { showTip(g); showItemCard(this, g, { hint: t("card_hint_equip"), sell: true }); });
        hit.on("pointerout", () => hideItemCard(this));
        hit.on("pointerup", p => { hideItemCard(this); if (p.rightButtonReleased()) { sellGear(this, i); this.buildBag(); return; } if (this.equipItem(i)) this.buildBag(); else showTip(g); });
      });
      if (d.gear.length > cols * rows) T_(ix + iw / 2, gy0 + gh + 18, t("more_in_bag", { n: d.gear.length - cols * rows }), 11, COLORS.dim).setOrigin(0.5, 0);
    } else {
      T_(ix, top, t("potion_hint"), 11, COLORS.dim, { wordWrap: { width: iw } });
      let py = top + 36;
      for (const id of Object.keys(POTIONS)) {
        if (!potionOk(id, this.vocId)) continue;
        const P = POTIONS[id], n = d.potions[id] || 0;
        c.add(this.add.rectangle(ix, py - 4, iw, 30, 0x1a1612, 1).setOrigin(0).setStrokeStyle(1, 0x3a3024));
        const ic = this.add.image(ix + 16, py + 11, P.icon); ic.setScale(22 / Math.max(ic.width, ic.height)); if (P.tint) ic.setTint(P.tint); if (!n) ic.setAlpha(0.35);
        c.add(ic);
        T_(ix + 34, py + 3, P.name, 12, n ? COLORS.text : COLORS.dim);
        T_(ix + 26, py + 14, String(n), 10, n ? "#ffffff" : COLORS.dim).setOrigin(0.5, 0);
        [0, 1].forEach(sl => {
          const on = d.potionSlots[sl] === id, bx = ix + iw - 50 + sl * 26;
          const b = this.add.rectangle(bx, py + 11, 22, 20, on ? 0x6a5030 : 0x2a262e).setStrokeStyle(1, 0x6a5030).setInteractive({ useHandCursor: true });
          b.on("pointerup", () => { d.potionSlots[sl] = id; Save.save(); this.refreshPotionIcons(); this.buildBag(); });
          c.add(b); T_(bx, py + 11, String(5 + sl), 11, COLORS.gold).setOrigin(0.5);
        });
        py += 36;
      }
    }
    for (const o of c.list) if (o.type === "Text") o.setShadow(1, 1, "#000000", 0, true, true);
  },

  refreshPotionIcons() {
    const d = Save.voc(this.vocId);
    for (const pid of ["p0", "p1"]) {
      const P = POTIONS[d.potionSlots[+pid[1]]], ic = this.slotIcons && this.slotIcons[pid];
      if (!ic) continue;
      ic.setTexture(P.icon).setScale(1); ic.setScale(26 / Math.max(ic.width, ic.height));
      if (P.tint) ic.setTint(P.tint); else ic.clearTint();
    }
  },
});
