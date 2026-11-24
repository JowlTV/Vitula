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
    // layout estilo Diablo 2: elmo no alto, arma | armadura | escudo em colunas altas, anéis/luz pequenos, mochila e botas embaixo
    const slots = [[t("slot_helmet"), 72, 0, 56, 50], [t("slot_amulet"), 146, 8, 36, 36],
      [t("slot_weapon"), 0, 60, 56, 108], [t("slot_armor"), 68, 60, 64, 84], [t("slot_shield"), 144, 60, 56, 108],
      [t("slot_ring"), 12, 182, 34, 34], [t("slot_legs"), 72, 156, 56, 48], [t("slot_light"), 154, 182, 34, 34],
      [t("slot_backpack"), 0, 230, 56, 46], [t("slot_boots"), 144, 230, 56, 46]];
    // detalhes do item sob o mouse (linha no rodapé da mochila)
    const tip = T_(X + 30, Y + H - 34, t("bag_tip"), 12, COLORS.dim, { wordWrap: { width: W - 60 } });
    const showTip = (g, extra = "") => { const E = EQUIP[g.id], R = RARITY[g.r], low = this.hero.level < E.lvl, bad = !equipOk(g.id, this.vocId);
      tip.setText(`${gearName(g)} · ${R.name}${t("tip_level", { n: E.lvl })}${bad ? t("tip_wrong_voc") : ""}${extra}\n${equipStats(g)}${E.desc ? " — " + E.desc : ""}`).setColor(low || bad ? "#e08070" : R.color); };
    const _sn = n => { const m = { helmet: t("slot_helmet"), weapon: t("slot_weapon"), armor: t("slot_armor"), shield: t("slot_shield"), legs: t("slot_legs"), boots: t("slot_boots"), light: t("slot_light") }; return Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k])); }; const slotOf = _sn();
    for (const [name, rx, ry, sw, sh] of slots) {
      const sx = ex + rx, sy = ey + ry, sl = slotOf[name], g = sl && d.equip[sl], id = g && g.id;
      c.add(this.add.nineslice(sx, sy, "slot", null, sw, sh, 4, 4, 4, 4).setOrigin(0));
      T_(sx + sw / 2, sy + sh + 1, name, 9, COLORS.dim).setOrigin(0.5, 0);
      const S = Math.min(sw, sh) + 4;
      // ícone-sombra do tipo de item (como no Tibia), só quando o espaço está vazio
      const ghostSlot = { [t("slot_amulet")]: "amulet", [t("slot_ring")]: "ring", [t("slot_backpack")]: "backpack" }[name] || sl;
      const gid = ghostSlot && Object.keys(EQUIP).find(k => EQUIP[k].slot === ghostSlot && this.textures.exists("eq_" + k) && (ghostSlot !== "shield" || !EQUIP[k].quiver));
      if (!id && !gid) {   // anel, amuleto e mochila: sombra desenhada
        const gg = this.add.graphics(), mx = sx + sw / 2, my = sy + sh / 2; gg.lineStyle(3, 0x3a332c, 0.8); gg.fillStyle(0x3a332c, 0.8);
        if (ghostSlot === "ring") gg.strokeCircle(mx, my + 2, 8).fillCircle(mx, my - 7, 3);
        else if (ghostSlot === "amulet") { gg.beginPath(); gg.moveTo(mx - 10, my - 12); gg.lineTo(mx, my + 2); gg.lineTo(mx + 10, my - 12); gg.strokePath(); gg.fillCircle(mx, my + 6, 6); }
        else if (ghostSlot === "backpack") gg.fillRoundedRect(mx - 14, my - 12, 28, 28, 6).fillStyle(0x1a1612, 0.8).fillRect(mx - 14, my - 6, 28, 3).fillRect(mx - 3, my - 2, 6, 6);
        c.add(gg);
      }
      if (!id && gid) c.add(this.add.image(sx + sw / 2, sy + sh / 2, "eq_" + gid).setScale(1.25 * S / 54).setTintFill(0x3a332c).setAlpha(0.7));
      if (id && EQUIP[id]) {
        c.add(this.add.rectangle(sx + 3, sy + 3, sw - 6, sh - 6).setOrigin(0).setStrokeStyle(2, RARITY[g.r].hex, g.r ? 1 : 0));
        c.add(this.add.image(sx + sw / 2, sy + sh / 2, "eq_" + id).setScale(1.25 * S / 54));
        if (g.p) T_(sx + sw - 4, sy + sh - 14, `+${g.p}`, 10, RARITY[g.r].color).setOrigin(1, 0);
        const hit = this.add.rectangle(sx, sy, sw, sh, 0, 0.001).setOrigin(0).setInteractive({ useHandCursor: true }); c.add(hit);
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
      [t("defense_label"), [[t("total_hp"), `${Math.ceil(h.hp)} / ${Math.round(h.maxHp)}`], [t("defense_value"), this.defenseValue().toFixed(1)], [t(this.ranged ? "dodge_chance" : "block_chance"), `${Math.round(this.blockChance() * 100)}%`],
        [t("regen_label"), t("regen_line", { hp: (this.stats.recovery || 0).toFixed(1).replace(".", ","), res: (this.stats.manaReg || 0).toFixed(1).replace(".", ","), kind: VOCATIONS[this.vocId].mana ? t("word_mana") : t("word_fury") })],
        [t("resistances"), Object.keys(this.stats.res || {}).filter(k => this.stats.res[k]).map(k => `${ELEMENTS[k].name} ${this.stats.res[k] > 0 ? "+" : ""}${Math.round(this.stats.res[k] * 100)}%`).join(" · ") || t("no_resist")]]],
      [t("skills_label"), [this.ranged ? ["Distance", sk("distance") + (this.buffOn("hunter") ? "  +10" : "")] : ["Sword", sk("sword") + (this.buffOn("berserker") ? "  +10" : "")], this.ranged ? ["Dodge", sk("dodge") + (this.stats.gearDodge ? `  +${this.stats.gearDodge}` : "")] : ["Shield", sk("shield")],
        ["Magic level", `${ml.lvl}  (${mlPct}%)` + (this.buffOn("mage") ? "  +10" : "")]]],
      [t("progress_label"), [[t("level_label"), String(h.level) + (this.promo() ? ` · ${this.promo().name}` : "")], [t("total_xp"), String(Math.floor(d.xpTotal || 0))],
        [t("xp_next"), String(Math.ceil(this.xpNext() - h.xp))]]],
    ];
    // ficha de atributos no estilo Diablo 2: caixas com rótulo à esquerda e valor dentro
    const box = (x, y, w, val, col = COLORS.text, h = 22) => { c.add(this.add.rectangle(x, y, w, h, 0x0c0a08, 0.9).setOrigin(0).setStrokeStyle(1, 0x8a7048));
      const tv = T_(x + w / 2, y + h / 2, String(val), 11, col).setOrigin(0.5); if (tv.width > w - 6) tv.setScale((w - 6) / tv.width); };
    const lab = (x, y, s2, w = 0) => T_(x, y + 4, s2, 11, COLORS.dim).setOrigin(w ? 1 : 0, 0);
    const R = (x, y, label, val, col, lw = 96, bw = 66) => { lab(x + lw - 6, y, label, 1); box(x + lw, y, bw, val, col); };
    const L = [];
    for (const [, rows] of groups) for (const r of rows) L.push(r);
    const get = k => (L.find(r => r[0] === k) || [0, "—"])[1];
    const skRows = groups[2][1];
    // cabeçalho: nome e classe
    box(sx, sy - 22, 150, VOCATIONS[this.vocId].name.toUpperCase(), COLORS.gold, 24);
    box(sx + 160, sy - 22, 150, this.promo() ? this.promo().name : t("level_label") + " " + h.level, COLORS.gold, 24);
    // nível, experiência, próximo nível
    R(sx, sy + 10, t("level_label"), h.level, COLORS.text, 48, 40);
    R(sx + 100, sy + 10, t("short_xp"), get(t("total_xp")), COLORS.text, 110, 104);
    R(sx + 100, sy + 36, t("short_next"), get(t("xp_next")), COLORS.text, 110, 104);
    // coluna esquerda: skills e pontos de talento
    T_(sx + 68, sy + 66, t("skills_label"), 12, COLORS.gold).setOrigin(0.5, 0);
    let ly = sy + 84;
    for (const [k, v] of skRows) { R(sx, ly, k, v, "#a8c8ff", 76, 60); ly += 27; }
    const pts = this.talentPoints ? this.talentPoints() : 0;
    R(sx, ly, t("pm_attrs"), pts, pts > 0 ? "#d8ffc8" : COLORS.dim, 76, 60); ly += 34;
    R(sx, ly, t("total_hp"), get(t("total_hp")), "#ff8080", 76, 60); ly += 27;
    R(sx, ly, VOCATIONS[this.vocId].mana ? t("word_mana") : t("word_fury"), `${Math.ceil(h.fury)} / ${Math.round(this.furyMax)}`, VOCATIONS[this.vocId].mana ? "#80a8ff" : "#ffa860", 76, 60);
    // coluna direita: ataque e defesa
    let ay = sy + 84; const ax = sx + 150;
    const SH = [["base_dmg", "short_dmg"], ["critical", "short_crit"], ["atk_speed", "short_speed"], ["defense_value", "short_def"], [this.ranged ? "dodge_chance" : "block_chance", this.ranged ? "short_dodge" : "short_block"]].concat(this.ranged ? [["arrows_label", "short_arrows"]] : []);
    for (const [k, sk2] of SH) { R(ax, ay, t(sk2), String(get(t(k))).replace(/ golpes\/s| hits\/s/, "/s").replace(/ \(×[\d,.]+\)/, ""), COLORS.text, 80, 82); ay += 27; }
    T_(ax + 113, ay + 4, t("resistances"), 11, COLORS.gold).setOrigin(0.5, 0);
    T_(ax + 113, ay + 20, get(t("resistances")), 11, COLORS.text, { align: "center", wordWrap: { width: 150 } }).setOrigin(0.5, 0);

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
      T_(ix, ry + 19, L ? (L.light.fuel ? t("oil_label", { n: oil }) : L.light.tint === 0xffc35a ? L.name : t("goddess_light")) : t("no_light"), 11, L && (!L.light.fuel || d.oil > 0) ? "#ffd27a" : COLORS.dim); }
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
        if (!potionOk(id, this.vocId) || !POTIONS[id].dur) continue;   // vida/mana/fúria são de carga (Z/C); aqui só as de efeito
        const P = POTIONS[id], n = d.potions[id] || 0;
        c.add(this.add.rectangle(ix, py - 4, iw, 30, 0x1a1612, 1).setOrigin(0).setStrokeStyle(1, 0x3a3024));
        const ic = this.add.image(ix + 16, py + 11, P.icon); ic.setScale(22 / Math.max(ic.width, ic.height)); if (P.tint) ic.setTint(P.tint); if (!n) ic.setAlpha(0.35);
        c.add(ic);
        T_(ix + 34, py + 3, P.name, 12, n ? COLORS.text : COLORS.dim);
        T_(ix + 26, py + 14, String(n), 10, n ? "#ffffff" : COLORS.dim).setOrigin(0.5, 0);
        if (n && this.drinkBuff) { const bx = ix + iw - 40, b = this.add.rectangle(bx, py + 11, 66, 20, 0x2a262e).setStrokeStyle(1, 0x6a5030).setInteractive({ useHandCursor: true });
          b.on("pointerup", () => { this.drinkBuff(id); this.buildBag(); }); c.add(b); T_(bx, py + 11, t("drink"), 11, COLORS.gold).setOrigin(0.5); }
        py += 36;
      }
    }
    for (const o of c.list) if (o.type === "Text") o.setShadow(1, 1, "#000000", 0, true, true);
  },

  refreshPotionIcons() {
    const d = Save.voc(this.vocId);
    for (const pid of ["p0", "p1"]) {
      const P = POTIONS[potSlotId(this.vocId, +pid[1])], ic = this.slotIcons && this.slotIcons[pid];
      if (!ic) continue;
      ic.setTexture(P.icon).setScale(1); ic.setScale(26 / Math.max(ic.width, ic.height));
      if (P.tint) ic.setTint(P.tint); else ic.clearTint();
    }
  },
});
