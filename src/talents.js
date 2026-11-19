// Árvore de talentos (substitui os pontos de atributo e as habilidades por nível).
// Inspiração: a teia de passivas do Path of Exile (pequenos bônus que se somam e caminhos que levam a "notáveis")
// e as runas do Diablo 3 (habilidades que mudam de papel). Aqui: 1 ponto por nível; cada vocação tem 3 ramos;
// alguns nós, ao chegar no máximo, LIBERAM uma habilidade (ex.: Corte Afiado 3/3 → Golpe Frontal).
//
// Balanceamento (ver também monsterScale em monsters): no nível N o herói tem N−1 pontos. Um ponto vale ~3–4% de
// poder (dano ou vida efetiva). Os monstros crescem ~15–18% de vida por andar e ~60% por região; assim cada
// região pede uns 8–10 níveis a mais e a escolha da build (dano × resistência) pesa de verdade.
//
// Efeitos (somados por ponto):
//  dmg: +% dano · crit: +chance crítica · critDmg: +dano crítico · hp: +% vida · armor: +defesa · block: +bloqueio
//  regen: +vida/s · fury: +Fúria/Mana máx. · aspd: +% vel. ataque · leech: % do dano vira vida · hpDmg: % da vida máx. somada ao dano
//  speed: +% vel. de movimento · dodge: +Dodge fighting · mreg: +mana/s
const TALENTS = {
  knight: {
    branches: ["Lâmina", "Bastião", "Fúria"],
    nodes: [
      { id: "k_slash", b: 0, row: 0, name: "Corte Afiado", max: 3, fx: { dmg: 0.04 }, unlock: "front", desc: "+4% de dano. No 3/3 libera o Golpe Frontal." },
      { id: "k_edge", b: 0, row: 1, name: "Fio da Lâmina", max: 5, fx: { crit: 0.015 }, req: ["k_slash", 3], desc: "+1,5% de chance crítica." },
      { id: "k_quake", b: 0, row: 1, col: 1, name: "Tremor", max: 3, fx: { dmg: 0.03 }, req: ["k_slash", 3], unlock: "quake", desc: "+3% de dano. No 3/3 libera o Tremor de Terra (nível 6)." },
      { id: "k_cruel", b: 0, row: 2, name: "Crueldade", max: 5, fx: { critDmg: 0.12 }, req: ["k_edge", 2], desc: "+12% de dano crítico." },
      { id: "k_wrath", b: 0, row: 2, col: 1, name: "Ira Sagrada", max: 3, fx: { dmg: 0.03 }, req: ["k_quake", 3], unlock: "aura", desc: "+3% de dano. No 3/3 libera a Aura Sagrada (nível 16)." },
      { id: "k_slasher", b: 0, row: 3, name: "Slasher", max: 3, fx: { critDmg: 0.08 }, req: ["k_cruel", 3], unlock: "slasher", desc: "+8% de dano crítico. No 3/3 libera o Slasher (nível 20)." },
      { id: "k_exec", b: 0, row: 3, col: 1, name: "Executor", max: 5, fx: { exec: 0.06 }, req: ["k_wrath", 1], desc: "+6% de dano em monstros com menos de 30% de vida." },
      { id: "k_xcut", b: 0, row: 4, name: "Corte em X", max: 3, fx: { dmg: 0.03 }, req: ["k_slasher", 3], unlock: "xcut", desc: "+3% de dano. No 3/3 libera o Corte em X (nível 28)." },
      { id: "k_honed", b: 0, row: 4, col: 1, name: "Fio Eterno", max: 5, fx: { crit: 0.01, dmg: 0.02 }, req: ["k_exec", 3], desc: "+1% de chance crítica e +2% de dano." },
      { id: "k_vit", b: 1, row: 0, name: "Vigor", max: 5, fx: { hp: 0.06 }, desc: "+6% de vida máxima." },
      { id: "k_bulwark", b: 1, row: 1, name: "Baluarte", max: 5, fx: { armor: 1, block: 0.01 }, req: ["k_vit", 1], desc: "+1 de defesa e +1% de bloqueio." },
      { id: "k_regen", b: 1, row: 1, col: 1, name: "Sangue de Ferro", max: 3, fx: { regen: 0.6 }, req: ["k_vit", 2], desc: "+0,6 de vida por segundo." },
      { id: "k_aegis", b: 1, row: 2, name: "Égide", max: 3, fx: { armor: 1 }, req: ["k_bulwark", 2], unlock: "guard", desc: "+1 de defesa. No 3/3 libera a Égide (nível 10)." },
      { id: "k_colossus", b: 1, row: 2, col: 1, name: "Colosso", max: 5, fx: { hpDmg: 0.008 }, req: ["k_vit", 3], desc: "Soma 0,8% da sua vida máxima ao dano (build tanque)." },
      { id: "k_thorns", b: 1, row: 3, name: "Espinhos", max: 5, fx: { thorns: 0.04 }, req: ["k_aegis", 3], desc: "Devolve 4% do dano recebido a quem atacou." },
      { id: "k_stone", b: 1, row: 3, col: 1, name: "Pele de Pedra", max: 5, fx: { taken: 0.02 }, req: ["k_colossus", 2], desc: "−2% de dano recebido." },
      { id: "k_titan", b: 1, row: 4, col: 1, name: "Titã", max: 3, fx: { hp: 0.04, hpDmg: 0.004 }, req: ["k_stone", 3], desc: "+4% de vida e +0,4% da vida máxima como dano." },
      { id: "k_fury", b: 2, row: 0, name: "Fúria Contida", max: 3, fx: { fury: 10 }, desc: "+10 de Fúria máxima." },
      { id: "k_aspd", b: 2, row: 1, name: "Ímpeto", max: 5, fx: { aspd: 0.03 }, req: ["k_fury", 1], desc: "+3% de velocidade de ataque." },
      { id: "k_burn", b: 2, row: 1, col: 1, name: "Fúria Ardente", max: 3, fx: { furyGain: 0.15 }, req: ["k_fury", 2], desc: "+15% de Fúria ganha por golpe." },
      { id: "k_leech", b: 2, row: 2, name: "Sede de Sangue", max: 3, fx: { leech: 0.01 }, req: ["k_aspd", 3], desc: "1% do dano causado vira vida." },
      { id: "k_hot", b: 2, row: 2, col: 1, name: "Sangue Quente", max: 3, fx: { speed: 0.03 }, req: ["k_burn", 1], desc: "+3% de velocidade de movimento." },
      { id: "k_berserk", b: 2, row: 3, name: "Berserker", max: 3, fx: { dmg: 0.03 }, req: ["k_leech", 3], unlock: "kberserk", desc: "+3% de dano. No 3/3 libera o Modo Berserker (nível 24)." },
      { id: "k_rage", b: 2, row: 3, col: 1, name: "Ódio", max: 5, fx: { lowHp: 0.05 }, req: ["k_hot", 2], desc: "+5% de dano com menos de 50% de vida." },
    ],
  },
  archer: {
    branches: ["Caça", "Sagrado", "Sobrevivência"],
    nodes: [
      { id: "a_eye", b: 0, row: 0, name: "Olho de Águia", max: 5, fx: { crit: 0.015 }, desc: "+1,5% de chance crítica." },
      { id: "a_aim", b: 0, row: 1, name: "Precisão", max: 5, fx: { dmg: 0.035 }, req: ["a_eye", 1], desc: "+3,5% de dano." },
      { id: "a_pierce", b: 0, row: 1, col: 1, name: "Ponta Afiada", max: 5, fx: { critDmg: 0.12 }, req: ["a_eye", 2], desc: "+12% de dano crítico." },
      { id: "a_quick", b: 0, row: 2, name: "Mão Ligeira", max: 5, fx: { aspd: 0.03 }, req: ["a_aim", 2], desc: "+3% de velocidade de ataque." },
      { id: "a_hunter", b: 0, row: 2, col: 1, name: "Instinto", max: 5, fx: { elite: 0.08 }, req: ["a_pierce", 2], desc: "+8% de dano em chefes e monstros de elite." },
      { id: "a_far", b: 0, row: 3, name: "Além do Alcance", max: 3, fx: { crit: 0.01 }, req: ["a_quick", 3], unlock: "farsight", desc: "+1% de chance crítica. No 3/3 libera a Visão Além do Alcance (nível 20)." },
      { id: "a_exec", b: 0, row: 3, col: 1, name: "Golpe Final", max: 5, fx: { exec: 0.06 }, req: ["a_hunter", 2], desc: "+6% de dano em monstros com menos de 30% de vida." },
      { id: "a_deadeye", b: 0, row: 4, name: "Olho Morto", max: 5, fx: { crit: 0.01, critDmg: 0.05 }, req: ["a_far", 1], desc: "+1% de chance crítica e +5% de dano crítico." },
      { id: "a_holy", b: 1, row: 0, name: "Luz Sagrada", max: 3, fx: { dmg: 0.04 }, unlock: "holy", desc: "+4% de dano. No 3/3 libera a Flecha Sagrada." },
      { id: "a_missile", b: 1, row: 1, name: "Míssil Sagrado", max: 3, fx: { dmg: 0.03 }, req: ["a_holy", 3], unlock: "missile", desc: "+3% de dano. No 3/3 libera o Míssil Sagrado (nível 6)." },
      { id: "a_mana", b: 1, row: 1, col: 1, name: "Fluxo Arcano", max: 3, fx: { fury: 10, mreg: 0.4 }, req: ["a_holy", 1], desc: "+10 de mana máxima e +0,4 de mana/s." },
      { id: "a_volley", b: 1, row: 2, name: "Chuva de Flechas", max: 3, fx: { dmg: 0.03 }, req: ["a_missile", 3], unlock: "volley", desc: "+3% de dano. No 3/3 libera a Saraivada (nível 10)." },
      { id: "a_radiance", b: 1, row: 2, col: 1, name: "Radiância", max: 5, fx: { dmg: 0.03 }, req: ["a_mana", 2], desc: "+3% de dano." },
      { id: "a_berserk", b: 1, row: 3, name: "Fúria do Caçador", max: 3, fx: { dmg: 0.03 }, req: ["a_volley", 3], unlock: "frenzy", desc: "+3% de dano. No 3/3 libera o Berserker (nível 16)." },
      { id: "a_barrier", b: 1, row: 4, name: "Barreira de Luz", max: 3, fx: { taken: 0.02 }, req: ["a_berserk", 3], unlock: "barrier", desc: "−2% de dano recebido. No 3/3 libera a Barreira de Luz (nível 24)." },
      { id: "a_vit", b: 2, row: 0, name: "Resiliência", max: 5, fx: { hp: 0.05 }, desc: "+5% de vida máxima." },
      { id: "a_reflex", b: 2, row: 1, name: "Reflexos", max: 5, fx: { dodge: 1 }, req: ["a_vit", 1], desc: "+1 de Dodge fighting." },
      { id: "a_wind", b: 2, row: 1, col: 1, name: "Pés de Vento", max: 3, fx: { speed: 0.03 }, req: ["a_vit", 1], unlock: "flee", desc: "+3% de velocidade. No 3/3 libera a Aura do Vento (nível 12)." },
      { id: "a_leech", b: 2, row: 2, name: "Sangue Frio", max: 3, fx: { leech: 0.01 }, req: ["a_reflex", 3], desc: "1% do dano causado vira vida." },
      { id: "a_light", b: 2, row: 2, col: 1, name: "Pele de Luz", max: 5, fx: { taken: 0.02 }, req: ["a_wind", 1], desc: "−2% de dano recebido." },
      { id: "a_evasion", b: 2, row: 3, name: "Evasão", max: 5, fx: { dodge: 1 }, req: ["a_leech", 1], desc: "+1 de Dodge fighting." },
      { id: "a_breath", b: 2, row: 3, col: 1, name: "Segundo Fôlego", max: 3, fx: { regen: 0.5, lowHp: 0.04 }, req: ["a_light", 2], desc: "+0,5 de vida/s e +4% de dano com menos de 50% de vida." },
    ],
  },
};
const talentTree = voc => TALENTS[voc] || TALENTS.knight;
const talentRanks = voc => (Save.voc(voc).talents ||= {});
function talentFx(voc) {
  const r = talentRanks(voc), out = {};
  for (const n of talentTree(voc).nodes) { const k = r[n.id] || 0; if (!k) continue; for (const e in n.fx) out[e] = (out[e] || 0) + n.fx[e] * k; }
  return out;
}
// habilidade liberada? (Exura é sempre livre; as outras pelo nó da árvore + nível mínimo)
function spellUnlocked(voc, id, level) {
  const sp = vocSpells(voc)[id]; if (!sp) return false;
  if (level < (sp.level || 1)) return false;
  const n = talentTree(voc).nodes.find(x => x.unlock === id);
  return !n || (talentRanks(voc)[n.id] || 0) >= n.max;
}

