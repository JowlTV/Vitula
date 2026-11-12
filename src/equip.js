// Equipamentos e elementos.
// Cada item tem um ícone 32×32 desenhado em código (forma da peça + material + detalhe), com contorno escuro,
// no estilo dos ícones do Tibia. Os ícones não aparecem no personagem: só na mochila e no chão quando caem.

// ---------------------------------------------------------------- elementos
// res = resistência (0,25 = recebe 25% menos; −0,25 = recebe 25% mais)
const ELEMENTS = {
  physical: { name: "Físico",  color: "#f4ece0" },
  fire:     { name: "Fogo",    color: "#ff9a3a" },
  ice:      { name: "Gelo",    color: "#9ae4ff" },
  earth:    { name: "Terra",   color: "#9fe060" },
  energy:   { name: "Raio",    color: "#c8a0ff" },
  holy:     { name: "Sagrado", color: "#ffe680" },
};
// fraquezas e resistências dos monstros (o que não está aqui é neutro)
const MONSTER_RES = {
  rat:           { earth: 0.2, fire: -0.1 },
  cave_rat:      { earth: 0.25, ice: -0.1 },
  bat:           { energy: -0.2, earth: 0.1 },
  slime:         { physical: 0.15, earth: 0.6, fire: -0.3, ice: -0.1 },
  skeleton:      { physical: 0.1, earth: 0.8, ice: 0.3, holy: -0.5, fire: -0.1 },
  spider:        { fire: -0.25, earth: 0.2 },
  poison_spider: { earth: 1.0, fire: -0.25, ice: -0.1 },
  giant_rat:     { physical: 0.1, earth: 0.3, fire: -0.15 },
};
// elemento do ataque de cada monstro (o resto bate físico)
const MONSTER_ELEMENT = { poison_spider: "earth", slime: "earth" };

