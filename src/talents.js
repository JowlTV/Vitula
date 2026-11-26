// Teia de talentos (GDD "Vitula — GDD: Teia de Talentos", 26/11/2026).
// Estilo Path of Exile: ~150 nós de 1 ponto por classe, ligados em rede a partir da Origem (já alocada).
// 1 ponto por nível (99 no nível 100 ≈ 2/3 da teia). Só se aloca um nó ligado a outro já alocado.
// Tipos: pequeno (1 unidade de poder), notável (4 unidades + efeito), habilidade (libera magia), keystone (muda uma regra).
// Respec na estátua da Oráculo: por nó (2 × nível em ouro; grátis até o nível 10) ou "Devolver tudo" (soma dos nós).
// A arte é desenhada em código, como uma constelação.

// ---------------------------------------------------------------- dados das classes
// unidade de poder de um nó pequeno (ver tabela de Fórmulas do GDD)
const U = { dmg: 0.02, aspd: 0.02, crit: 0.02, critDmg: 0.15, hp: 0.03, armor: 0.5, leech: 0.003, dodge: 3, taken: 0.015, regen: 0.3, block: 0.012, exec: 0.06, elite: 0.05, lowHp: 0.04, fury: 5, mreg: 0.2, speed: 0.02 };
const fxU = (k, n = 1) => ({ [k]: U[k] * n });
const WEB_SPEC = {
  knight: {
    arms: [
      { name: "Lâmina", spine: "dmg", skills: { 0: "front", 4: "quake", 7: "aura", 10: "slasher", 13: "xcut" },
        clusters: [["Fio Mortal", "crit", { crit: 0.04, critDmg: 0.3 }], ["Executor", "dmg", { exec: 0.25, dmg: 0.02 }],
                   ["Ira Sagrada", "dmg", { dmg: 0.08 }], ["Mestre de Armas", "aspd", { aspd: 0.04, dmg: 0.04 }]],
        ks: { name: "Golpe Pesado", fx: { dmg: 0.4, aspd: -0.2 }, desc: "+40% de dano, −20% de velocidade de ataque." } },
      { name: "Bastião", spine: "hp", skills: { 6: "guard" },
        clusters: [["Colosso", "hp", { hpDmg: 0.02, hp: 0.06 }], ["Espinhos", "armor", { thorns: 0.2, armor: 1 }],
                   ["Pele de Pedra", "taken", { taken: 0.05, hp: 0.03 }], ["Muralha", "block", { block: 0.05, armor: 1 }]],
        ks: { name: "Juramento de Ferro", flag: "iron", fx: {}, desc: "Chance de bloqueio dobrada; você nunca acerta crítico." } },
      { name: "Fúria", spine: "aspd", skills: { 9: "kberserk" },
        clusters: [["Sede de Sangue", "leech", { leech: 0.01, hp: 0.03 }], ["Ímpeto", "aspd", { aspd: 0.06, speed: 0.03 }],
                   ["Ódio", "lowHp", { lowHp: 0.15, dmg: 0.03 }], ["Fúria Ardente", "fury", { furyGain: 0.3, fury: 15 }]],
        ks: { name: "Sede Eterna", flag: "thirst", fx: {}, desc: "Roubo de vida ×3; Exura e poções curam só metade." } },
    ],
  },
  archer: {
    arms: [
      { name: "Caça", spine: "crit", skills: { 9: "farsight" },
        clusters: [["Olho Morto", "crit", { crit: 0.04, critDmg: 0.3 }], ["Caçador de Chefes", "elite", { elite: 0.2, dmg: 0.03 }],
                   ["Golpe Final", "dmg", { exec: 0.25 }], ["Mão Ligeira", "aspd", { aspd: 0.06, crit: 0.02 }]],
        ks: { name: "Olhos de Carcará", flag: "carcara", fx: {}, desc: "Crítico garantido em alvo com a vida cheia; −15% de dano no resto." } },
      { name: "Sagrado", spine: "dmg", skills: { 0: "holy", 4: "missile", 7: "volley", 10: "frenzy", 13: "barrier" },
        clusters: [["Radiância", "dmg", { dmg: 0.08 }], ["Fluxo Arcano", "mreg", { fury: 20, mreg: 0.8 }],
                   ["Luz Purificadora", "regen", { regen: 1.2, hp: 0.03 }], ["Chuva Constante", "aspd", { aspd: 0.05, dmg: 0.03 }]],
        ks: { name: "Luz Ardente", flag: "burn", fx: {}, desc: "Habilidades gastam vida em vez de mana; +25% de dano logo após cada uma." } },
      { name: "Sobrevivência", spine: "hp", skills: { 6: "flee" },
        clusters: [["Evasão", "dodge", { dodge: 10, taken: 0.02 }], ["Sangue Frio", "leech", { leech: 0.01 }],
                   ["Segundo Fôlego", "regen", { regen: 1, lowHp: 0.1 }], ["Pés de Vento", "speed", { speed: 0.06, dodge: 4 }]],
        ks: { name: "Vento Errante", fx: { speed: 0.2, dodge: 15, hp: -0.2 }, desc: "+20% de velocidade de movimento e Dodge; −20% de vida máxima." } },
    ],
  },
};
const FX_LABEL = { dmg: ["dano", "%"], aspd: ["velocidade de ataque", "%"], crit: ["chance crítica", "%"], critDmg: ["dano crítico", "%"], hp: ["vida máxima", "%"],
  armor: ["defesa", ""], leech: ["roubo de vida", "%"], dodge: ["Dodge", ""], taken: ["dano recebido", "%-"], regen: ["vida/s", ""], block: ["bloqueio", "%"],
  exec: ["dano em alvos com <30% de vida", "%"], elite: ["dano em chefes e elites", "%"], lowHp: ["dano com <50% de vida", "%"], fury: ["Fúria/Mana máx.", ""],
  mreg: ["mana/s", ""], speed: ["velocidade de movimento", "%"], hpDmg: ["da vida somada ao dano", "%"], thorns: ["do dano devolvido", "%"], furyGain: ["Fúria por golpe", "%"] };
