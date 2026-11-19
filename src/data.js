// Vitula — dados do jogo (tudo que é número de balanceamento mora aqui).
const T = 64;            // tamanho do tile (grade do mapa; 960×540 interno = 15×8,4 tiles visíveis)
const VIEW_W = 960, VIEW_H = 540;
const FLOORS = 5;

// O canvas é 1920×1080 (texto e interface nítidos); cada cena desenha em coordenadas 960×540
// e a câmera amplia 2× em número inteiro — o pixel art continua com pixels quadrados.
function zoom2(cam) { cam.setZoom(2); cam.centerOn(VIEW_W / 2, VIEW_H / 2); return cam; }

const COLORS = {
  gold: "#e0bc60", text: "#e8dcc0", dim: "#9a8f80", crim: "#8e2a2c", soul: "#5aa0d8",
  heal: "#8fe08a", hurt: "#e05a4a", white: "#f2e6d8",
};

const VOCATIONS = {
  knight: {
    name: "Cavaleiro", desc: "Resistente e brutal no corpo a corpo.", trait: "Fúria: enche ao golpear e ao apanhar, e paga as habilidades.",
    stats: { maxHp: 130, armor: 1, recovery: 0, moveSpeed: 1.0, might: 1.0, cooldown: 1.0 },
    // passiva da vocação: regenera 2% da vida máxima a cada 5 s
    passive: { name: "Alma de guerreiro", desc: "Regenera 2% da vida máxima a cada 5 s.", regenPct: 0.02, every: 5 },
    unlockCost: 0, portrait: "portrait_knight",
  },
  archer: {
    name: "Arqueiro", desc: "Patrulheiro das fronteiras: ataca de longe com o arco.", trait: "Mana: regenera com o tempo e paga as habilidades.",
    stats: { maxHp: 100, armor: 0, recovery: 0, moveSpeed: 1.05, might: 1.0, cooldown: 1.0 },
    unlockCost: 0, portrait: "portrait_archer", anim: "ar_", scale: 0.40, ranged: 4, resource: "Mana", mana: true, skill: "distance",
  },
  sorcerer: { name: "Feiticeiro", desc: "Frágil, mas domina o fogo, a energia e a morte.", trait: "Em breve.", unlockCost: 2500, portrait: "portrait_sorcerer", soon: true },
  druid: { name: "Druida", desc: "Comanda a terra e a natureza; se cura sozinho.", trait: "Em breve.", unlockCost: 2500, portrait: "portrait_druid", soon: true },
};

// posições no mapa de Karhyn (tela 960×540)
const REGIONS = {
  karhyn_sewers: { name: "Karhyn e seus Esgotos", town: true, desc: "Comece na Cidadela de Karhyn; desça ao esgoto pelo bueiro quando quiser. Túneis úmidos sob a cidade. Ratos e morcegos por toda parte.", pos: [505, 294], tier: 1, playable: true },
  goblin_slope: { name: "Encosta dos Goblins", desc: "A montanha a oeste da cidade, cheia de tocas de goblins. Oito andares de trilhas e tocas até o acampamento do Líder Goblin.", pos: [117, 240], tier: 2, after: "karhyn_sewers", playable: true, floors: 8, cave: true, theme: "slope", boss: "goblin_leader", escort: "goblin" },
  orc_camp: { name: "Acampamento Orc", desc: "Paliçadas e fogueiras ao norte, no caminho da torre.", pos: [348, 138], tier: 3, after: "goblin_slope" },
  amazon_tower: { name: "Torre das Amazonas", desc: "A torre guardada por amazonas, valquírias e bruxas.", pos: [564, 66], tier: 4, after: "orc_camp" },
  ghostlands: { name: "Terras Espectrais", desc: "Campos mortos a leste, cobertos de teias. Espectros vagam pela névoa.", pos: [810, 183], tier: 5, after: "amazon_tower" },
  ghostlands_pit: { name: "Fosso Espectral", desc: "O buraco nas Terras Espectrais leva ao Ossuário, onde o chefe final espera.", pos: [822, 381], tier: 6, after: "ghostlands" },
};