// ---------------------------------------------------------------- equipamentos
// slot: weapon, shield, helmet, armor, legs, boots
// atk = ataque da arma (substitui o punho, 20); def = defesa (soma na redução de dano); lvl = nível mínimo
// voc: só essas vocações usam; twoH: arma de duas mãos (sem escudo)
// el/elDmg: dano extra de um elemento a cada golpe; poison: envenena o alvo (% do dano por s, duração)
// res: resistências do herói; block, crit, ml, hpReg, manaReg, speed: bônus
// art: desenho do ícone (forma, material, detalhe)
const EQUIP = {
  // espadas (Cavaleiro)
  karhyn_sword:   { slot: "weapon", name: "Espada de Karhyn",        atk: 24, lvl: 1,  voc: ["knight"], price: 0,    desc: "A lâmina da forja da cidade. Simples e fiel.", art: { f: "sword", m: "iron", hilt: "leather", gem: "#c8a030" } },
  crimson_sword:  { slot: "weapon", name: "Espada Carmesim",          atk: 28, lvl: 5,  voc: ["knight"], price: 120,  art: { f: "sword", m: "crimson", hilt: "dark", gem: "#ff4040" } },
  broadsword:     { slot: "weapon", name: "Espada Larga",             atk: 36, lvl: 10, voc: ["knight"], twoH: true, price: 260, desc: "Duas mãos: não dá para usar escudo.", art: { f: "sword", m: "iron", hilt: "leather", wide: 1, long: 1 } },
  serpent_sword:  { slot: "weapon", name: "Espada da Serpente",       atk: 30, lvl: 12, voc: ["knight"], el: "earth", elDmg: 6, poison: { pct: 0.25, dur: 4 }, price: 340, desc: "Envenena o alvo.", art: { f: "sword", m: "serpent", hilt: "serpent", wavy: 1, gem: "#e0e040" } },
  crystal_sword:  { slot: "weapon", name: "Espada de Cristal",        atk: 34, lvl: 15, voc: ["knight"], el: "ice", elDmg: 4, price: 450, art: { f: "sword", m: "crystal", hilt: "iron", gem: "#d0f4ff" } },
  avenger:        { slot: "weapon", name: "Espada Vingadora",         atk: 46, lvl: 20, voc: ["knight"], twoH: true, price: 700, desc: "Duas mãos: não dá para usar escudo.", art: { f: "sword", m: "steel", hilt: "gold", wide: 1, long: 1, gem: "#4080ff" } },
  fire_sword:     { slot: "weapon", name: "Espada de Fogo",           atk: 34, lvl: 22, voc: ["knight"], el: "fire", elDmg: 12, price: 820, art: { f: "sword", m: "fire", hilt: "dark", flame: 1 } },
  emerald_sword:  { slot: "weapon", name: "Espada Esmeralda",         atk: 42, lvl: 28, voc: ["knight"], crit: 0.02, price: 1100, art: { f: "sword", m: "emerald", hilt: "gold", gem: "#40ff90" } },
  demon_sword:    { slot: "weapon", name: "Espada Demoníaca",         atk: 47, lvl: 34, voc: ["knight"], el: "fire", elDmg: 6, price: 1500, art: { f: "sword", m: "demon", hilt: "dark", spikes: 1, gem: "#ff2020" } },
  magic_longsword:{ slot: "weapon", name: "Espada Longa Mágica",      atk: 50, lvl: 40, voc: ["knight"], el: "energy", magic: 1, ml: 1, price: 2100, desc: "Ataque mágico extra (cresce com o magic level).", art: { f: "sword", m: "magic", hilt: "gold", long: 1, glow: "#a8a0ff", gem: "#b070ff" } },
  dragon_sword:   { slot: "weapon", name: "Espada do Dragão",         atk: 56, lvl: 50, voc: ["knight"], el: "fire", elDmg: 10, price: 3000, art: { f: "sword", m: "dragon", hilt: "gold", wide: 1, wings: 1, gem: "#ff6020" } },
  // escudos (Cavaleiro)
  wooden_shield:  { slot: "shield", name: "Escudo de Madeira",        def: 1,   lvl: 1,  voc: ["knight"], price: 0,    art: { f: "round", m: "wood", rim: "iron" } },
  copper_shield:  { slot: "shield", name: "Escudo de Cobre",          def: 1.5, lvl: 5,  voc: ["knight"], price: 110,  art: { f: "round", m: "copper", rim: "copper", boss: 1 } },
  battle_shield:  { slot: "shield", name: "Escudo de Batalha",        def: 2,   lvl: 10, voc: ["knight"], price: 240,  art: { f: "heater", m: "iron", rim: "dark", emb: "bar" } },
  guardian_shield:{ slot: "shield", name: "Escudo do Guardião",       def: 2.8, lvl: 16, voc: ["knight"], block: 0.02, price: 420, art: { f: "heater", m: "guardian", rim: "steel", emb: "cross" } },
  medusa_shield:  { slot: "shield", name: "Escudo da Medusa",         def: 3.2, lvl: 22, voc: ["knight"], res: { earth: 0.15 }, price: 700, art: { f: "round", m: "stone", rim: "serpent", emb: "medusa" } },
  dragon_shield:  { slot: "shield", name: "Escudo do Dragão",         def: 3.8, lvl: 28, voc: ["knight"], res: { fire: 0.15 }, price: 1000, art: { f: "kite", m: "dragon", rim: "gold", emb: "scales" } },
  demon_shield:   { slot: "shield", name: "Escudo Demoníaco",         def: 4.4, lvl: 34, voc: ["knight"], crit: 0.02, res: { holy: -0.1, fire: 0.1 }, price: 1400, art: { f: "kite", m: "demon", rim: "dark", emb: "horns" } },
  magic_shield:   { slot: "shield", name: "Escudo Mágico",            def: 4.8, lvl: 40, voc: ["knight"], ml: 1, res: { energy: 0.15 }, price: 1900, art: { f: "round", m: "magic", rim: "gold", emb: "rune" } },
  blessed_shield: { slot: "shield", name: "Escudo Abençoado",         def: 6,   lvl: 50, voc: ["knight"], block: 0.04, hpReg: 1, res: { holy: 0.2 }, price: 2800, art: { f: "tower", m: "holy", rim: "gold", emb: "sun" } },
  // elmos
  wooden_helmet:  { slot: "helmet", name: "Elmo de Madeira",          def: 0.5, lvl: 1,  price: 30,   art: { f: "cap", m: "wood", trim: "leather" } },
  chain_helmet:   { slot: "helmet", name: "Elmo de Malha",            def: 0.8, lvl: 4,  price: 80,   art: { f: "cap", m: "chain", trim: "iron" } },
  copper_helmet:  { slot: "helmet", name: "Elmo de Cobre",            def: 1,   lvl: 7,  price: 130,  art: { f: "nasal", m: "copper", trim: "copper" } },
  steel_helmet:   { slot: "helmet", name: "Elmo de Aço",              def: 1.4, lvl: 12, price: 260,  art: { f: "closed", m: "steel", trim: "iron" } },
  dark_helmet:    { slot: "helmet", name: "Elmo Sombrio",             def: 1.6, lvl: 16, res: { holy: -0.05, earth: 0.05 }, price: 380, art: { f: "closed", m: "dark", trim: "dark", spikes: 1 } },
  crusader_helmet:{ slot: "helmet", name: "Elmo do Cruzado",          def: 1.9, lvl: 20, res: { holy: 0.05 }, price: 520, art: { f: "great", m: "steel", trim: "gold", cross: 1 } },
  royal_helmet:   { slot: "helmet", name: "Elmo Real",                def: 2.2, lvl: 26, ml: 1, price: 760, art: { f: "closed", m: "gold", trim: "royal", crown: 1 } },
  demon_helmet:   { slot: "helmet", name: "Elmo Demoníaco",           def: 2.6, lvl: 34, res: { fire: 0.08 }, price: 1200, art: { f: "closed", m: "demon", trim: "dark", horns: 1 } },
  golden_helmet:  { slot: "helmet", name: "Elmo Dourado",             def: 2.9, lvl: 42, ml: 1, hpReg: 0.5, price: 1700, art: { f: "great", m: "gold", trim: "gold", wingsH: 1 } },
  dragon_helmet:  { slot: "helmet", name: "Elmo de Escamas de Dragão", def: 3.3, lvl: 50, res: { fire: 0.1, earth: 0.05 }, price: 2400, art: { f: "closed", m: "dscale", trim: "gold", crest: 1 } },
  // armaduras
  wooden_armor:   { slot: "armor", name: "Armadura de Madeira",       def: 1,   lvl: 1,  price: 40,   art: { f: "armor", m: "wood", trim: "leather" } },
  leather_armor:  { slot: "armor", name: "Armadura de Couro",         def: 1.4, lvl: 3,  price: 70,   art: { f: "armor", m: "leather", trim: "leather", stitch: 1 } },
  chain_armor:    { slot: "armor", name: "Armadura de Malha",         def: 2,   lvl: 8,  price: 180,  art: { f: "armor", m: "chain", trim: "leather" } },
  plate_armor:    { slot: "armor", name: "Armadura de Placas",        def: 2.8, lvl: 14, price: 360,  art: { f: "armor", m: "steel", trim: "iron", plates: 1 } },
  dark_armor:     { slot: "armor", name: "Armadura Sombria",          def: 3.2, lvl: 18, res: { earth: 0.05 }, price: 500, art: { f: "armor", m: "dark", trim: "dark", plates: 1 } },
  knight_armor:   { slot: "armor", name: "Armadura de Cavaleiro",     def: 3.8, lvl: 24, voc: ["knight"], price: 760, art: { f: "armor", m: "steel", trim: "royal", plates: 1, cross: 1 } },
  golden_armor:   { slot: "armor", name: "Armadura Dourada",          def: 4.4, lvl: 32, price: 1200, art: { f: "armor", m: "gold", trim: "gold", plates: 1 } },
  magic_plate:    { slot: "armor", name: "Armadura de Placas Mágica", def: 5,   lvl: 40, ml: 1, res: { energy: 0.1 }, price: 1800, art: { f: "armor", m: "magic", trim: "gold", plates: 1, rune: 1 } },
  dragon_mail:    { slot: "armor", name: "Malha de Escamas de Dragão", def: 5.6, lvl: 50, res: { fire: 0.12, earth: 0.06 }, price: 2600, art: { f: "armor", m: "dscale", trim: "gold", scales: 1 } },
  // calças
  leather_legs:   { slot: "legs", name: "Calça de Couro",             def: 0.5, lvl: 1,  price: 35,   art: { f: "legs", m: "leather", trim: "leather", stitch: 1 } },
  wooden_legs:    { slot: "legs", name: "Calça de Madeira",           def: 0.7, lvl: 3,  price: 60,   art: { f: "legs", m: "wood", trim: "leather" } },
  chain_legs:     { slot: "legs", name: "Calça de Malha",             def: 1.2, lvl: 8,  price: 150,  art: { f: "legs", m: "chain", trim: "leather" } },
  plate_legs:     { slot: "legs", name: "Calça de Placas",            def: 1.8, lvl: 14, price: 320,  art: { f: "legs", m: "steel", trim: "iron", plates: 1 } },
  knight_legs:    { slot: "legs", name: "Calça de Cavaleiro",         def: 2.4, lvl: 24, voc: ["knight"], price: 650, art: { f: "legs", m: "steel", trim: "royal", plates: 1 } },
  golden_legs:    { slot: "legs", name: "Calça Dourada",              def: 2.9, lvl: 32, price: 1100, art: { f: "legs", m: "gold", trim: "gold", plates: 1 } },
  magic_legs:     { slot: "legs", name: "Calça Mágica",               def: 3.2, lvl: 40, ml: 1, price: 1600, art: { f: "legs", m: "magic", trim: "gold", rune: 1 } },
  dragon_legs:    { slot: "legs", name: "Calça de Escamas de Dragão", def: 3.6, lvl: 50, res: { fire: 0.08 }, price: 2300, art: { f: "legs", m: "dscale", trim: "gold", scales: 1 } },
  // botas
  leather_boots:  { slot: "boots", name: "Botas de Couro",            def: 0.4, lvl: 1,  price: 30,   art: { f: "boots", m: "leather", trim: "leather" } },
  chain_boots:    { slot: "boots", name: "Botas de Malha",            def: 0.8, lvl: 8,  price: 140,  art: { f: "boots", m: "chain", trim: "leather" } },
  sandals:        { slot: "boots", name: "Sandálias",                 def: 0.1, lvl: 1,  hpReg: 1, manaReg: 1, price: 220, desc: "As mais fracas, mas aceleram a regeneração de vida e mana.", art: { f: "sandals", m: "leather", trim: "leather" } },
  crocodile_boots:{ slot: "boots", name: "Botas de Crocodilo",        def: 1.2, lvl: 15, res: { earth: 0.06 }, price: 380, art: { f: "boots", m: "croc", trim: "leather", scales: 1 } },
  golden_boots:   { slot: "boots", name: "Botas Douradas",            def: 1.6, lvl: 28, speed: 0.06, price: 1000, art: { f: "boots", m: "gold", trim: "gold" } },
  guardian_boots: { slot: "boots", name: "Botas do Guardião",         def: 2,   lvl: 36, block: 0.02, hpReg: 0.5, price: 1500, art: { f: "boots", m: "guardian", trim: "steel", plates: 1 } },
  dragon_boots:   { slot: "boots", name: "Botas de Escamas de Dragão", def: 2.4, lvl: 50, res: { fire: 0.06 }, speed: 0.04, price: 2200, art: { f: "boots", m: "dscale", trim: "gold", scales: 1 } },
};

