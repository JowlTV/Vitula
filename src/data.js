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
    name: "Arqueiro", desc: "Patrulheiro das fronteiras: ataca de longe com arco longo e mantém distância.", trait: "Foco: enche ao acertar flechas e paga as habilidades.",
    stats: { maxHp: 100, armor: 0, recovery: 0, moveSpeed: 1.05, might: 1.0, cooldown: 1.0 },
    unlockCost: 0, portrait: "portrait_archer", anim: "ar_", scale: 0.40, ranged: 4, resource: "Foco", skill: "distance",
  },
  sorcerer: { name: "Feiticeiro", desc: "Frágil, mas domina o fogo, a energia e a morte.", trait: "Em breve.", unlockCost: 2500, portrait: "portrait_sorcerer", soon: true },
  druid: { name: "Druida", desc: "Comanda a terra e a natureza; se cura sozinho.", trait: "Em breve.", unlockCost: 2500, portrait: "portrait_druid", soon: true },
};

// posições no mapa de Karhyn (tela 960×540)
const REGIONS = {
  karhyn_sewers: { name: "Karhyn e seus Esgotos", town: true, desc: "Comece na Cidadela de Karhyn; desça ao esgoto pelo bueiro quando quiser. Túneis úmidos sob a cidade. Ratos e morcegos por toda parte.", pos: [505, 294], tier: 1, playable: true },
  goblin_slope: { name: "Encosta dos Goblins", desc: "A montanha a oeste da cidade, cheia de tocas de goblins.", pos: [117, 240], tier: 2, after: "karhyn_sewers" },
  orc_camp: { name: "Acampamento Orc", desc: "Paliçadas e fogueiras ao norte, no caminho da torre.", pos: [348, 138], tier: 3, after: "goblin_slope" },
  amazon_tower: { name: "Torre das Amazonas", desc: "A torre guardada por amazonas, valquírias e bruxas.", pos: [564, 66], tier: 4, after: "orc_camp" },
  ghostlands: { name: "Terras Espectrais", desc: "Campos mortos a leste, cobertos de teias. Espectros vagam pela névoa.", pos: [810, 183], tier: 5, after: "amazon_tower" },
  ghostlands_pit: { name: "Fosso Espectral", desc: "O buraco nas Terras Espectrais leva ao Ossuário, onde o chefe final espera.", pos: [822, 381], tier: 6, after: "ghostlands" },
};

// animações v2 dos monstros: [tamanho do quadro, andar, atacar, morrer, escala no mapa]
const MON_ANIM = {
  rat:       [70, "am_rat_walk_v2", "am_rat_attack", "am_rat_death", 0.6],
  bat:       [92, "am_bat_fly_v2", "am_bat_attack", "am_bat_death", 0.6],
  slime:     [100, "am_slime_walk_v2", "am_slime_attack", "am_slime_death", 0.5],
  skeleton:  [200, "am_skeleton_walk_v2", "am_skeleton_attack", "am_skeleton_death", 0.42],
  cave_rat:  [72, "am_cave_rat", "am_cave_rat_attack", "am_cave_rat_death", 0.7],
  giant_rat: [108, "am_giant_rat", "am_giant_rat_attack", "am_giant_rat_death", 0.85],
};
const MONSTERS = {
  // (força −25% em vida, dano e armadura) ritmo "Tibia clássico": no nível 1 um rato leva ~15–30 s de luta e cada mordida tira ~10% da vida.
  // arm = armadura (desconta de cada golpe do herói)
  rat:       { name: "Rato", tex: "m_rat", anim: "am_rat", hp: 165, arm: 2, dmg: 10, step: 0.5, atk: 2.2, xp: 14 },
  cave_rat:  { name: "Rato da Caverna", tex: "m_cave_rat", anim: "am_cave_rat", scale: 0.7, hp: 240, arm: 3, dmg: 12, step: 0.42, atk: 2.0, xp: 22 },
  bat:       { name: "Morcego", tex: "m_bat", anim: "am_bat", hp: 71, arm: 1, dmg: 6, step: 0.3, atk: 1.6, xp: 10, fly: true },
  slime:     { name: "Lodo", tex: "m_slime", anim: "am_slime", hp: 225, arm: 4, dmg: 11, step: 0.8, atk: 2.2, xp: 24 },
  skeleton:  { name: "Esqueleto", tex: "m_skeleton", anim: "am_skeleton", hp: 360, arm: 5, dmg: 15, step: 0.55, atk: 2.0, xp: 40 },
  giant_rat: { name: "Rato Gigante", tex: "m_giant_rat", anim: "am_giant_rat", scale: 0.85, hp: 1650, arm: 6, dmg: 18, step: 0.45, atk: 1.8, xp: 300, gold: 60, elite: true },
};