// animações v2 dos monstros: [tamanho do quadro, andar, atacar, morrer, escala no mapa]
const SPIDER_FW = 198;   // quadro das animações da aranha (SpriteCook, 8 quadros)
const MON_ANIM = {
  rat:       [70, "am_rat_walk_v2", "am_rat_attack", "am_rat_death", 0.6],
  bat:       [92, "am_bat_fly_v2", "am_bat_attack", "am_bat_death", 0.6],
  slime:     [100, "am_slime_walk_v2", "am_slime_attack", "am_slime_death", 0.5],
  skeleton:  [200, "am_skeleton_walk_v2", "am_skeleton_attack", "am_skeleton_death", 0.42],
  cave_rat:  [72, "am_cave_rat", "am_cave_rat_attack", "am_cave_rat_death", 0.7],
  giant_rat: [108, "am_giant_rat", "am_giant_rat_attack", "am_giant_rat_death", 0.85],
  // Encosta dos Goblins (SpriteCook, 8 quadros, de perfil olhando para a direita)
  goblin:           [50, "am_goblin", "am_goblin_attack", "am_goblin_death", 1.2],
  goblin_scavenger: [50, "am_goblin_scavenger", "am_goblin_scavenger_attack", "am_goblin_scavenger_death", 1.25],
  goblin_assassin:  [50, "am_goblin_assassin", "am_goblin_assassin_attack", "am_goblin_assassin_death", 1.25],
  goblin_leader:    [68, "am_goblin_leader", "am_goblin_leader_attack", "am_goblin_leader_death", 1.3],
  spider:        [SPIDER_FW, "am_spider_walk", "am_spider_attack", "am_spider_death", 0.32],
  poison_spider: [SPIDER_FW, "am_spider_walk", "am_spider_attack", "am_spider_death", 0.34],
  giant_spider: [SPIDER_FW, "am_spider_walk", "am_spider_attack", "am_spider_death", 0.34],
};
const MONSTERS = {
  // (força −25% em vida, dano e armadura) ritmo "Tibia clássico": no nível 1 um rato leva ~15–30 s de luta e cada mordida tira ~10% da vida.
  // −10% em vida, dano e armadura (nov/26); ratos 15% mais lentos (o Rato Gigante ficou de fora: 2500 de vida, 50 de dano)
  // arm = armadura (desconta de cada golpe do herói)
  rat:       { name: "Rato", tex: "m_rat", anim: "am_rat", hp: 148, arm: 1.8, dmg: 9, step: 0.59, atk: 2.2, xp: 14 },
  cave_rat:  { name: "Rato da Caverna", plural: "Ratos da Caverna", tex: "m_cave_rat", anim: "am_cave_rat", scale: 0.7, hp: 216, arm: 2.7, dmg: 10.8, step: 0.49, atk: 2.0, xp: 22 },
  bat:       { name: "Morcego", tex: "m_bat", anim: "am_bat", hp: 64, arm: 0.9, dmg: 5.4, step: 0.3, atk: 1.6, xp: 10, fly: true },
  slime:     { name: "Lodo", tex: "m_slime", anim: "am_slime", hp: 202, arm: 3.6, dmg: 9.9, step: 0.8, atk: 2.2, xp: 24 },
  skeleton:  { name: "Esqueleto", tex: "m_skeleton", anim: "am_skeleton", hp: 324, arm: 4.5, dmg: 13.5, step: 0.55, atk: 2.0, xp: 40 },
  // aranhas do esgoto (a partir do 2º andar). A venenosa usa a mesma arte, esverdeada, e envenena: 3% da vida máx./s por 5 s
  spider:        { name: "Aranha", tex: "am_spider_walk", hp: 175, arm: 2, dmg: 11, step: 0.36, atk: 1.9, xp: 26 },
  poison_spider: { name: "Aranha Venenosa", plural: "Aranhas Venenosas", tex: "am_spider_walk", tint: 0x9fe07a, hp: 205, arm: 2.5, dmg: 9, step: 0.4, atk: 2.0, xp: 34, poison: { pct: 0.03, dur: 5 } },
  giant_spider: { name: "Aranha Gigante", plural: "Aranhas Gigantes", tex: "am_spider_walk", tint: 0x6fb04a, hp: 205 * 15, arm: 4, dmg: 9 * 10, step: 0.275, atk: 1.6, xp: 600, gold: 80, elite: true, poison: { pct: 0.04, dur: 5 } },   // primeira caverna (esgoto 3): sempre com fome
  // Encosta dos Goblins: mais fortes que o fundo do esgoto (andar 5 ≈ esqueleto com 1,6× de vida)
  goblin:           { name: "Goblin", tex: "am_goblin", hp: 538, arm: 5, dmg: 33, step: 0.5, atk: 1.9, xp: 52 },
  goblin_scavenger: { name: "Goblin Saqueador", plural: "Goblins Saqueadores", tex: "am_goblin_scavenger", hp: 650, arm: 6, dmg: 30, step: 0.56, atk: 2.1, xp: 60, gold: 4 },
  goblin_assassin:  { name: "Goblin Assassino", plural: "Goblins Assassinos", tex: "am_goblin_assassin", hp: 450, arm: 4, dmg: 44, step: 0.36, atk: 1.5, xp: 66 },
  goblin_leader:    { name: "Líder Goblin", plural: "Líderes Goblins", tex: "am_goblin_leader", hp: 12150, arm: 12, dmg: 203, step: 0.42, atk: 1.7, xp: 1400, gold: 250, elite: true },
  giant_rat: { name: "Rato Gigante", plural: "Ratos Gigantes", tex: "m_giant_rat", anim: "am_giant_rat", scale: 0.85, hp: 2500, arm: 6, dmg: 50, step: 0.45, atk: 1.8, xp: 300, gold: 60, elite: true },
};

