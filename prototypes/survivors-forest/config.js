// Protótipo survivors-like do Vitula na Rook Forest. TODOS os números de ajuste ficam aqui (o balance-check lê este arquivo).
// Unidade de distância: px do mundo (1 casa do Vitula = 64 px). Tempo em segundos.
const CFG = {
  run: { length: 600, bossAt: 480 },                 // partida de 10 min; o Rato Gigante chega aos 8 min
  hero: {
    knight: { hp: 160, speed: 150, regen: 0.4, pickup: 90, armor: 2 },   // vida/regen de Cavaleiro (Vitula: 150 + Alma de guerreiro)
    archer: { hp: 115, speed: 165, regen: 0.2, pickup: 100, armor: 0 },
    iframes: 0.35,                                    // invencível por um instante depois de apanhar
  },
  // monstros: vida e dano vêm do Vitula (data.js) multiplicados aqui; velocidade em px/s
  monsters: {
    rat:       { hp: 148, dmg: 9,   speed: 62,  xp: 1, scale: 0.6 },
    bat:       { hp: 64,  dmg: 5.4, speed: 92,  xp: 1, scale: 0.6 },
    cave_rat:  { hp: 216, dmg: 10,  speed: 68,  xp: 2, scale: 0.6 },
    giant_rat: { hp: 2500, dmg: 22, speed: 70,  xp: 50, scale: 1.4 },
  },
  hpMult: 0.12,          // vida dos monstros × este valor (no Vitula um rato aguenta ~9 golpes; aqui 1–2)
  hpGrowth: 0.006,       // +0,6% de vida dos monstros por segundo de partida (aos 5 min: ×2,8)
  dmgMult: 1.0,
  dmgGrowth: 0.0015,     // +0,15% de dano dos monstros por segundo (aos 9 min: ×1,8; antes era ×3,2)
  bossHpMult: 4.5,       // o chefe ignora hpMult; usa a vida dele × isto × (1 + hpGrowth·t)/4
  spawn: {
    base: 0.8,           // monstros por segundo no começo
    perMin: 1.3,         // +1,3 monstro/s a cada minuto
    cap: 220,            // máximo na tela
    mix: [[0, [["rat", 70], ["bat", 30]]], [180, [["rat", 50], ["bat", 30], ["cave_rat", 20]]], [360, [["rat", 35], ["bat", 25], ["cave_rat", 40]]]],
    ringMin: 560, ringMax: 680,   // distância do herói onde nascem (fora da tela)
    waveEvery: 60, waveSize: 24,  // a cada minuto, um círculo de monstros fecha em volta
  },
  xp: { first: 5, step: 4.2, power: 1.12, gemMerge: 300 },   // nível n pede first + step·(n−1)^power gemas
  // armas: as habilidades do Vitula disparando sozinhas. dmg = dano por golpe no nível 1 da arma.
  weapons: {
    // Cavaleiro
    slash:   { name: "Corte", icon: "icon_slash", voc: "knight", cd: 1.0, dmg: 30, range: 110, arc: 1.4, fx: "fx_basic_slash" },
    front:   { name: "Golpe Frontal", icon: "icon_front_v2", voc: "knight", cd: 2.2, dmg: 40, range: 230, width: 70, fx: "fx_front_cut" },
    quake:   { name: "Terremoto", icon: "icon_area", voc: "knight", cd: 5.0, dmg: 34, radius: 170, fx: "fx_ring_wave" },
    aura:    { name: "Aura Sagrada", icon: "icon_aura_v2", voc: "knight", cd: 0.5, dmg: 9, radius: 95, fx: "aura" },
    // Arqueiro
    arrow:   { name: "Flecha", icon: "icon_basic", voc: "archer", cd: 1.0, dmg: 18, speed: 640, pierce: 1, fx: "pfx_arrow" },
    holy:    { name: "Flecha Sagrada", icon: "icon_exura", voc: "archer", cd: 2.0, dmg: 55, speed: 400, pierce: 1,   /* atravessa: nível 1 acerta 2 inimigos, +1 por nível */ fx: "fx_holy_arrow" },
    volley:  { name: "Saraivada", icon: "icon_area", voc: "archer", cd: 5.0, dmg: 17, radius: 120, hits: 3, fx: "fx_volley" },
    missile: { name: "Míssil Sagrado", icon: "icon_berserk", voc: "archer", cd: 3.0, dmg: 30, flatDmg: true, speed: 380, fx: "fx_holy_arrow" },
  },
  // projéteis por disparo no nível lv da arma (o jogo e o modelo de balanceamento usam a mesma regra)
  shots: (id, lv) => id === "arrow" ? 1 + Math.floor((lv - 1) / 3) : id === "missile" ? lv : 1,   // Míssil: 1 projétil por nível (e o dano por projétil não sobe com o nível)
  weaponLevel: { dmg: 0.22, cd: 0.08, area: 0.10, cdFloor: 0.25 },   // cada nível: +22% dano, −8% recarga (até 25% da base), +10% área; sem nível máximo
  // melhorias passivas oferecidas ao subir de nível
  passives: {
    might:  { name: "Força", desc: "+12% de dano", dmg: 0.12 },
    haste:  { name: "Ímpeto", desc: "−8% de recarga", cd: 0.08 },
    vigor:  { name: "Vitalidade", desc: "+20% de vida máxima e cura", hp: 0.2 },
    swift:  { name: "Pés de Vento", desc: "+10% de velocidade", speed: 0.1 },
    magnet: { name: "Ímã", desc: "+40% de alcance para pegar gemas", pickup: 0.4 },
    regen:  { name: "Alma de guerreiro", desc: "+0,6 vida/s", regen: 0.6 },
    crit:   { name: "Olho Morto", desc: "+6% de chance crítica (×1,8)", crit: 0.06 },
  },
  critMult: 1.8, baseCrit: 0.1,
  choices: 3,            // opções por subida de nível
  drops: { heal: 0.006, healPct: 0.3, chestFromElite: true },   // chance de carne (cura 30%) por monstro
  elite: { every: 120, hpMult: 8, scale: 1.6, xp: 15 },        // campeão a cada 2 min
};