// Ordem de força em cada tipo (do mais fraco ao mais forte). Os de Escamas de Dragão, os Mágicos e os do Dragão
// são os mais fortes; o resto segue a ordem da lista original. Nível, ataque e defesa saem desta posição.
const EQUIP_ORDER = {
  weapon: ["karhyn_sword", "crimson_sword", "broadsword", "serpent_sword", "crystal_sword", "avenger", "fire_sword", "emerald_sword", "demon_sword", "dragon_sword", "magic_longsword"],
  shield: ["wooden_shield", "copper_shield", "battle_shield", "guardian_shield", "medusa_shield", "demon_shield", "blessed_shield", "dragon_shield", "magic_shield"],
  helmet: ["wooden_helmet", "chain_helmet", "copper_helmet", "steel_helmet", "dark_helmet", "crusader_helmet", "royal_helmet", "demon_helmet", "golden_helmet", "dragon_helmet"],
  armor:  ["wooden_armor", "leather_armor", "chain_armor", "plate_armor", "dark_armor", "knight_armor", "golden_armor", "magic_plate", "dragon_mail"],
  legs:   ["leather_legs", "wooden_legs", "chain_legs", "plate_legs", "knight_legs", "golden_legs", "magic_legs", "dragon_legs"],
  boots:  ["leather_boots", "chain_boots", "sandals", "crocodile_boots", "golden_boots", "guardian_boots", "dragon_boots"],
};
// [mínimo, máximo] de ataque (armas) ou defesa (o resto), do 1º ao último da ordem
const EQUIP_RANGE = { weapon: [24, 60], shield: [1, 6], helmet: [0.5, 3.4], armor: [1, 5.8], legs: [0.5, 3.8], boots: [0.4, 2.6] };
for (const slot in EQUIP_ORDER) EQUIP_ORDER[slot].forEach((id, i, arr) => {
  const E = EQUIP[id], f = arr.length > 1 ? i / (arr.length - 1) : 0, [a, b] = EQUIP_RANGE[slot];
  E.rank = f;                                     // 0 = mais fraco, 1 = mais forte do tipo
  E.lvl = Math.max(1, Math.round(1 + f * 49));    // nível 1 a 50
  const v = a + (b - a) * f;
  if (slot === "weapon") E.atk = Math.round(v * (E.twoH ? 1.2 : 1)); else E.def = Math.round(v * 10) / 10;
  if (id === "sandals") E.def = 0.1;              // as mais fracas: compensam na regeneração
});