const FLOOR_MONSTERS = {
  1: [["rat", 70], ["bat", 30]],
  2: [["rat", 25], ["cave_rat", 25], ["bat", 15], ["slime", 15], ["spider", 14], ["poison_spider", 6]],
  3: [["cave_rat", 28], ["skeleton", 20], ["slime", 15], ["bat", 12], ["spider", 15], ["poison_spider", 10]],
  4: [["cave_rat", 28], ["skeleton", 28], ["slime", 10], ["bat", 10], ["spider", 12], ["poison_spider", 12]],
  5: [["skeleton", 32], ["cave_rat", 28], ["slime", 10], ["bat", 8], ["spider", 10], ["poison_spider", 12]],
};
// monstros por andar de cada região (o esgoto usa FLOOR_MONSTERS)
const REGION_MONSTERS = {
  goblin_slope: {
    1: [["goblin", 70], ["bat", 20], ["goblin_scavenger", 10]],
    2: [["goblin", 55], ["goblin_scavenger", 30], ["bat", 15]],
    3: [["goblin", 45], ["goblin_scavenger", 35], ["goblin_assassin", 10], ["spider", 10]],
    4: [["goblin", 40], ["goblin_scavenger", 30], ["goblin_assassin", 20], ["spider", 10]],
    5: [["goblin", 35], ["goblin_scavenger", 30], ["goblin_assassin", 25], ["poison_spider", 10]],
    6: [["goblin", 30], ["goblin_scavenger", 30], ["goblin_assassin", 30], ["poison_spider", 10]],
    7: [["goblin", 30], ["goblin_scavenger", 30], ["goblin_assassin", 40]],
    8: [["goblin", 35], ["goblin_scavenger", 30], ["goblin_assassin", 35]],
  },
};