Object.assign(DungeonScene.prototype, {
  talentPoints() { const r = talentRanks(this.vocId); let s = 0; for (const k in r) s += r[k]; return Math.max(0, this.hero.level - 1 - s); },
  canTalent(n) {
    const r = talentRanks(this.vocId);
    if ((r[n.id] || 0) >= n.max || this.talentPoints() <= 0) return false;
    return !n.req || (r[n.req[0]] || 0) >= n.req[1];
  },
  spendTalent(n) {
    if (!this.canTalent(n)) return false;
    const r = talentRanks(this.vocId), h = this.hero, before = this.stats.maxHp;
    r[n.id] = (r[n.id] || 0) + 1; Save.save();
    this.stats = this.computeStats();
    const dHp = this.stats.maxHp - before; if (dHp) { h.maxHp += dHp; h.hp += Math.max(0, dHp); }
    if (n.unlock && r[n.id] >= n.max) { const sp = this.spells[n.unlock]; this.msg(t("talent_unlock", { name: sp.name, key: sp.key, n: sp.level })); sfx(this, "levelup", 0.35); }
    else sfx(this, "gem", 0.3);
    return true;
  },
  // janela da árvore (tecla U): 3 ramos, nós como botões; retorno visual ao passar, apertar e gastar
  buildAttrs(flashId) {
    if (this.attrBox) this.attrBox.destroy();
    const c = this.add.container(0, 0).setDepth(30); this.uiLayer.add(c); this.attrBox = c;
    c.add(this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x000000, 0.75).setOrigin(0).setInteractive());
    const tree = talentTree(this.vocId), r = talentRanks(this.vocId), pts = this.talentPoints();
    const W = 900, H = 524, X = VIEW_W / 2 - W / 2, Y = VIEW_H / 2 - H / 2;
    c.add(this.add.nineslice(X, Y, "panel", null, W, H, 16, 16, 16, 16).setOrigin(0));
    const T_ = (x, y, s, size = 13, col = COLORS.text) => { const o = txt(this, x, y, s, size, col); c.add(o); return o; };
    T_(VIEW_W / 2, Y + 24, t("talents_title"), 24, COLORS.gold).setOrigin(0.5);
    T_(X + W - 20, Y + 14, t("talents_close"), 11, COLORS.dim).setOrigin(1, 0);
    // contador de pontos em destaque
    const pc = pts > 0 ? 0x2e5a22 : 0x2a2420;
    c.add(this.add.rectangle(VIEW_W / 2, Y + 52, 340, 24, pc, 1).setStrokeStyle(1, pts > 0 ? 0x9fe08a : 0x4a443c));
    const ptsT = T_(VIEW_W / 2, Y + 52, pts > 0 ? t("talents_points", { n: pts }) : t("talents_none"), 13, pts > 0 ? "#d8ffc8" : COLORS.dim).setOrigin(0.5);
    if (pts > 0) this.tweens.add({ targets: ptsT, alpha: 0.6, yoyo: true, repeat: -1, duration: 700 });
    const BW = (W - 40) / 3, NW = 128, NH = 46, RH = 76;
    const pos = n => ({ x: X + 20 + n.b * BW + (n.col ? BW / 2 + 4 : BW / 2 - NW - 4), y: Y + 100 + n.row * RH });
    const lines = this.add.graphics(); c.add(lines);
    tree.branches.forEach((name, i) => {
      T_(X + 20 + i * BW + BW / 2, Y + 82, name.toUpperCase(), 14, COLORS.gold).setOrigin(0.5);
      if (i) c.add(this.add.rectangle(X + 20 + i * BW, Y + 74, 1, H - 120, 0x4a3a22).setOrigin(0));
    });
    const tip = T_(VIEW_W / 2, Y + H - 22, "", 12, "#e8dcc0").setOrigin(0.5);
    const hint = t("talents_hint"); tip.setText(hint);
    for (const n of tree.nodes) {
      const p = pos(n), k = r[n.id] || 0, can = this.canTalent(n), full = k >= n.max;
      const reqOk = !n.req || (r[n.req[0]] || 0) >= n.req[1];
      if (n.req) { const q = pos(tree.nodes.find(o => o.id === n.req[0])); lines.lineStyle(3, reqOk ? 0xc8a050 : 0x3a342c, 1).lineBetween(q.x + NW / 2, q.y + NH, p.x + NW / 2, p.y); }
      const g = this.add.container(p.x + NW / 2, p.y + NH / 2); c.add(g);
      // botão: fundo com textura de botão, cor por estado (bloqueado, disponível, investido, completo)
      const btn = this.add.nineslice(0, 0, can || full ? "button_hover" : "button_normal", null, NW, NH, 18, 18, 6, 6);
      if (!reqOk) btn.setTint(0x55504a).setAlpha(0.6); else if (full) btn.setTint(0xffd080); else if (k) btn.setTint(0xe0c090);
      g.add(btn);
      if (can) { const ring = this.add.rectangle(0, 0, NW + 6, NH + 6).setStrokeStyle(2, 0x9fe08a, 1); g.add(ring); this.tweens.add({ targets: ring, alpha: 0.25, yoyo: true, repeat: -1, duration: 650 }); }
      if (n.unlock) g.add(txt(this, NW / 2 - 12, -NH / 2 + 9, "★", 13, full ? "#fff0a0" : "#c8a050").setOrigin(0.5));
      g.add(txt(this, 0, -8, n.name, 12, !reqOk ? "#7a7268" : full ? "#fff4d0" : COLORS.text).setOrigin(0.5));
      // pips de posto
      for (let i = 0; i < n.max; i++) g.add(this.add.rectangle((i - (n.max - 1) / 2) * 12, 11, 9, 6, i < k ? 0xffd060 : 0x2a2420).setStrokeStyle(1, 0x7a6440));
      btn.setInteractive({ useHandCursor: can });
      btn.on("pointerover", () => {
        tip.setText(`${n.name} (${k}/${n.max}): ${n.desc}` + (n.req && !reqOk ? `  — ${t("talents_req", { name: tree.nodes.find(o => o.id === n.req[0]).name, n: n.req[1] })}` : ""));
        this.tweens.add({ targets: g, scale: 1.08, duration: 90 });
      });
      btn.on("pointerout", () => { tip.setText(hint); this.tweens.add({ targets: g, scale: 1, duration: 90 }); });
      btn.on("pointerdown", () => {
        if (this.spendTalent(n)) {
          this.tweens.add({ targets: g, scale: 0.9, duration: 60, yoyo: true, onComplete: () => this.buildAttrs(n.id) });
        } else {
          this.tweens.add({ targets: g, x: g.x + 5, duration: 40, yoyo: true, repeat: 2 });
          btn.setTint(0xff6050); this.time.delayedCall(220, () => { if (btn.scene) { btn.clearTint(); if (!reqOk) btn.setTint(0x55504a); } });
          tip.setText(full ? t("talents_full") : !reqOk ? t("talents_req", { name: tree.nodes.find(o => o.id === n.req[0]).name, n: n.req[1] }) : t("talents_none"));
          sfx(this, "hit", 0.15);
        }
      });
      // acabou de gastar aqui: brilho dourado e "+1"
      if (flashId === n.id) {
        const f = this.add.rectangle(0, 0, NW, NH, 0xfff0a0, 0.8).setBlendMode(Phaser.BlendModes.ADD); g.add(f);
        this.tweens.add({ targets: f, alpha: 0, scale: 1.25, duration: 450, onComplete: () => f.destroy() });
        const pl = txt(this, 0, -NH / 2, "+1", 18, "#9fe08a").setOrigin(0.5); g.add(pl);
        this.tweens.add({ targets: pl, y: -NH / 2 - 26, alpha: 0, duration: 700, onComplete: () => pl.destroy() });
      }
    }
  },
  attrFree() { return this.talentPoints(); },
});