function fxText(fx) {
  return Object.entries(fx).map(([k, v]) => { const [n, u] = FX_LABEL[k] || [k, ""];
    if (u === "%-") return `−${+(v * 100).toFixed(1)}% de ${n}`;
    const val = u === "%" ? +(v * 100).toFixed(1) + "%" : +v.toFixed(1);
    return `${v < 0 ? "" : "+"}${val} ${u === "%" ? "de " : ""}${n}`; }).join(", ");
}

// ---------------------------------------------------------------- geração da teia (determinística)
const WEBS = {};
function talentWeb(voc) {
  voc = WEB_SPEC[voc] ? voc : "knight";
  if (WEBS[voc]) return WEBS[voc];
  const S = WEB_SPEC[voc], nodes = [], byId = {};
  const add = (n) => { n.adj = []; nodes.push(n); byId[n.id] = n; return n; };
  const link = (a, b) => { if (!a.adj.includes(b.id)) a.adj.push(b.id); if (!b.adj.includes(a.id)) b.adj.push(a.id); };
  const origin = add({ id: "o", type: "origin", name: "Origem", x: 0, y: 0, fx: {} });
  const ANG = [-90, 30, 150].map(a => a * Math.PI / 180), SP = 16;
  const spines = [];
  S.arms.forEach((A, ai) => {
    const a0 = ANG[ai], sp = [];
    let prev = origin;
    for (let i = 0; i < SP; i++) {
      const r = 70 + i * 44, a = a0 + Math.sin(i * 0.55) * 0.06;            // espinha levemente ondulada
      const sk = A.skills[i], vs = vocSpells(voc)[sk];
      const n = add(sk ? { id: `${ai}s${i}`, type: "skill", unlock: sk, name: vs ? vs.name : sk, x: Math.cos(a) * r, y: Math.sin(a) * r, fx: fxU(A.spine), arm: ai }
                       : { id: `${ai}s${i}`, type: "small", name: A.name, x: Math.cos(a) * r, y: Math.sin(a) * r, fx: fxU(A.spine), arm: ai });
      link(prev, n); prev = n; sp.push(n);
    }
    // keystone na ponta
    const rk = 70 + SP * 44 + 30, ks = add({ id: `${ai}k`, type: "keystone", name: A.ks.name, flag: A.ks.flag, fx: A.ks.fx, desc: A.ks.desc, x: Math.cos(a0) * rk, y: Math.sin(a0) * rk, arm: ai });
    link(prev, ks);
    // 4 aglomerados, lados alternados, cada um 6 pequenos + notável
    A.clusters.forEach(([cname, ck, nfx], ci) => {
      const base = sp[2 + ci * 3 + 1], side = ci % 2 ? 1 : -1, perp = a0 + side * Math.PI / 2;
      let p = base;
      for (let j = 0; j < 7; j++) {
        const bend = perp - side * j * 0.16, d = 40 * (j + 1);
        const x = base.x + Math.cos(bend) * d + Math.cos(a0) * j * 8, y = base.y + Math.sin(bend) * d + Math.sin(a0) * j * 8;
        const n = add(j < 6 ? { id: `${ai}c${ci}_${j}`, type: "small", name: cname, x, y, fx: fxU(ck), arm: ai }
                            : { id: `${ai}c${ci}n`, type: "notable", name: cname, x, y, fx: nfx, arm: ai });
        link(p, n); p = n;
      }
    });
    spines.push(sp);
  });
  // anel interno: 5 nós entre a espinha (índice 2) de um braço e a do próximo, para builds híbridas
  for (let ai = 0; ai < 3; ai++) {
    const A = spines[ai][2], B = spines[(ai + 1) % 3][2];
    const aA = Math.atan2(A.y, A.x), aB0 = Math.atan2(B.y, B.x), aB = aB0 < aA ? aB0 + Math.PI * 2 : aB0, R = Math.hypot(A.x, A.y);
    let p = A;
    for (let j = 1; j <= 5; j++) {
      const a = aA + (aB - aA) * j / 6;
      const n = add({ id: `r${ai}_${j}`, type: "small", name: "Elo", x: Math.cos(a) * R, y: Math.sin(a) * R, fx: j % 2 ? fxU("hp", 0.67) : fxU("dmg", 0.75), arm: -1 });
      link(p, n); p = n;
    }
    link(p, B);
  }
  // distância da Origem (para conferir que habilidade nenhuma espera nível)
  const dist = { o: 0 }, q = ["o"];
  while (q.length) { const id = q.shift(); for (const nb of byId[id].adj) if (dist[nb] == null) { dist[nb] = dist[id] + 1; q.push(nb); } }
  for (const n of nodes) n.dist = dist[n.id];
  return (WEBS[voc] = { voc, nodes, byId, branches: S.arms.map(a => a.name) });
}
// compatibilidade com o resto do jogo
const talentTree = voc => { const w = talentWeb(voc); return { branches: w.branches, nodes: w.nodes.filter(n => n.type !== "origin").map(n => Object.assign({ max: 1 }, n)) }; };