// ---------------------------------------------------------------- raridade e aprimoramento
// O mesmo item cai em raridades diferentes. No ferreiro, 2 itens da mesma raridade dão +1 ao escolhido.
// Ao chegar a +5 ele sobe de raridade (até Ultra raro, que para no +5).
// Lendário só cai de chefes e campeões; cada +1 pede Essências de chefe, até +10.
const RARITY = [
  { name: "Normal",     color: "#d8d0c0", hex: 0x8a8070, mult: 1.00 },
  { name: "Incomum",    color: "#6ad86a", hex: 0x3a9a3a, mult: 1.10 },
  { name: "Raro",       color: "#5aa8ff", hex: 0x2a6ad0, mult: 1.22 },
  { name: "Ultra raro", color: "#c878ff", hex: 0x8a3ad0, mult: 1.36 },
  { name: "Lendário",   color: "#ffa030", hex: 0xd07010, mult: 1.55 },
];
const PLUS_BONUS = 0.04;        // cada +1: +4% de ataque/defesa/dano do elemento
const LEGEND_MAX = 10, ESSENCE_PER_PLUS = 2;
function gearMult(g) { return RARITY[g.r || 0].mult * (1 + PLUS_BONUS * (g.p || 0)); }
function gearName(g) { return EQUIP[g.id].name + (g.p ? ` +${g.p}` : ""); }
function gearNew(id, r = 0) { return { id, r, p: 0 }; }
// o que o ferreiro pede para o próximo +1 (null = já está no máximo)
function forgeNext(g) {
  if (g.r === 4) return g.p >= LEGEND_MAX ? null : { essence: ESSENCE_PER_PLUS, to: { r: 4, p: g.p + 1 } };
  if (g.r === 3 && g.p >= 5) return null;
  const p = g.p + 1;
  return { items: 2, to: p >= 5 && g.r < 3 ? { r: g.r + 1, p: 0 } : { r: g.r, p } };
}
// cada equipamento também é um item que pode cair no chão
for (const id in EQUIP) ITEMS["eq_" + id] = { icon: "eq_" + id, name: EQUIP[id].name, gear: id };
ITEMS.boss_essence = { icon: "i_red_gem", tint: 0xff9a30, name: "Essência de chefe" };

