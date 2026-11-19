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
      { id: "k_vit", b: 1, row: 0, name: "Vigor", max: 5, fx: { hp: 0.06 }, desc: "+6% de vida máxima." },
      { id: "k_bulwark", b: 1, row: 1, name: "Baluarte", max: 5, fx: { armor: 1, block: 0.01 }, req: ["k_vit", 1], desc: "+1 de defesa e +1% de bloqueio." },
      { id: "k_regen", b: 1, row: 1, col: 1, name: "Sangue de Ferro", max: 3, fx: { regen: 0.6 }, req: ["k_vit", 2], desc: "+0,6 de vida por segundo." },
      { id: "k_aegis", b: 1, row: 2, name: "Égide", max: 3, fx: { armor: 1 }, req: ["k_bulwark", 2], unlock: "guard", desc: "+1 de defesa. No 3/3 libera a Égide (nível 10)." },
      { id: "k_colossus", b: 1, row: 2, col: 1, name: "Colosso", max: 5, fx: { hpDmg: 0.008 }, req: ["k_vit", 3], desc: "Soma 0,8% da sua vida máxima ao dano (build tanque)." },
      { id: "k_fury", b: 2, row: 0, name: "Fúria Contida", max: 3, fx: { fury: 10 }, desc: "+10 de Fúria máxima." },
      { id: "k_aspd", b: 2, row: 1, name: "Ímpeto", max: 5, fx: { aspd: 0.03 }, req: ["k_fury", 1], desc: "+3% de velocidade de ataque." },
      { id: "k_leech", b: 2, row: 2, name: "Sede de Sangue", max: 3, fx: { leech: 0.01 }, req: ["k_aspd", 3], desc: "1% do dano causado vira vida." },
    ],
  },
  archer: {
    branches: ["Caça", "Sagrado", "Sobrevivência"],
    nodes: [
      { id: "a_eye", b: 0, row: 0, name: "Olho de Águia", max: 5, fx: { crit: 0.015 }, desc: "+1,5% de chance crítica." },
      { id: "a_aim", b: 0, row: 1, name: "Precisão", max: 5, fx: { dmg: 0.035 }, req: ["a_eye", 1], desc: "+3,5% de dano." },
      { id: "a_pierce", b: 0, row: 1, col: 1, name: "Ponta Afiada", max: 5, fx: { critDmg: 0.12 }, req: ["a_eye", 2], desc: "+12% de dano crítico." },
      { id: "a_quick", b: 0, row: 2, name: "Mão Ligeira", max: 5, fx: { aspd: 0.03 }, req: ["a_aim", 2], desc: "+3% de velocidade de ataque." },
      { id: "a_holy", b: 1, row: 0, name: "Luz Sagrada", max: 3, fx: { dmg: 0.04 }, unlock: "holy", desc: "+4% de dano. No 3/3 libera a Flecha Sagrada." },
      { id: "a_volley", b: 1, row: 1, name: "Chuva de Flechas", max: 3, fx: { dmg: 0.03 }, req: ["a_holy", 3], unlock: "volley", desc: "+3% de dano. No 3/3 libera a Saraivada (nível 10)." },
      { id: "a_mana", b: 1, row: 1, col: 1, name: "Fluxo Arcano", max: 3, fx: { fury: 10, mreg: 0.4 }, req: ["a_holy", 1], desc: "+10 de mana máxima e +0,4 de mana/s." },
      { id: "a_berserk", b: 1, row: 2, name: "Fúria do Caçador", max: 3, fx: { dmg: 0.03 }, req: ["a_volley", 3], unlock: "frenzy", desc: "+3% de dano. No 3/3 libera o Berserker (nível 16)." },
      { id: "a_vit", b: 2, row: 0, name: "Resiliência", max: 5, fx: { hp: 0.05 }, desc: "+5% de vida máxima." },
      { id: "a_reflex", b: 2, row: 1, name: "Reflexos", max: 5, fx: { dodge: 1 }, req: ["a_vit", 1], desc: "+1 de Dodge fighting." },
      { id: "a_wind", b: 2, row: 1, col: 1, name: "Pés de Vento", max: 3, fx: { speed: 0.03 }, req: ["a_vit", 1], unlock: "flee", desc: "+3% de velocidade. No 3/3 libera a Aura do Vento (nível 6)." },
      { id: "a_leech", b: 2, row: 2, name: "Sangue Frio", max: 3, fx: { leech: 0.01 }, req: ["a_reflex", 3], desc: "1% do dano causado vira vida." },
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
  // janela da árvore (tecla U): 3 colunas (ramos), nós com posto x/máx, linhas de requisito; clique para gastar
  buildAttrs() {
    if (this.attrBox) this.attrBox.destroy();
    const c = this.add.container(0, 0).setDepth(30); this.uiLayer.add(c); this.attrBox = c;
    c.add(this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x000000, 0.7).setOrigin(0).setInteractive());
    const tree = talentTree(this.vocId), r = talentRanks(this.vocId), pts = this.talentPoints();
    const W = 860, H = 470, X = VIEW_W / 2 - W / 2, Y = VIEW_H / 2 - H / 2;
    c.add(this.add.nineslice(X, Y, "panel", null, W, H, 16, 16, 16, 16).setOrigin(0));
    const T_ = (x, y, s, size = 13, col = COLORS.text) => { const o = txt(this, x, y, s, size, col); c.add(o); return o; };
    T_(VIEW_W / 2, Y + 26, t("talents_title"), 26, COLORS.gold).setOrigin(0.5);
    T_(X + W - 20, Y + 14, t("talents_close"), 11, COLORS.dim).setOrigin(1, 0);
    T_(VIEW_W / 2, Y + 54, pts > 0 ? t("talents_points", { n: pts }) : t("talents_none"), 14, pts > 0 ? "#9fe08a" : COLORS.dim).setOrigin(0.5);
    const BW = (W - 60) / 3, NW = 118, NH = 52, pos = n => ({ x: X + 30 + n.b * BW + (n.col ? BW / 2 + 6 : 8), y: Y + 110 + n.row * 92 });
    const lines = this.add.graphics(); c.add(lines);
    tree.branches.forEach((name, i) => {
      T_(X + 30 + i * BW + BW / 2, Y + 84, name, 16, COLORS.gold).setOrigin(0.5);
      if (i) c.add(this.add.rectangle(X + 30 + i * BW - 4, Y + 80, 1, H - 100, 0x4a3a22).setOrigin(0));
    });
    const tip = T_(VIEW_W / 2, Y + H - 26, "", 12, "#d8ccb4").setOrigin(0.5);
    for (const n of tree.nodes) {
      const p = pos(n), k = r[n.id] || 0, can = this.canTalent(n), full = k >= n.max;
      if (n.req) { const q = pos(tree.nodes.find(o => o.id === n.req[0])); lines.lineStyle(2, (r[n.req[0]] || 0) >= n.req[1] ? 0xc8a050 : 0x4a443c, 1).lineBetween(q.x + NW / 2, q.y + NH, p.x + NW / 2, p.y); }
      const col = full ? 0x6a4a18 : k ? 0x3a2c18 : 0x1a1612, stroke = can ? 0x9fe08a : full ? 0xe0bc60 : 0x4a443c;
      const box = this.add.rectangle(p.x, p.y, NW, NH, col, 1).setOrigin(0).setStrokeStyle(2, stroke); c.add(box);
      T_(p.x + NW / 2, p.y + 14, n.name, 12, full ? "#ffe2a0" : COLORS.text).setOrigin(0.5);
      T_(p.x + NW / 2, p.y + 34, `${k}/${n.max}` + (n.unlock ? "  ★" : ""), 13, can ? "#9fe08a" : COLORS.dim).setOrigin(0.5);
      box.setInteractive({ useHandCursor: can });
      box.on("pointerover", () => tip.setText(`${n.name}: ${n.desc}` + (n.req ? `  (${t("talents_req", { name: tree.nodes.find(o => o.id === n.req[0]).name, n: n.req[1] })})` : "")));
      box.on("pointerdown", () => { if (this.spendTalent(n)) this.buildAttrs(); });
    }
    if (!tip.text) tip.setText(t("talents_hint"));
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
    const r = dm.call(this, m, dmg, ...a);
    const l = this.stats && this.stats.leech; if (l && dmg > 0 && this.hero && !this.hero.dead) this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + dmg * l);
    return r;
  };
}