// ---------------------------------------------------------------- save e migração
// talentos antigos que liberavam magia (para manter liberadas as magias de quem já tinha a árvore velha)
const OLD_UNLOCKS = { k_slash: ["front", 3], k_quake: ["quake", 3], k_wrath: ["aura", 3], k_slasher: ["slasher", 3], k_xcut: ["xcut", 3], k_aegis: ["guard", 3], k_berserk: ["kberserk", 3],
  a_far: ["farsight", 3], a_holy: ["holy", 3], a_missile: ["missile", 3], a_volley: ["volley", 3], a_berserk: ["frenzy", 3], a_barrier: ["barrier", 3], a_wind: ["flee", 3] };
function talentRanks(voc) {
  const d = Save.voc(voc);
  if (!d.talents) d.talents = {};
  if (d.talentsV !== 2) {   // migração única: devolve todos os pontos, guarda as magias já liberadas
    const legacy = [];
    for (const k in d.talents) { const u = OLD_UNLOCKS[k]; if (u && d.talents[k] >= u[1]) legacy.push(u[0]); }
    d.legacySpells = legacy; d.talents = {}; d.talentsV = 2; try { Save.save(); } catch (e) {}
  }
  return d.talents;
}
const talentSpent = voc => Object.keys(talentRanks(voc)).length;
function talentFx(voc) {
  const r = talentRanks(voc), w = talentWeb(voc), out = { ks: {} };
  for (const id in r) { const n = w.byId[id]; if (!n) continue; for (const e in n.fx) out[e] = (out[e] || 0) + n.fx[e]; if (n.type === "keystone") out.ks[n.flag || n.id] = true; }
  return out;
}
// habilidade liberada? (Exura sempre; as outras pelo nó da teia + nível mínimo)
function spellUnlocked(voc, id, level) {
  const sp = vocSpells(voc)[id]; if (!sp) return false;
  if (level < (sp.level || 1)) return false;
  const w = talentWeb(voc), n = w.nodes.find(x => x.unlock === id);
  if (!n) return true;
  const d = Save.voc(voc); talentRanks(voc);
  return !!talentRanks(voc)[n.id] || (d.legacySpells || []).includes(id);
}
// nós que podem ser alocados agora (ligados a algo alocado)
function talentFrontier(voc) {
  const r = talentRanks(voc), w = talentWeb(voc), f = new Set();
  const owned = id => id === "o" || !!r[id];
  for (const n of w.nodes) if (owned(n.id)) for (const nb of n.adj) if (!owned(nb)) f.add(nb);
  return f;
}
// pode devolver? (sem deixar outro nó solto da Origem)
function talentRemovable(voc, id) {
  const r = talentRanks(voc), w = talentWeb(voc); if (!r[id]) return false;
  const seen = new Set(["o"]), q = ["o"];
  while (q.length) { const c = q.shift(); for (const nb of w.byId[c].adj) if (nb !== id && r[nb] && !seen.has(nb)) { seen.add(nb); q.push(nb); } }
  return Object.keys(r).every(k => k === id || seen.has(k));
}
// caminho mais curto do que já está alocado até o nó (para mostrar o custo)
function talentPath(voc, target) {
  const r = talentRanks(voc), w = talentWeb(voc), prev = {}, q = [];
  for (const n of w.nodes) if (n.id === "o" || r[n.id]) { prev[n.id] = null; q.push(n.id); }
  if (prev[target] !== undefined) return [];
  while (q.length) { const c = q.shift(); for (const nb of w.byId[c].adj) if (prev[nb] === undefined) { prev[nb] = c; if (nb === target) { const p = []; let x = nb; while (x && !(x === "o" || r[x])) { p.push(x); x = prev[x]; } return p; } q.push(nb); } }
  return null;
}
const respecPrice = level => (Save.testMode || level <= 10) ? 0 : 2 * level;