function equipOk(id, vocId) { const E = EQUIP[id]; return !E.voc || E.voc.includes(vocId); }
// texto curto de atributos do item (para a mochila e o ferreiro); g = { id, r, p }
function equipStats(g) {
  if (typeof g === "string") g = gearNew(g);
  const E = EQUIP[g.id], m = gearMult(g), p = [], pct = v => `${Math.round(v * 100)}%`, n = v => (Math.round(v * 10) / 10).toString().replace(".", ",");
  if (E.atk) p.push(`Ataque ${Math.round(E.atk * m)}`);
  if (E.def) p.push(`Defesa ${n(E.def * m)}`);
  if (E.twoH) p.push("duas mãos");
  if (E.el && E.elDmg) p.push(`+${Math.round(E.elDmg * m)} de ${ELEMENTS[E.el].name.toLowerCase()}`);
  if (E.magic) p.push("+ataque mágico (raio)");
  if (E.poison) p.push("envenena");
  if (E.crit) p.push(`crítico +${pct(E.crit)}`);
  if (E.block) p.push(`bloqueio +${pct(E.block)}`);
  if (E.ml) p.push(`magic level +${E.ml}`);
  if (E.hpReg) p.push(`+${n(E.hpReg)} vida/s`);
  if (E.manaReg) p.push(`+${n(E.manaReg)} mana/s`);
  if (E.speed) p.push(`velocidade +${pct(E.speed)}`);
  for (const k in E.res || {}) p.push(`${ELEMENTS[k].name} ${E.res[k] > 0 ? "+" : ""}${pct(E.res[k])}`);
  return p.join(" · ");
}

// ---------------------------------------------------------------- ícones em código (32×32)
const MAT = {   // escuro, médio, claro, brilho
  wood:     ["#3a2414", "#5c3a1e", "#86592f", "#b08050"],
  leather:  ["#341e12", "#5a3622", "#80502e", "#a87048"],
  copper:   ["#4a2412", "#8a4a22", "#c27238", "#f0aa66"],
  iron:     ["#262a32", "#4c525e", "#7c8492", "#c0c8d4"],
  steel:    ["#22283a", "#46506a", "#7a88a4", "#d4def0"],
  chain:    ["#22262e", "#4a505c", "#828a98", "#c4ccd8"],
  dark:     ["#100e14", "#24202c", "#3c3646", "#625c70"],
  gold:     ["#4a3208", "#8a6418", "#cca032", "#fbe48a"],
  crimson:  ["#360a10", "#741420", "#b02a32", "#ec6a5e"],
  crystal:  ["#183a4c", "#2a6e90", "#5cb8dc", "#e0f8ff"],
  emerald:  ["#08361c", "#146638", "#28a85a", "#9cf4b8"],
  fire:     ["#5a1404", "#b23c0c", "#f27c1a", "#ffe874"],
  demon:    ["#18040a", "#480a12", "#82141e", "#d83434"],
  magic:    ["#18143e", "#302878", "#5a50c4", "#b4acff"],
  dragon:   ["#2c0a06", "#6c1c10", "#ac3820", "#ec8a4a"],
  dscale:   ["#0c2812", "#1c5226", "#36883c", "#8cd472"],
  serpent:  ["#122a10", "#2c5220", "#5a8a30", "#c4d860"],
  stone:    ["#24282a", "#4a5050", "#727a76", "#a4aca6"],
  guardian: ["#16263a", "#2a4868", "#4a7aac", "#a0ccf4"],
  holy:     ["#5a4a28", "#a89868", "#e4dcc0", "#ffffff"],
  croc:     ["#1c280e", "#38481a", "#5a6e2c", "#90a254"],
  royal:    ["#26103e", "#4a2478", "#7a46b8", "#c4a0f0"],
};
const OUTLINE = "#0a0808";

function makeEquipTextures(scene) {
  for (const id in EQUIP) {
    const k = "eq_" + id;
    if (scene.textures.exists(k)) continue;
    const px = drawEquipIcon(EQUIP[id].art);
    const tex = scene.textures.createCanvas(k, 32, 32), ctx = tex.getContext();
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const c = px[y * 32 + x]; if (c) { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); } }
    tex.refresh(); tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
}