const ITEMS = {
  gold:          { icon: "i_gold_coin", name: "moedas de ouro" },
  silver:        { icon: "i_silver_coin", name: "moedas de prata" },
  apple:         { icon: "i_apple", name: "maçã", heal: 10 },
  bread:         { icon: "i_bread", name: "pão", heal: 18 },
  meat:          { icon: "i_meat", name: "carne", heal: 32 },
  health_potion: { icon: "i_health_potion", name: "poção de vida", healPct: 0.5 },
  blue_gem:      { icon: "i_blue_gem", name: "gema da alma", xp: 18 },
  red_gem:       { icon: "i_red_gem", name: "rubi", gold: 30 },
  bronze_key:    { icon: "i_bronze_key", name: "chave de bronze" },
  scroll:        { icon: "i_scroll", name: "pergaminho antigo" },
};
const LOOT = [["gold", 34], ["silver", 20], ["apple", 9], ["bread", 7], ["meat", 9],
  ["blue_gem", 8], ["red_gem", 3], ["none", 29]];   // (nov/26) chaves de bronze e baús trancados saíram do jogo
const BREAKABLE = { barrel: 2, crate_intact: 2, pot: 1, urn: 1 };  // golpes para quebrar

// Skills de combate estilo Tibia: sobem devagar com o uso e ficam salvas por vocação.
const SKILLS = {
  sword:  { name: "Sword", start: 10, base: 30, growth: 1.12, desc: "base do dano corpo a corpo" },
  shield: { name: "Shield", start: 10, base: 24, growth: 1.12, desc: "defesa e chance de bloqueio" },
  distance: { name: "Distance", start: 10, base: 30, growth: 1.12, desc: "base do dano a distância" },
  dodge:  { name: "Dodge", start: 10, base: 24, growth: 1.12, desc: "chance de esquivar (Arqueiro, que não usa escudo)" },
};
// Pontos de atributo: 1 por nível ganho, para gastar onde quiser (janela de Atributos, tecla U).
// "weapon" vira Sword no Cavaleiro e Distance no Arqueiro.
const ATTRS = {
  str:    { name: "Força",                desc: "+2% de dano de ataque",        show: n => `+${n * 2}% de dano` },
  vit:    { name: "Vitalidade",           desc: "+25 de vida total",            show: n => `+${n * 25} de vida` },
  crit:   { name: "Chance crítica",       desc: "+0,5% de chance de crítico",   show: n => `${(10 + n * 0.5).toFixed(1).replace(".", ",")}%` },
  block:  { name: "Chance de bloqueio",   desc: "+0,5% de chance de bloquear",  show: n => `+${(n * 0.5).toFixed(1).replace(".", ",")}%` },
  armor:  { name: "Armadura",             desc: "+0,5 de defesa",               show: n => `+${(n * 0.5).toFixed(1).replace(".", ",")} de defesa` },
  aspd:   { name: "Velocidade de ataque", desc: "+0,25% de velocidade de ataque", show: n => `+${(n * 0.25).toFixed(2).replace(".", ",")}%` },
  hpreg:  { name: "Regeneração de vida",  desc: "+0,5 de vida por segundo",     show: n => `+${(n * 0.5).toFixed(1).replace(".", ",")} vida/s` },
  mpreg:  { name: "Regeneração de mana",  desc: "+0,5 de mana por segundo (Fúria: só em combate)", show: n => `+${(n * 0.5).toFixed(1).replace(".", ",")} /s` },
};
function skillTriesNeeded(id, lvl) { const s = SKILLS[id]; return Math.round(s.base * Math.pow(s.growth, lvl - s.start)); }

// Habilidades do Cavaleiro: liberadas por nível, pagas com Fúria (sem mana).
const FURY_MAX = 100;

// Magic level (como no Tibia): sobe gastando recurso em habilidades. Para o Cavaleiro o recurso é a Fúria.
// custo do nível n → n+1 = ML_BASE × mult^n  (Tibia: 1600 de mana × 3,0 knight / 1,4 archer / 1,1 mago)
const ML_BASE = 400;
const ML_MULT = { knight: 3.0, archer: 1.4, sorcerer: 1.1, druid: 1.1 };
// Arqueiro começa no magic level 5 e sobe rápido até o 10 (80, 120, 160, 200, 240 de mana gasta)
const mlNeeded = (voc, lvl) => voc === "archer" && lvl < 10 ? 80 + 40 * Math.max(0, lvl - 5) : Math.round(ML_BASE * Math.pow(ML_MULT[voc] || 3, lvl));