// ---------------------------------------------------------------- tela da teia (constelação em código)
// opts.respec: aberta pela Oráculo (permite devolver nós); opts.onChange: recalcular status; opts.onClose
function openTalentWeb(scene, opts = {}) {
  const voc = scene.vocId, w = talentWeb(voc), d = Save.voc(voc);
  const level = () => scene.hero && scene.hero.level ? scene.hero.level : Save.levelInfo(d.xpTotal).level;
  const points = () => Math.max(0, level() - 1 - talentSpent(voc));
  const c = scene.add.container(0, 0).setDepth(60); (scene.uiLayer || scene.ui).add(c);
  const undo = [];
  const PANEL = 230, VW = VIEW_W - PANEL;
  const bg = scene.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x05060a, 1).setOrigin(0).setInteractive(); c.add(bg);
  // céu de estrelas (fixo, determinístico)
  const sky = scene.add.graphics(); c.add(sky);
  for (let i = 0; i < 220; i++) { const h = Math.imul(i * 2654435761, 40503) >>> 0; sky.fillStyle(0xc8d0ff, 0.15 + (h % 50) / 160).fillRect(h % VW, (h >>> 10) % VIEW_H, 1 + (h % 7 === 0), 1); }
  const view = scene.add.container(VW / 2, VIEW_H / 2 + 10); c.add(view);
  const maskG = scene.make.graphics({ add: false }); maskG.fillRect(0, 0, VW, VIEW_H); view.setMask(maskG.createGeometryMask());
  view.setScale(TOUCH_UI ? 0.55 : 0.5);
  const edges = scene.add.graphics(), hl = scene.add.graphics(), nodesG = scene.add.graphics(); view.add([edges, hl, nodesG]);
  const icons = [];
  const COL = { own: 0xe0b050, ownL: 0xfff0b0, avail: 0x9fe08a, far: 0x4a4e5c, near: 0x8a8e9c, ks: 0xd06a4a, edgeOwn: 0xc8a050, edge: 0x2e3240 };
  // painel lateral
  const P = scene.add.container(VW, 0); c.add(P);
  P.add(scene.add.rectangle(0, 0, PANEL, VIEW_H, 0x0c0a08, 1).setOrigin(0).setStrokeStyle(1, 0x5a4a2a));
  const T = (x, y, s, size = 12, col = COLORS.text, o = {}) => { const t_ = txt(scene, x, y, s, size, col, o); P.add(t_); return t_; };
  T(PANEL / 2, 14, "Teia de Talentos", 22, COLORS.gold, { title: true }).setOrigin(0.5, 0);
  const ptsT = T(PANEL / 2, 46, "", 13, "#d8ffc8").setOrigin(0.5, 0);
  T(12, 74, "Seus bônus", 13, COLORS.gold);
  const sumT = T(12, 94, "", 11, COLORS.text, { wordWrap: { width: PANEL - 24 }, lineSpacing: 2 });
  const tipT = T(12, VIEW_H - 196, "", 11, "#e8dcc0", { wordWrap: { width: PANEL - 24 }, lineSpacing: 2 });
  const btn = (y, label, fn) => { const b = txt(scene, PANEL / 2, y, label, 13, COLORS.gold, { title: true }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    b.on("pointerdown", fn); b.on("pointerover", () => b.setColor("#fff0c0")); b.on("pointerout", () => b.setColor(COLORS.gold)); P.add(b); return b; };
  const undoB = btn(VIEW_H - 78, "Desfazer último", () => { const id = undo.pop(); if (id && talentRemovable(voc, id)) { delete talentRanks(voc)[id]; Save.save(); changed(); } });
  let allB = null;
  if (opts.respec) allB = btn(VIEW_H - 54, "", () => {
    const n = talentSpent(voc), cost = n * respecPrice(level());
    if (!n || d.gold < cost) return; d.gold -= cost; d.talents = {}; Save.save(); undo.length = 0; changed(); sfx(scene, "gem", 0.3); });
  btn(VIEW_H - 24, "Fechar (U / Esc)", () => close());
  const subs = []; const on = (ev, fn) => { scene.input.on(ev, fn); subs.push([ev, fn]); };
  const close = () => { c.destroy(); subs.forEach(([e, f]) => scene.input.off(e, f)); kb.forEach(k => scene.input.keyboard.off(...k)); if (opts.onClose) opts.onClose(); };

  let hover = null;
  const redraw = () => {
    const r = talentRanks(voc), fr = talentFrontier(voc), pts = points();
    edges.clear(); nodesG.clear(); hl.clear();
    for (const n of w.nodes) for (const nb of n.adj) if (n.id < nb) {
      const m = w.byId[nb], own = (n.id === "o" || r[n.id]) && (m.id === "o" || r[m.id]);
      edges.lineStyle(own ? 4 : 2, own ? COL.edgeOwn : COL.edge, 1).lineBetween(n.x, n.y, m.x, m.y);
    }
    // caminho até o nó sob o mouse
    if (hover && !r[hover]) { const path = talentPath(voc, hover);
      if (path) { let prev = null; for (const id of path.slice().reverse()) { const n = w.byId[id];
        const from = prev ? w.byId[prev] : w.byId[n.adj.find(a => a === "o" || r[a]) || n.adj[0]];
        hl.lineStyle(4, path.length <= pts ? COL.avail : 0xd05a4a, 0.9).lineBetween(from.x, from.y, n.x, n.y); prev = id; } } }
    for (const n of w.nodes) {
      const own = n.id === "o" || r[n.id], av = fr.has(n.id), col = own ? COL.own : av ? COL.near : COL.far;
      const R = n.type === "keystone" ? 20 : n.type === "notable" ? 15 : n.type === "skill" ? 13 : n.type === "origin" ? 16 : 9;
      if (own) nodesG.fillStyle(COL.ownL, 0.18).fillCircle(n.x, n.y, R + 8);               // brilho da estrela acesa
      nodesG.fillStyle(own ? col : 0x14161e, 1);
      if (n.type === "keystone") { const pts6 = []; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; pts6.push({ x: n.x + Math.cos(a) * R, y: n.y + Math.sin(a) * R }); }
        nodesG.fillPoints(pts6, true); nodesG.lineStyle(3, own ? COL.ownL : COL.ks, 1).strokePoints(pts6, true); }
      else if (n.type === "skill") { const dm = [{ x: n.x, y: n.y - R }, { x: n.x + R, y: n.y }, { x: n.x, y: n.y + R }, { x: n.x - R, y: n.y }];
        nodesG.fillPoints(dm, true); nodesG.lineStyle(3, own ? COL.ownL : 0x7ab0ff, 1).strokePoints(dm, true); }
      else { nodesG.fillCircle(n.x, n.y, R); nodesG.lineStyle(n.type === "notable" ? 3 : 2, own ? COL.ownL : n.type === "notable" ? 0xc8a050 : col, 1).strokeCircle(n.x, n.y, R); }
      if (av && pts > 0) nodesG.lineStyle(2, COL.avail, 0.9).strokeCircle(n.x, n.y, R + 5);   // disponível agora
      if (opts.respec && own && n.id !== "o" && talentRemovable(voc, n.id)) nodesG.lineStyle(2, 0xd05a4a, 0.8).strokeCircle(n.x, n.y, R + 5);
    }
    // painel
    ptsT.setText(pts > 0 ? `${pts} ponto(s) para gastar` : "Sem pontos livres").setColor(pts > 0 ? "#d8ffc8" : COLORS.dim);
    const f = talentFx(voc), lines = [];
    for (const k in f) if (k !== "ks" && f[k]) lines.push("• " + fxText({ [k]: f[k] }));
    for (const id in r) { const n = w.byId[id]; if (n && (n.type === "keystone" || n.type === "notable")) lines.push("★ " + n.name); }
    sumT.setText(lines.length ? lines.slice(0, 16).join("\n") + (lines.length > 16 ? `\n… +${lines.length - 16}` : "") : "Nada ainda. Comece pelos nós ligados à Origem (contorno verde).");
    undoB.setAlpha(undo.length ? 1 : 0.35);
    if (allB) { const n = talentSpent(voc), cost = n * respecPrice(level()); allB.setText(`Devolver tudo (${cost} de ouro)`).setAlpha(n && d.gold >= cost ? 1 : 0.4); }
  };
  const changed = () => { if (opts.onChange) opts.onChange(); redraw(); };
  const showTip = n => {
    if (!n) { tipT.setText(opts.respec ? "Respec: clique num nó com contorno vermelho para devolvê-lo." : "Arraste para mover · roda ou pinça para zoom · clique num nó ligado para alocar."); return; }
    const r = talentRanks(voc), path = talentPath(voc, n.id), lv = level();
    let s = `${n.name}${n.type === "notable" ? " (notável)" : n.type === "keystone" ? " (keystone)" : n.type === "skill" ? " (habilidade)" : ""}\n`;
    if (n.desc) s += n.desc + "\n"; else if (Object.keys(n.fx).length) s += fxText(n.fx) + "\n";
    if (n.unlock) { const sp = vocSpells(voc)[n.unlock]; s += `Libera ${sp ? sp.name : n.unlock}${sp && sp.level > 1 ? ` (nível ${sp.level})` : ""}\n`; }
    if (r[n.id] || n.id === "o") s += opts.respec && n.id !== "o" ? (talentRemovable(voc, n.id) ? `Devolver: ${respecPrice(lv)} de ouro` : "Devolva antes os nós além dele") : "Alocado";
    else if (path) s += `Custa ${path.length} ponto(s)` + (path.length > points() ? " — faltam pontos" : "");
    tipT.setText(s);
  };
  // áreas de clique dos nós
  for (const n of w.nodes) {
    const R = n.type === "keystone" ? 24 : n.type === "notable" ? 19 : 16;
    const z = scene.add.circle(n.x, n.y, R + (TOUCH_UI ? 8 : 0), 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    view.add(z);
    z.on("pointerover", () => { hover = n.id; showTip(n); redraw(); });
    z.on("pointerout", () => { if (hover === n.id) { hover = null; showTip(null); redraw(); } });
    z.on("pointerup", p => {
      if (dragMoved) return;
      const r = talentRanks(voc);
      if (opts.respec && r[n.id]) {
        const cost = respecPrice(level());
        if (!talentRemovable(voc, n.id) || d.gold < cost) { sfx(scene, "hit", 0.2); return; }
        d.gold -= cost; delete r[n.id]; Save.save(); changed(); sfx(scene, "gem", 0.25); return;
      }
      if (r[n.id] || n.id === "o") return;
      if (!talentFrontier(voc).has(n.id) || points() <= 0) { hover = n.id; showTip(n); redraw(); sfx(scene, "hit", 0.15); return; }
      r[n.id] = 1; undo.push(n.id); Save.save(); changed();
      if (n.unlock) { const sp = vocSpells(voc)[n.unlock]; if (scene.msg && sp) scene.msg(t("talent_unlock", { name: sp.name, key: sp.key, n: sp.level })); sfx(scene, "levelup", 0.35); }
      else sfx(scene, "gem", 0.3);
      const fl = scene.add.circle(n.x, n.y, 14, 0xfff0a0, 0.9).setBlendMode(Phaser.BlendModes.ADD); view.add(fl);
      scene.tweens.add({ targets: fl, scale: 2.4, alpha: 0, duration: 450, onComplete: () => fl.destroy() });
    });
  }
  // ícones das habilidades sobre os losangos
  for (const n of w.nodes) if (n.type === "skill") { const sp = vocSpells(voc)[n.unlock]; if (sp && scene.textures.exists(sp.icon)) { const im = scene.add.image(n.x, n.y, sp.icon); im.setScale(16 / Math.max(im.width, im.height)); view.add(im); icons.push(im); } }
  // arrastar, zoom e teclado
  let drag = null, dragMoved = false;
  bg.on("pointerdown", p => { drag = { x: p.x, y: p.y, vx: view.x, vy: view.y }; dragMoved = false; });
  on("pointerdown", p => { if (!c.active) return; if (p.x < VW) { drag = { x: p.x, y: p.y, vx: view.x, vy: view.y }; dragMoved = false; } });
  const onMove = p => { if (!c.active || !drag || !p.isDown) return; const dx = p.x - drag.x, dy = p.y - drag.y; if (Math.abs(dx) + Math.abs(dy) > 6) dragMoved = true; view.x = drag.vx + dx; view.y = drag.vy + dy; };
  on("pointermove", onMove);
  on("pointerup", () => { drag = null; scene.time.delayedCall(0, () => { dragMoved = false; }); });
  const zoom = (f, px = VW / 2, py = VIEW_H / 2) => { const s0 = view.scale, s1 = Phaser.Math.Clamp(s0 * f, 0.25, 1.6); view.x = px - (px - view.x) * s1 / s0; view.y = py - (py - view.y) * s1 / s0; view.setScale(s1); };
  const onWheel = (p, o, dx, dy) => { if (c.active) zoom(dy > 0 ? 0.88 : 1.14, p.x, p.y); };
  on("wheel", onWheel);
  const kb = [["keydown-LEFT", () => view.x += 40], ["keydown-RIGHT", () => view.x -= 40], ["keydown-UP", () => view.y += 40], ["keydown-DOWN", () => view.y -= 40],
    ["keydown-PLUS", () => zoom(1.15)], ["keydown-MINUS", () => zoom(0.87)], ["keydown-NUMPAD_ADD", () => zoom(1.15)], ["keydown-NUMPAD_SUBTRACT", () => zoom(0.87)]];
  kb.forEach(k => scene.input.keyboard.on(...k));
  // pinça (dois dedos)
  if (TOUCH_UI) { scene.input.addPointer(1); let pd = 0;
    on("pointermove", () => { if (!c.active) return; const a = scene.input.pointer1, b = scene.input.pointer2; if (a.isDown && b.isDown) { const dd = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y); if (pd) zoom(dd / pd); pd = dd; drag = null; } else pd = 0; }); }
  showTip(null); redraw();
  c.closeWeb = close;
  return c;
}