// desenha numa grade 32×32 e devolve um array de cores (null = transparente)
function drawEquipIcon(a) {
  const P = new Array(32 * 32).fill(null);
  const set = (x, y, c) => { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < 32 && y < 32 && c) P[y * 32 + x] = c; };
  const get = (x, y) => x >= 0 && y >= 0 && x < 32 && y < 32 ? P[y * 32 + x] : null;
  const M = MAT[a.m] || MAT.iron, TR = MAT[a.trim || a.rim || a.hilt] || MAT.iron;
  // tom pela posição (luz vindo de cima à esquerda) + padrão do material
  const shade = (x, y, cx, cy, r) => {
    const l = ((cx - x) + (cy - y)) / (r * 1.6);
    let i = l > 0.45 ? 3 : l > 0.05 ? 2 : l > -0.45 ? 1 : 0;
    if (a.m === "chain") i = Math.max(0, Math.min(3, i + ((x + y) % 2 ? 0 : -1)));
    if (a.m === "wood" && y % 4 === 0) i = Math.max(0, i - 1);
    if ((a.scales || a.m === "dscale" || a.m === "croc") && ((y % 3 === 0 && (x + (y % 6 ? 0 : 1)) % 3 === 0))) i = Math.max(0, i - 1);
    if (a.m === "stone" && (x * 7 + y * 13) % 11 === 0) i = Math.max(0, i - 1);
    return M[i];
  };
  const fillMask = (inside, cx, cy, r, pal) => {
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (inside(x, y)) set(x, y, pal ? pal(x, y) : shade(x, y, cx, cy, r));
  };

  switch (a.f) {
    case "sword": {
      // lâmina na diagonal: ponta em cima à direita, cabo embaixo à esquerda
      const L = a.long ? 1 : 0, W = a.wide ? 1 : 0;
      const tip = 3, guardAt = a.long ? 21 : 20;   // posição ao longo da diagonal (x da lâmina)
      for (let t = tip; t <= guardAt; t++) {
        const cx = t, cy = 31 - t - 1;
        const half = (t - tip < 3 ? 0 : 1) + W;
        for (let k = -half; k <= half; k++) {
          let c = k < 0 ? M[3] : k > 0 ? M[1] : M[2];
          if (a.wavy && (t % 4 === 0) && k === half) c = M[0];
          set(cx + k, cy + k, c); set(cx + k + 1, cy + k, c);
        }
        if (a.flame && t % 3 === 0 && t < guardAt - 2) { set(cx - 2 - W, cy - 3 - W, MAT.fire[3]); set(cx - 1 - W, cy - 2 - W, MAT.fire[2]); }
        if (a.spikes && t % 4 === 2) { set(cx + 2 + W, cy + 3 + W, M[3]); }
        if (a.glow && t % 2) set(cx - 2 - W, cy - 2 - W, a.glow);
      }
      // guarda (perpendicular à lâmina)
      const gx = 31 - guardAt - 1;
      const GL = a.wings ? 6 : 4 + W;
      const hp = MAT[a.hilt] || MAT.iron;
      for (let k = -GL; k <= GL; k++) {
        const x = guardAt - 1 - k, y = gx + 1 - k;
        set(x, y, k < 0 ? hp[3] : hp[2]); set(x + 1, y, hp[1]);
        if (a.wings && Math.abs(k) >= 4) { set(x - Math.sign(k), y - 1, hp[2]); }
      }
      // cabo e pomo
      const gripLen = 4 + L * 2;
      for (let i = 1; i <= gripLen; i++) { const x = guardAt - i - 1, y = 31 - guardAt + i; set(x, y, i % 2 ? TR[2] : TR[1]); set(x + 1, y, TR[0]); }
      { const x = guardAt - gripLen - 2, y = 31 - guardAt + gripLen + 1; set(x, y, hp[3]); set(x + 1, y, hp[2]); set(x, y + 1, hp[1]); set(x + 1, y + 1, hp[1]); }
      if (a.gem) { const x = guardAt - 1, y = gx + 1; set(x, y, a.gem); set(x + 1, y, a.gem); }
      break;
    }
    case "round": case "heater": case "kite": case "tower": {
      const cx = 15.5, cy = 15.5;
      const inShape = {
        round: (x, y) => Math.hypot(x - cx, y - cy) <= 12.5,
        heater: (x, y) => y >= 3 && y <= 28 && Math.abs(x - cx) <= (y < 16 ? 12 : 12 - (y - 16) * 1.0),
        kite: (x, y) => y >= 2 && y <= 29 && Math.abs(x - cx) <= (y < 9 ? 6 + (y - 2) * 0.9 : 12.3 - (y - 9) * 0.6),
        tower: (x, y) => y >= 2 && y <= 29 && Math.abs(x - cx) <= 11 && !(y < 4 && Math.abs(x - cx) > 9),
      }[a.f];
      const R = MAT[a.rim] || MAT.iron;
      const border = (x, y) => inShape(x, y) && !(inShape(x - 2, y) && inShape(x + 2, y) && inShape(x, y - 2) && inShape(x, y + 2));
      fillMask((x, y) => inShape(x, y), cx, cy, 13);
      fillMask(border, cx, cy, 13, (x, y) => R[(x + y < 31) ? 3 : 1]);
      if (a.m === "wood") for (let y = 0; y < 32; y++) for (const x of [10, 16, 22]) if (inShape(x, y) && !border(x, y)) set(x, y, M[0]);
      if (a.boss) { for (let y = 12; y <= 19; y++) for (let x = 12; x <= 19; x++) if (Math.hypot(x - 15.5, y - 15.5) < 3.8) set(x, y, Math.hypot(x - 14.5, y - 14.5) < 1.6 ? R[3] : R[2]); }
      const E = a.emb, ec = R;
      if (E === "bar") for (let x = 8; x <= 23; x++) { set(x, 13, ec[2]); set(x, 14, ec[1]); }
      if (E === "cross") { for (let y = 8; y <= 23; y++) { set(15, y, MAT.gold[2]); set(16, y, MAT.gold[1]); } for (let x = 10; x <= 21; x++) { set(x, 12, MAT.gold[2]); set(x, 13, MAT.gold[1]); } }
      if (E === "medusa") { for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const d = Math.hypot(x - 15.5, y - 15.5); if (d < 4.5) set(x, y, d < 2 ? "#2a3a20" : MAT.serpent[2]); else if (d < 8.5 && ((Math.atan2(y - 15.5, x - 15.5) * 4 / Math.PI + d) | 0) % 2 === 0) set(x, y, MAT.serpent[1]); } set(14, 15, "#e04030"); set(17, 15, "#e04030"); }
      if (E === "scales") for (let y = 6; y <= 24; y += 3) for (let x = 6 + (y % 2) * 2; x <= 25; x += 4) if (inShape(x, y) && !border(x, y)) { set(x, y, M[3]); set(x + 1, y, M[2]); set(x, y + 1, M[0]); }
      if (E === "horns") { for (let i = 0; i < 6; i++) { set(9 + i * 0.4, 13 - i, MAT.holy[2]); set(22 - i * 0.4, 13 - i, MAT.holy[2]); } for (let y = 14; y <= 21; y++) for (let x = 12; x <= 19; x++) if (Math.hypot(x - 15.5, y - 17) < 3.6) set(x, y, MAT.holy[1]); set(14, 17, "#ff2020"); set(17, 17, "#ff2020"); }
      if (E === "rune") { const r = MAT.magic[3]; for (let i = -6; i <= 6; i++) { set(15 + i, 15 + i, r); set(15 + i, 15 - i, r); } for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (Math.abs(Math.hypot(x - 15.5, y - 15.5) - 7) < 0.6) set(x, y, r); }
      if (E === "sun") { for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const d = Math.hypot(x - 15.5, y - 14.5); if (d < 4) set(x, y, d < 2.2 ? "#ffffff" : MAT.gold[3]); } for (let k = 0; k < 8; k++) { const an = k * Math.PI / 4; for (let r = 5; r < 9; r++) set(15.5 + Math.cos(an) * r, 14.5 + Math.sin(an) * r, MAT.gold[2]); } }
      break;
    }
    case "cap": case "nasal": case "closed": case "great": {
      const cx = 15.5, top = a.f === "great" ? 5 : 7, bottom = a.f === "cap" ? 21 : 26;
      const inH = (x, y) => {
        if (y < top || y > bottom) return false;
        if (a.f === "great") return Math.abs(x - cx) <= (y < top + 4 ? 6 + (y - top) * 1.4 : 11);
        const dome = Math.hypot((x - cx) / 11, (y - (top + 9)) / 9) <= 1;
        return y <= top + 9 ? dome : Math.abs(x - cx) <= 11 - Math.max(0, y - 22) * 0.6;
      };
      fillMask(inH, cx, 12, 12);
      // aba / borda
      for (let x = 4; x <= 27; x++) if (inH(x, top + 9)) { set(x, top + 9, TR[2]); set(x, top + 10, TR[1]); }
      if (a.f === "nasal") for (let y = top + 9; y <= 24; y++) { set(15, y, TR[3]); set(16, y, TR[1]); }
      if (a.f === "closed" || a.f === "great") {
        // viseira: fenda dos olhos (e cruz no do cruzado)
        for (let x = 8; x <= 23; x++) if (x < 14 || x > 17 || a.f === "great") { set(x, top + 12, OUTLINE); }
        if (a.f === "great" || a.cross) { for (let y = top + 12; y <= bottom - 2; y++) set(15.5, y, OUTLINE); }
        if (a.cross) for (let y = top + 1; y <= top + 9; y++) { set(15, y, MAT.gold[2]); set(16, y, MAT.gold[1]); }
        for (let i = 0; i < 4; i++) set(12 + i * 2, bottom - 3, M[0]);   // respiros
      }
      if (a.spikes) for (let x = 9; x <= 22; x += 4) { set(x, top - 1, M[2]); set(x, top - 2, M[3]); }
      if (a.horns) for (let i = 0; i < 7; i++) { set(4 - i * 0.3, top + 6 - i, MAT.holy[i < 3 ? 1 : 2]); set(5 - i * 0.3, top + 6 - i, MAT.holy[1]); set(27 + i * 0.3, top + 6 - i, MAT.holy[i < 3 ? 1 : 2]); set(26 + i * 0.3, top + 6 - i, MAT.holy[1]); }
      if (a.crown) for (let x = 7; x <= 24; x++) { set(x, top + 1, MAT.gold[3]); if (x % 4 === 3) { set(x, top, MAT.gold[3]); set(x, top - 1, MAT.gold[2]); set(x, top - 2, "#e03040"); } }
      if (a.wingsH) for (let i = 0; i < 6; i++) for (let j = 0; j <= i; j++) { set(3 + j, top + 3 + i - j, MAT.holy[2 + (j % 2)]); set(28 - j, top + 3 + i - j, MAT.holy[2 + (j % 2)]); }
      if (a.crest) for (let y = top - 4; y <= top + 4; y++) for (let x = 14; x <= 17; x++) if (Math.abs(x - 15.5) <= 1.5 - (y - top) * 0.1) set(x, y, (x + y) % 2 ? MAT.dragon[2] : MAT.dragon[3]);
      break;
    }
    case "armor": {
      const cx = 15.5;
      const inA = (x, y) => {
        if (y < 4 || y > 28) return false;
        const shoulder = y < 10 ? 13 - Math.max(0, 6 - y) * 0.6 : 0;
        const body = y >= 6 ? 9.5 - Math.max(0, y - 22) * 0.4 : 0;
        const neck = y < 8 && Math.abs(x - cx) < 3.5;
        return !neck && Math.abs(x - cx) <= Math.max(shoulder, body);
      };
      fillMask(inA, cx, 10, 13);
      // ombreiras e cintura no material do acabamento
      for (let y = 4; y <= 9; y++) for (let x = 0; x < 32; x++) if (inA(x, y) && Math.abs(x - cx) > 9) set(x, y, TR[(y < 6) ? 3 : 2]);
      for (let x = 0; x < 32; x++) if (inA(x, 22)) { set(x, 22, TR[1]); set(x, 23, TR[2]); }
      if (a.plates) for (const y of [12, 16, 19]) for (let x = 0; x < 32; x++) if (inA(x, y) && Math.abs(x - cx) <= 9) set(x, y, M[0]);
      if (a.stitch) for (let y = 8; y <= 21; y += 2) { set(cx - 0.5, y, M[0]); }
      if (a.cross) { for (let y = 10; y <= 20; y++) { set(15, y, MAT.royal[2]); set(16, y, MAT.royal[1]); } for (let x = 11; x <= 20; x++) set(x, 13, MAT.royal[2]); }
      if (a.rune) for (const [x, y] of [[12, 12], [19, 12], [15, 16], [16, 16], [12, 19], [19, 19]]) set(x, y, MAT.magic[3]);
      break;
    }
    case "legs": {
      const cx = 15.5;
      const inL = (x, y) => {
        if (y < 4 || y > 29) return false;
        if (y < 12) return Math.abs(x - cx) <= 9;
        const gap = 1 + (y - 12) * 0.12;
        const half = 9 - (y - 12) * 0.12;
        return Math.abs(x - cx) <= half && Math.abs(x - cx) >= gap;
      };
      fillMask(inL, cx, 10, 13);
      for (let x = 0; x < 32; x++) if (inL(x, 4)) { set(x, 4, TR[2]); set(x, 5, TR[3]); set(x, 6, TR[1]); }
      set(15, 5, MAT.gold[3]); set(16, 5, MAT.gold[2]);
      if (a.plates) for (const y of [14, 20, 25]) for (let x = 0; x < 32; x++) if (inL(x, y)) set(x, y, M[0]);
      if (a.plates) for (const sx of [-5, 5]) for (let y = 17; y <= 19; y++) for (let x = -1; x <= 1; x++) set(cx + sx + x, y, M[3]);   // joelheiras
      if (a.stitch) for (let y = 13; y <= 28; y += 2) { set(cx - 5, y, M[0]); set(cx + 5, y, M[0]); }
      if (a.rune) for (const [x, y] of [[10, 16], [21, 16], [10, 23], [21, 23]]) set(x, y, MAT.magic[3]);
      break;
    }
    case "boots": case "sandals": {
      // duas botas de perfil, lado a lado
      for (const ox of [2, 15]) {
        const inB = (x, y) => {
          const lx = x - ox;
          if (a.f === "sandals") return (y >= 25 && y <= 27 && lx >= 0 && lx <= 13);
          if (y < 6 || y > 27) return false;
          if (y < 20) return lx >= 2 && lx <= 8;
          return lx >= 1 && lx <= 13 - Math.max(0, 22 - y);
        };
        fillMask(inB, ox + 5, 12, 12);
        if (a.f === "sandals") {
          for (let y = 18; y <= 24; y++) { set(ox + 4, y, TR[2]); set(ox + 9 + (y - 18) * 0.3, y, TR[2]); }
          for (let x = ox + 3; x <= ox + 11; x++) { set(x, 20, TR[3]); set(x, 23, TR[1]); }
          for (let x = ox; x <= ox + 13; x++) set(x, 28, M[0]);
        } else {
          for (let x = ox + 2; x <= ox + 8; x++) { set(x, 6, TR[3]); set(x, 7, TR[2]); }   // boca do cano
          for (let x = ox + 1; x <= ox + 13; x++) { set(x, 27, M[0]); set(x, 28, OUTLINE); }   // sola
          if (a.plates) for (let y = 10; y <= 18; y += 4) for (let x = ox + 2; x <= ox + 8; x++) set(x, y, M[0]);
          if (a.m === "gold" || a.trim === "gold") { set(ox + 12, 24, MAT.gold[3]); }
        }
      }
      break;
    }
  }
  // contorno escuro de 1 px em volta da peça (como os ícones do Tibia)
  const out = P.slice();
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    if (get(x, y)) continue;
    if (get(x - 1, y) || get(x + 1, y) || get(x, y - 1) || get(x, y + 1)) out[y * 32 + x] = OUTLINE;
  }
  return out;
}