{
  // efeitos da árvore entram nos status
  const cs = DungeonScene.prototype.computeStats;
  DungeonScene.prototype.computeStats = function () {
    const s = cs.call(this), f = talentFx(this.vocId);
    s.might *= 1 + (f.dmg || 0); s.maxHp = Math.round(s.maxHp * (1 + (f.hp || 0)));
    s.armor += f.armor || 0; s.talBlock = f.block || 0; s.recovery += f.regen || 0; s.atkSpeed = (s.atkSpeed || 1) + (f.aspd || 0);
    s.talCrit = f.crit || 0; s.talCritDmg = f.critDmg || 0; s.leech = f.leech || 0; s.hpDmg = f.hpDmg || 0;
    s.exec = f.exec || 0; s.elite = f.elite || 0; s.lowHp = f.lowHp || 0; s.taken = Math.min(0.5, f.taken || 0); s.thorns = f.thorns || 0; s.furyGain = f.furyGain || 0;
    s.moveSpeed *= 1 + (f.speed || 0); s.gearDodge = (s.gearDodge || 0) + (f.dodge || 0); s.manaReg = (s.manaReg || 0) + (f.mreg || 0);
    this.furyMax = (this.furyMax || FURY_MAX) + (f.fury || 0);
    return s;
  };
  const P = DungeonScene.prototype;
  const md = P.maxDamage; P.maxDamage = function () { return md.call(this) + (this.stats.hpDmg || 0) * (this.hero ? this.hero.maxHp : this.stats.maxHp); };
  const cc = P.critChance; P.critChance = function () { return cc.call(this) + (this.stats.talCrit || 0); };
  P.critMult = function () { return 1.8 + (this.stats.talCritDmg || 0); };
  const bc = P.blockChance; P.blockChance = function () { return bc.call(this) + (this.ranged ? 0 : (this.stats.talBlock || 0)); };
  // roubo de vida da árvore
  const dm = P.damageMonster;
  P.damageMonster = function (m, dmg, ...a) {
    const st = this.stats || {};
    if (dmg > 0 && m && m.maxHp) {
      if (st.exec && m.hp < m.maxHp * 0.3) dmg *= 1 + st.exec;
      if (st.elite && (m.elite || m.champion)) dmg *= 1 + st.elite;
      if (st.lowHp && this.hero && this.hero.hp < this.hero.maxHp * 0.5) dmg *= 1 + st.lowHp;
    }
    const r = dm.call(this, m, dmg, ...a);
    const l = this.stats && this.stats.leech; if (l && dmg > 0 && this.hero && !this.hero.dead) this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + dmg * l);
    return r;
  };
}

{
  const P = DungeonScene.prototype;
  // Pele de Pedra / Pele de Luz (dano recebido) e Espinhos (devolve parte do golpe)
  const hh = P.hurtHero;
  P.hurtHero = function (amount, ...a) {
    const st = this.stats || {}, m = this._attacker;
    if (amount > 0 && st.taken) amount *= 1 - st.taken;
    if (m && !m.dead && st.thorns && amount > 0) this.damageMonster(m, amount * st.thorns);
    return hh.call(this, amount, ...a);
  };
  const af = P.addFury;
  if (af) P.addFury = function (n, ...a) { return af.call(this, n * (1 + ((this.stats && this.stats.furyGain) || 0)), ...a); };
}
