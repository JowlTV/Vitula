// Progresso permanente: ouro por vocação, recordes. Fica no navegador (localStorage).
const Save = {
  key: "vitula_save_v1",
  data: { vocs: {}, runs: 0, cleared: {}, bestiary: {} },
  load() {
    try { const raw = localStorage.getItem(this.key); if (raw) Object.assign(this.data, JSON.parse(raw)); } catch (e) {}
  },
  save() { try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) {} },
  voc(v) {
    if (!this.data.vocs[v]) this.data.vocs[v] = { gold: 0, trainings: {}, smith: {} };
    const d = this.data.vocs[v];
    if (!d.skills) d.skills = {};
    for (const id in SKILLS) if (!d.skills[id]) d.skills[id] = { lvl: SKILLS[id].start, tries: 0 };
    if (!d.ml) d.ml = { lvl: 0, spent: 0 };          // magic level
    if (!d.potions) d.potions = { health: 3 };       // poções guardadas na mochila
    if (!d.potionSlots) d.potionSlots = ["health", v === "knight" ? "fury" : "mana"];
    if (!d.xpTotal) d.xpTotal = 0;
    if (d.bless == null) d.bless = 0;      // bênçãos de Magdha (0 a 3)
    if (d.promoted == null) d.promoted = false; // título de promoção: conquistado uma vez, não se perde
    if (!d.equip) d.equip = {};           // equipamentos vestidos (quando existirem)
    return d;
  },
  // nível e experiência dentro do nível, a partir da experiência total (mesma fórmula do herói)
  levelInfo(total) {
    let L = 1, rest = total || 0;
    while (rest >= 8 * Math.pow(L, 1.35)) { rest -= 8 * Math.pow(L, 1.35); L++; }
    return { level: L, xp: rest };
  },
  skill(v, id) { return this.voc(v).skills[id]; },
  gold(v) { return this.voc(v).gold; },
  addGold(v, n) { this.voc(v).gold += n; },
  addKills(k) { for (const id in k) this.data.bestiary[id] = (this.data.bestiary[id] || 0) + k[id]; },
};
Save.load();

// Configurações do jogador: volume e teclas (cada ação aceita 2 teclas; a 2ª é alternativa fixa).
const ACTIONS = [
  ["up", "Andar para cima", ["W", "UP"]],
  ["down", "Andar para baixo", ["S", "DOWN"]],
  ["left", "Andar para a esquerda", ["A", "LEFT"]],
  ["right", "Andar para a direita", ["D", "RIGHT"]],
  ["skill1", "Habilidade 1 (Golpe Frontal)", ["ONE", "NUMPAD_ONE"]],
  ["skill2", "Habilidade 2 (Exura)", ["TWO", "NUMPAD_TWO"]],
  ["skill3", "Habilidade 3 (Golpe em Área)", ["THREE", "NUMPAD_THREE"]],
  ["skill4", "Habilidade 4 (Aura)", ["FOUR", "NUMPAD_FOUR"]],
  ["map", "Abrir o mapa", ["TAB", "M"]],
  ["zoomIn", "Aproximar a câmera", ["PLUS", "NUMPAD_ADD"]],
  ["zoomOut", "Afastar a câmera", ["MINUS", "NUMPAD_SUBTRACT"]],
  ["potion1", "Poção do atalho 1", ["FIVE", "NUMPAD_FIVE"]],
  ["potion2", "Poção do atalho 2", ["SIX", "NUMPAD_SIX"]],
  ["bag", "Abrir a mochila", ["I", "B"]],
  ["attack", "Ataque básico", ["SPACE", "F"]],
  ["autoAttack", "Ataque automático (liga/desliga)", ["R", "NUMPAD_ZERO"]],
  ["interact", "Falar / usar / subir a corda", ["E", "ENTER"]],
  ["pause", "Pausa", ["ESC", "P"]],
];
const Settings = {
  key: "vitula_settings_v1",
  data: { music: 0.6, sfx: 0.8, speed: 0.75, zoom: 2.8, keys: {} },  // zoom: aproximação da câmera do jogo  // speed: ritmo do jogo (1 = original)
  load() {
    try { const raw = localStorage.getItem(this.key); if (raw) Object.assign(this.data, JSON.parse(raw)); } catch (e) {}
    for (const [id, , def] of ACTIONS) if (!this.data.keys[id]) this.data.keys[id] = def.slice();
  },
  save() { try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) {} },
  reset() { this.data.keys = {}; this.data.music = 0.6; this.data.sfx = 0.8; this.data.speed = 0.75; this.load(); this.save(); },
  keyLabel(name) {
    const map = { UP: "↑", DOWN: "↓", LEFT: "←", RIGHT: "→", ONE: "1", TWO: "2", THREE: "3", FOUR: "4", ESC: "Esc", SPACE: "Espaço",
      NUMPAD_ONE: "Num 1", NUMPAD_TWO: "Num 2", NUMPAD_THREE: "Num 3", NUMPAD_FOUR: "Num 4", SHIFT: "Shift", CTRL: "Ctrl", ENTER: "Enter",
      NUMPAD_ADD: "Num +", NUMPAD_SUBTRACT: "Num −", NUMPAD_FIVE: "Num 5", NUMPAD_SIX: "Num 6", NUMPAD_ZERO: "Num 0", PLUS: "+", MINUS: "−", FIVE: "5", SIX: "6", TAB: "Tab" };
    return map[name] || (name.length <= 2 ? name : name.charAt(0) + name.slice(1).toLowerCase());
  },
};
Settings.load();