// combate corpo a corpo no estilo Tibia: dano máx = 0,085 × ataque da arma × skill + nível / 5
const FIST_ATTACK = 20;  // ataque do punho (sem arma); o arqueiro usa sempre este valor

// Poções: 2 atalhos na barra (teclas 5 e 6). voc = vocações que podem usar (vazio = todas).
const POTIONS = {
  health:    { name: "Poção de vida", icon: "i_health_potion", cd: 10, price: 30, desc: "Cura 40% da vida máxima." },
  fury:      { name: "Poção de fúria", icon: "i_health_potion", tint: 0xff8a30, cd: 15, price: 45, desc: "Enche toda a Fúria (ou a Mana do Arqueiro).", voc: ["knight", "archer"] },
  mana:      { name: "Poção de mana", icon: "i_mana_potion", cd: 10, price: 30, desc: "Recupera 60% da mana máxima.", voc: ["archer", "sorcerer", "druid"] },
  berserker: { name: "Poção do berserker", icon: "i_health_potion", tint: 0xc02020, cd: 60, dur: 30, price: 160, desc: "+10 de Sword por 30 s." },
  mage:      { name: "Poção do mago", icon: "i_mana_potion", tint: 0xb070ff, cd: 60, dur: 30, price: 160, desc: "+10 de magic level por 30 s." },
  hunter:    { name: "Poção do caçador", icon: "i_health_potion", tint: 0x70d070, cd: 60, dur: 30, price: 160, desc: "+10 de Distance por 30 s.", voc: ["archer"] },
  luck:      { name: "Poção da sorte", icon: "i_health_potion", tint: 0xffd040, cd: 300, dur: 10, price: 200, desc: "+50% de ouro coletado por 10 s." },
};
const POTION_FILL = 600;   // vida somada dos monstros derrotados para encher 1 poção de vida
const POT_CD = 5;   // poções de carga única: enchem matando monstros, 5 s de recarga
const potSlotId = (voc, slot) => slot === 0 ? "health" : (VOCATIONS[voc] && VOCATIONS[voc].mana ? "mana" : "fury");
function potCharge(d, slot) { d.charges = d.charges || [0, 0]; return d.charges[slot] || 0; }
const potionOk = (id, voc) => !POTIONS[id].voc || POTIONS[id].voc.includes(voc);

// promoção (como no Tibia): no nível 20 o Cavaleiro vira Cavaleiro de Elite
const PROMOTION = { knight: { level: 20, name: "Cavaleiro de Elite", regenMult: 3, dmgMult: 1.15 },
  archer: { level: 20, name: "Patrulheiro Real", regenMult: 1, dmgMult: 1.15 } };