// ---------------------------------------------------------------- calabouço: tecla U abre a teia
Object.assign(DungeonScene.prototype, {
  talentPoints() { return Math.max(0, this.hero.level - 1 - talentSpent(this.vocId)); },
  buildAttrs() {
    if (this.attrBox) { this.attrBox.destroy(); this.attrBox = null; }
    this.bagOpen = true;
    this.attrBox = openTalentWeb(this, {
      onChange: () => { const h = this.hero, before = this.stats.maxHp; this.stats = this.computeStats(); const dHp = this.stats.maxHp - before; if (dHp) { h.maxHp += dHp; h.hp = Math.max(1, Math.min(h.maxHp, h.hp + Math.max(0, dHp))); } },
      onClose: () => { this.attrBox = null; this.bagOpen = false; },
    });
  },
  toggleAttrs() {
    if (this.finished || this.paused || this.bagOpen && !this.attrBox) return;
    if (this.attrBox) { this.attrBox.closeWeb(); return; }
    this.buildAttrs();
  },
  attrFree() { return this.talentPoints(); },
});
// cidade: a Oráculo oferece o respec
Object.assign(TownScene.prototype, {
  openTalentRespec() {
    if (this.talentBox) return;
    this.talentBox = openTalentWeb(this, { respec: true, onClose: () => { this.talentBox = null; } });
  },
});