const FLOOR_MONSTERS = {
  1: [["rat", 70], ["bat", 30]],
  2: [["rat", 30], ["cave_rat", 30], ["bat", 20], ["slime", 20]],
  3: [["cave_rat", 35], ["skeleton", 25], ["slime", 20], ["bat", 20]],
  4: [["cave_rat", 35], ["skeleton", 35], ["slime", 15], ["bat", 15]],
  5: [["skeleton", 40], ["cave_rat", 35], ["slime", 15], ["bat", 10]],
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
  ["blue_gem", 8], ["red_gem", 3], ["bronze_key", 7], ["none", 22]];
const BREAKABLE = { barrel: 2, crate_intact: 2, pot: 1, urn: 1 };  // golpes para quebrar

// Skills de combate estilo Tibia: sobem devagar com o uso e ficam salvas por vocação.
const SKILLS = {
  sword:  { name: "Sword", start: 10, base: 30, growth: 1.12, desc: "base do dano corpo a corpo" },
  shield: { name: "Shield", start: 10, base: 24, growth: 1.12, desc: "defesa e chance de bloqueio" },
  distance: { name: "Distance", start: 10, base: 30, growth: 1.12, desc: "base do dano a distância" },
};
function skillTriesNeeded(id, lvl) { const s = SKILLS[id]; return Math.round(s.base * Math.pow(s.growth, lvl - s.start)); }

// Habilidades do Cavaleiro: liberadas por nível, pagas com Fúria (sem mana).
const FURY_MAX = 100;

// Magic level (como no Tibia): sobe gastando recurso em habilidades. Para o Cavaleiro o recurso é a Fúria.
// custo do nível n → n+1 = ML_BASE × mult^n  (Tibia: 1600 de mana × 3,0 knight / 1,4 archer / 1,1 mago)
const ML_BASE = 400;
const ML_MULT = { knight: 3.0, archer: 1.4, sorcerer: 1.1, druid: 1.1 };
const mlNeeded = (voc, lvl) => Math.round(ML_BASE * Math.pow(ML_MULT[voc] || 3, lvl));

// combate corpo a corpo no estilo Tibia: dano máx = 0,085 × ataque da arma × skill + nível / 5
const FIST_ATTACK = 20;  // ataque base até existirem armas

// Poções: 2 atalhos na barra (teclas 5 e 6). voc = vocações que podem usar (vazio = todas).
const POTIONS = {
  health:    { name: "Poção de vida", icon: "i_health_potion", cd: 10, price: 30, desc: "Cura 40% da vida máxima." },
  fury:      { name: "Poção de fúria", icon: "i_health_potion", tint: 0xff8a30, cd: 15, price: 45, desc: "Enche toda a Fúria (ou o Foco do Arqueiro).", voc: ["knight", "archer"] },
  mana:      { name: "Poção de mana", icon: "i_mana_potion", cd: 10, price: 30, desc: "Recupera 60% da mana máxima.", voc: ["archer", "sorcerer", "druid"] },
  berserker: { name: "Poção do berserker", icon: "i_health_potion", tint: 0xc02020, cd: 60, dur: 30, price: 160, desc: "+10 de Sword por 30 s." },
  mage:      { name: "Poção do mago", icon: "i_mana_potion", tint: 0xb070ff, cd: 60, dur: 30, price: 160, desc: "+10 de magic level por 30 s." },
  hunter:    { name: "Poção do caçador", icon: "i_health_potion", tint: 0x70d070, cd: 60, dur: 30, price: 160, desc: "+10 de Distance por 30 s.", voc: ["archer"] },
  luck:      { name: "Poção da sorte", icon: "i_health_potion", tint: 0xffd040, cd: 300, dur: 10, price: 200, desc: "+50% de ouro coletado por 10 s." },
};
const potionOk = (id, voc) => !POTIONS[id].voc || POTIONS[id].voc.includes(voc);