// Loja de atributos (ouro da vocação). Cada compra sobe 1 nível; o preço cresce a cada nível.
const SHOP = {
  hp:     { name: "Vida",               desc: n => `+${n * 10} de vida máxima`,             max: 10, base: 60,  grow: 1.55, icon: "heart" },
  atkspd: { name: "Velocidade de ataque", desc: n => `ataques ${n * 5}% mais rápidos`,      max: 8,  base: 90,  grow: 1.6,  icon: "i_sword" },
  armor:  { name: "Armadura",           desc: n => `+${n} de armadura`,                      max: 8,  base: 80,  grow: 1.6,  icon: "i_shield" },
  fury:   { name: "Fúria máxima",       desc: n => `+${n * 10} de fúria máxima`,             max: 5,  base: 100, grow: 1.7,  icon: "icon_berserk" },
};
const shopCost = (id, lvl) => Math.round(SHOP[id].base * Math.pow(SHOP[id].grow, lvl) / 5) * 5;
const SPELLS = {
  heal:  { name: "Exura", key: "G", icon: "icon_exura", level: 1, fury: 0, cd: 6, desc: "Magia global, sem custo: cura 25% da vida máxima." },
  front: { name: "Golpe Frontal", key: "1", icon: "icon_front_v2", level: 1, fury: 25, cd: 2.5, desc: "Um corte à frente que acerta até 2 inimigos em linha." },
  quake: { name: "Tremor de Terra", key: "2", icon: "icon_area", level: 6, fury: 40, cd: 7, dur: 3, desc: "Crava a espada no chão: o tremor se espalha por 2 casas em volta, causa 3× o dano ao longo de 2 s (50% a mais que o Golpe Frontal) e deixa os inimigos lentos (−50%) por 3 s." },
  guard: { name: "Égide", key: "3", icon: "i_shield", level: 10, fury: 45, cd: 14, dur: 6, desc: "Por 6 s: uma aura protetora dá +54% de defesa e devolve 10% do dano recebido a quem atacou." },
  aura:  { name: "Aura Sagrada", key: "4", icon: "icon_aura_v2", level: 16, fury: 60, cd: 12, dur: 5, desc: "Por 5 s: fere quem chega perto, regenera vida e ilumina uma área maior." },
  slasher: { name: "Slasher", key: "5", icon: "icon_front_v2", level: 20, fury: 40, cd: 7, desc: "Um grande corte único à frente (3 casas): 120% a mais que o Golpe Frontal, sempre crítico, com +15% de dano crítico." },
  kberserk: { name: "Modo Berserker", key: "6", icon: "berserk", level: 24, fury: 60, cd: 20, dur: 8, desc: "Por 8 s, uma aura vermelha: +40% de dano em tudo, cada golpe cura 25% do dano base e o ataque básico acerta os 3 primeiros inimigos à frente." },
  xcut:  { name: "Corte em X", key: "7", icon: "icon_area", level: 28, fury: 50, cd: 10, desc: "Um corte em cruz à frente: 180% do dano do Golpe Frontal e sangramento de 30% da vida atual do monstro em 5 s (10% em chefes)." },
};

function weighted(table) {
  let total = 0; for (const e of table) total += e[1];
  let r = Math.random() * total;
  for (const e of table) { r -= e[1]; if (r < 0) return e[0]; }
  return table[0][0];
}

// Morte: quanto se perde conforme o número de bênçãos da Oráculo (0 a 3)
const DEATH_LOSS = [
  { xp: 0.80, equip: 1.00, gold: 0.25 },
  { xp: 0.60, equip: 0.75, gold: 0.20 },
  { xp: 0.35, equip: 0.35, gold: 0.10 },
  { xp: 0.20, equip: 0.00, gold: 0.00 },
];
const BLESS_TEXT = [
  "Você recebeu a primeira bênção da Oráculo.\n\nNa próxima morte, perderá 60% da experiência, 75% dos equipamentos e 20% do ouro coletado (em vez de 80%, 100% e 25%).",
  "Você recebeu a segunda bênção da Oráculo.\n\nNa próxima morte, perderá 35% da experiência, 35% dos equipamentos e 10% do ouro coletado.",
  "Você recebeu a terceira bênção da Oráculo.\n\nNa próxima morte, perderá 20% da experiência, nenhum equipamento e nenhum ouro.",
];