{
  // efeitos da teia entram nos status
  const cs = DungeonScene.prototype.computeStats;
  DungeonScene.prototype.computeStats = function () {
    const s = cs.call(this), f = talentFx(this.vocId);
    s.might *= 1 + (f.dmg || 0); s.maxHp = Math.round(s.maxHp * Math.max(0.3, 1 + (f.hp || 0)));
    s.armor += f.armor || 0; s.talBlock = f.block || 0; s.recovery += f.regen || 0; s.atkSpeed = Math.max(0.3, (s.atkSpeed || 1) + (f.aspd || 0));
    s.talCrit = f.crit || 0; s.talCritDmg = f.critDmg || 0; s.leech = (f.leech || 0) * (f.ks.thirst ? 3 : 1); s.hpDmg = f.hpDmg || 0;
    s.exec = f.exec || 0; s.elite = f.elite || 0; s.lowHp = f.lowHp || 0; s.taken = Math.min(0.3, f.taken || 0); s.thorns = f.thorns || 0; s.furyGain = f.furyGain || 0;
    s.moveSpeed *= 1 + (f.speed || 0); s.gearDodge = (s.gearDodge || 0) + (f.dodge || 0); s.manaReg = (s.manaReg || 0) + (f.mreg || 0);
    s.ks = f.ks;
    this.furyMax = (this.furyMax || FURY_MAX) + (f.fury || 0);
    return s;
  };
  const P = DungeonScene.prototype;
  const md = P.maxDamage; P.maxDamage = function () { return md.call(this) + (this.stats.hpDmg || 0) * (this.hero ? this.hero.maxHp : this.stats.maxHp); };
  const cc = P.critChance; P.critChance = function () { return (this.stats.ks || {}).iron ? 0 : cc.call(this) + (this.stats.talCrit || 0); };
  P.critMult = function () { return 1.8 + (this.stats.talCritDmg || 0); };
  const bc = P.blockChance; P.blockChance = function () { const b = bc.call(this) + (this.ranged ? 0 : (this.stats.talBlock || 0)); return Math.min(0.6, (this.stats.ks || {}).iron ? b * 2 : b); };
  // Sede Eterna: Exura e poções curam metade
  const he = P.heal; P.heal = function (amount, ...a) { return he.call(this, (this.stats && (this.stats.ks || {}).thirst) ? amount * 0.5 : amount, ...a); };
  // Luz Ardente: habilidades custam vida; +25% de dano por 1,5 s depois de cada uma
  const ca = P.cast; P.cast = function (id, ...a) {
    const ks = (this.stats && this.stats.ks) || {}, h = this.hero, sp = this.spells && this.spells[id];
    if (!ks.burn || !sp || !sp.fury || !h) return ca.call(this, id, ...a);
    const cost = Math.round(sp.fury * 0.004 * h.maxHp); if (h.hp <= cost + 1) { this.msg && this.msg("Vida insuficiente para a Luz Ardente."); return; }
    const f0 = h.fury, cd0 = h.cds[id]; h.fury = 9999;
    const r = ca.call(this, id, ...a);
    h.fury = f0;
    if (h.cds[id] !== cd0) { h.hp -= cost; h.burnUntil = this.time.now + 1500; }
    return r;
  };
  // dano: execução, elites, vida baixa, Carcará, Luz Ardente; e roubo de vida
  const dm = P.damageMonster;
  P.damageMonster = function (m, dmg, ...a) {
    const st = this.stats || {}, ks = st.ks || {};
    if (dmg > 0 && m && m.maxHp) {
      if (st.exec && m.hp < m.maxHp * 0.3) dmg *= 1 + st.exec;
      if (st.elite && (m.elite || m.champion)) dmg *= 1 + st.elite;
      if (st.lowHp && this.hero && this.hero.hp < this.hero.maxHp * 0.5) dmg *= 1 + st.lowHp;
      if (ks.carcara) dmg *= m.hp >= m.maxHp * 0.999 ? this.critMult() : 0.85;
      if (ks.burn && this.hero && this.hero.burnUntil > this.time.now) dmg *= 1.25;
    }
    const r = dm.call(this, m, dmg, ...a);
    const l = st.leech; if (l && dmg > 0 && this.hero && !this.hero.dead) this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + dmg * l);
    return r;
  };
}

{
  const P = DungeonScene.prototype;
  // Pele de Pedra / Evasão (dano recebido) e Espinhos (devolve parte do golpe)
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