// promoção (como no Tibia): no nível 20 o Cavaleiro vira Elite Knight
const PROMOTION = { knight: { level: 20, name: "Elite Knight", regenMult: 3, dmgMult: 1.15 },
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
  front: { name: "Golpe Frontal", key: "1", icon: "icon_front_v2", level: 3, fury: 25, cd: 2.5, desc: "Um corte que avança pelas 3 casas à frente." },
  heal:  { name: "Exura", key: "2", icon: "icon_exura", level: 6, fury: 30, cd: 6, desc: "Cura 15% da vida máxima + 1% por magic level." },
  spin:  { name: "Golpe em Área", key: "3", icon: "icon_area", level: 10, fury: 40, cd: 4, desc: "Crava a espada no chão: atinge as 8 casas em volta e faz sangrar 5% da vida máxima por segundo durante 3 s." },
  aura:  { name: "Aura Sagrada", key: "4", icon: "icon_aura_v2", level: 18, fury: 60, cd: 12, dur: 5, desc: "Por 5 s: fere quem chega perto, regenera vida e ilumina uma área maior." },
};

function weighted(table) {
  let total = 0; for (const e of table) total += e[1];
  let r = Math.random() * total;
  for (const e of table) { r -= e[1]; if (r < 0) return e[0]; }
  return table[0][0];
}

// Morte: quanto se perde conforme o número de bênçãos de Magdha (0 a 3)
const DEATH_LOSS = [
  { xp: 0.80, equip: 1.00, gold: 0.25 },
  { xp: 0.60, equip: 0.75, gold: 0.20 },
  { xp: 0.35, equip: 0.35, gold: 0.10 },
  { xp: 0.20, equip: 0.00, gold: 0.00 },
];
const BLESS_TEXT = [
  "Você recebeu a primeira bênção de Magdha.\n\nNa próxima morte, perderá 60% da experiência, 75% dos equipamentos e 20% do ouro coletado (em vez de 80%, 100% e 25%).",
  "Você recebeu a segunda bênção de Magdha.\n\nNa próxima morte, perderá 35% da experiência, 35% dos equipamentos e 10% do ouro coletado.",
  "Você recebeu a terceira bênção de Magdha.\n\nNa próxima morte, perderá 20% da experiência, nenhum equipamento e nenhum ouro.",
];

// Habilidades do Arqueiro (mesmas teclas 1–4; pagas com Foco).
const ARCHER_SPELLS = {
  pierce: { name: "Flecha Perfurante", key: "1", icon: "icon_front_v2", level: 3, fury: 25, cd: 2.5, desc: "Uma flecha que atravessa todos os inimigos em linha reta por 5 casas." },
  heal:   { name: "Exura", key: "2", icon: "icon_exura", level: 6, fury: 30, cd: 6, desc: "Cura 15% da vida máxima + 1% por magic level." },
  rain:   { name: "Chuva de Flechas", key: "3", icon: "icon_area", level: 10, fury: 40, cd: 4, desc: "Uma saraivada cai sobre o alvo e as 8 casas em volta." },
  eagle:  { name: "Olho de Águia", key: "4", icon: "icon_aura_v2", level: 18, fury: 60, cd: 12, dur: 6, desc: "Por 6 s: atira duas vezes mais rápido e com +2 casas de alcance." },
};
const vocSpells = voc => (voc === "archer" ? ARCHER_SPELLS : SPELLS);
const vocAnim = voc => (VOCATIONS[voc] && VOCATIONS[voc].anim) || "kn_";
const vocScale = voc => (VOCATIONS[voc] && VOCATIONS[voc].scale) || 0.42;