// Habilidades do Arqueiro (mesmas teclas 1–4; pagas com Mana).
const ARCHER_SPELLS = {
  heal:   { name: "Exura", key: "G", icon: "icon_exura", level: 1, fury: 0, cd: 6, desc: "Magia global, sem custo: cura (10 + 6 por magic level) × 85%." },
  holy:   { name: "Flecha Sagrada", key: "1", icon: "icon_front_v2", level: 1, fury: 25, cd: 2.5, desc: "Uma flecha de luz sagrada que acerta o alvo escolhido com 2× o dano." },
  missile: { name: "Míssil Sagrado", key: "2", icon: "icon_front_v2", level: 6, fury: 35, cd: 5, desc: "Uma grande flecha de luz em linha reta: atravessa até 3 monstros, empurra-os 1 casa e causa 80% a mais que a Flecha Sagrada." },
  volley: { name: "Saraivada", key: "3", icon: "icon_area", level: 10, fury: 40, cd: 8, dur: 3, desc: "Uma chuva de flechas na área do alvo (3×3): dano e marca os inimigos, que ficam lentos (−50%) por 3 s." },
  frenzy: { name: "Berserker", key: "4", icon: "berserk", level: 16, fury: 50, cd: 16, dur: 5, desc: "Por 5 s: +60% de dano de ataque e +15% de crítico; a flecha do ataque básico ricocheteia em até 3 inimigos e explode em luz sagrada." },
  flee:   { name: "Aura do Vento", key: "5", icon: "spear", level: 12, fury: 30, cd: 12, dur: 4, desc: "Por 4 s: uma aura de energia contorna o arqueiro: +40% de velocidade, +40% de velocidade de ataque e atravessa os monstros." },
  farsight: { name: "Visão Além do Alcance", key: "6", icon: "icon_aura_v2", level: 20, fury: 45, cd: 22, dur: 10, desc: "Por 10 s: alcance máximo e flechas básicas sagradas. A cada 3 acertos no mesmo monstro, a marca explode: ele perde 50% de todo o dano que recebeu nesse tempo como dano verdadeiro." },
  barrier: { name: "Barreira de Luz", key: "7", icon: "i_shield", level: 24, fury: 40, cd: 18, dur: 7, desc: "Ergue uma barreira de luz de 3 casas à frente por 7 s: suas flechas atravessam, os monstros não passam." },
};
const vocSpells = voc => (voc === "archer" ? ARCHER_SPELLS : SPELLS);
const vocAnim = voc => (VOCATIONS[voc] && VOCATIONS[voc].anim) || "kn_";
// Escala do mundo: a casa tem 64 px e uma porta ocupa uma casa; personagens e criaturas ficam ~0,9 casa de altura
// (antes ~1,25 casa: o herói passava da altura das portas e paredes).
const WORLD_SCALE = 0.78;
// altura alvo (px) de cada objeto da masmorra, em proporção ao herói (~60 px de corpo)
const PROP_H = { forest_bush: 46, forest_stump: 44, forest_mushrooms: 30, forest_log: 32, forest_deadtree: 86, forest_sign: 52, decor_rat_nest: 44, slope_burrow: 72, slope_tent: 92, slope_totem: 84, slope_campfire: 44, slope_barricade: 50, slope_palisade: 56, slope_weapon_rack: 52, slope_stakes: 40, slope_cairn: 40, barrel: 40, crate_intact: 32, crate_damaged: 32, chest_closed: 28, chest_open: 28, pot: 27, urn: 36, torch_stand: 62, pillar: 92 };
const vocScale = voc => ((VOCATIONS[voc] && VOCATIONS[voc].scale) || 0.42) * WORLD_SCALE * 1.12 * 1.05;   // heróis 12% maiores (nov/26) e mais 5%

// sombra de contato: elipse escura colada na base de um sprite (origem 0.5,1), some junto com ele
function groundShadow(scene, spr, container, wf = 0.85, alpha = 1) {
  // a sombra fica dentro da pegada (acima da base), senão o objeto parece apoiado à frente dela
  const w = spr.displayWidth * wf, hh = Math.max(Math.min(w * 0.24, 46), 8);
  // objetos altos em 3/4 (barraca, banco, mesa): a base fica um pouco acima da borda de baixo da imagem
  const sh = scene.add.image(spr.x, spr.y - Math.max(hh * 0.42, Math.min(spr.displayHeight * 0.12, 18)), "shadow").setScale(w / 64, hh / 64).setAlpha(alpha).setDepth(spr.depth - 1);
  if (container) container.addAt ? container.addAt(sh, Math.max(0, container.getIndex(spr))) : container.add(sh);
  spr.once("destroy", () => sh.destroy());
  return sh;
}
