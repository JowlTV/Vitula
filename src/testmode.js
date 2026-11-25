// Modo Teste (menu inicial → "Teste"): escolhe o personagem no nível 100 e cai no Campo de Testes,
// um mapa grande já aberto com acampamentos por espécie, cercados dos chefes (com portal para a luta real),
// locais futuros, a Torre das Amazonas (esboço) e um baú com todos os equipamentos no nível máximo.
// O progresso do teste fica num save separado: o save de verdade não é tocado.

const TEST_SAVE_KEY = "vitula_save_test";

// acampamentos comuns: uma espécie por acampamento [espécie, x, y] (fileira de cima e de baixo)
const TEST_CAMPS = [
  ["rat", 10, 7], ["cave_rat", 30, 7], ["bat", 50, 7], ["slime", 70, 7], ["skeleton", 92, 7],
  ["spider", 10, 43], ["poison_spider", 30, 43], ["goblin", 50, 43], ["goblin_scavenger", 70, 43], ["goblin_assassin", 92, 43],
];
// cercados (x, y, largura, altura); portão virado para o centro do mapa
const TEST_PENS = [
  { id: "giant_rat", label: "Rei Rato", boss: "giant_rat", x: 3, y: 17, w: 11, h: 7, gate: "right", portal: { region: "karhyn_sewers", floor: 5 } },
  { id: "giant_spider", label: "Aranha Gigante", boss: "giant_spider", x: 3, y: 27, w: 11, h: 7, gate: "right", portal: { region: "karhyn_sewers", floor: 3 } },
  { id: "goblin_leader", label: "Líder Goblin", boss: "goblin_leader", x: 17, y: 17, w: 11, h: 7, gate: "right", portal: { region: "goblin_slope", floor: 8 } },
  { id: "orc_camp", label: "Acampamento Orc", future: true, x: 86, y: 17, w: 11, h: 7, gate: "left" },
  { id: "ghostlands", label: "Terras Espectrais", future: true, x: 99, y: 17, w: 11, h: 7, gate: "left" },
  { id: "ghostlands_pit", label: "Fosso Espectral", future: true, x: 86, y: 27, w: 11, h: 7, gate: "left" },
  { id: "amazon_tower", label: "Torre das Amazonas", tower: true, x: 99, y: 27, w: 11, h: 7, gate: "left", portal: { region: "amazon_tower", floor: 1 } },
];

// regiões dos mapas de teste (fora do mapa-múndi)
REGIONS.test_grounds = { name: "Campo de Testes", desc: "Modo Teste.", floors: 1, cave: true, testMap: "grounds", pos: [-999, -999], tier: 99 };
Object.assign(REGIONS.amazon_tower, { floors: 1, cave: true, testMap: "tower" });   // ainda não jogável: só o esboço, pelo portal do teste

// ---------------------------------------------------------------- entrar / sair do teste
function enterTestMode(scene, voc) {
  if (!Save.testMode) Save.realKey = Save.key;
  Save.testMode = true; Save.key = TEST_SAVE_KEY;
  Save.data = { vocs: {}, runs: 0, cleared: {}, bestiary: {}, epoch: SAVE_EPOCH };
  const d = Save.voc(voc);
  let tot = 0; for (let L = 1; L < 100; L++) tot += 8 * Math.pow(L, 1.35);
  d.xpTotal = Math.ceil(tot) + 1;                        // nível 100
  for (const id in d.skills) d.skills[id].lvl = 80;      // sword, shield, distance, dodge
  d.ml = { lvl: 60, spent: 0 };
  d.promoted = true; d.gold = 999999; d.essence = 999; d.bless = 3; d.slopeOpen = true;
  d.potions = { health: 50, mana: 50, fury: 50 };
  for (const k in MONSTERS) Save.data.bestiary[k] = 999;   // bestiário completo
  Save.data.tutorialDone = true; Save.data.bestTip = true;
  Save.save();
  scene.registry.set("vocation", voc);
  scene.registry.set("region", "test_grounds");
  scene.registry.set("startFloor", 1);
  scene.registry.set("difficulty", 1);
  scene.scene.start("dungeon");
}
function leaveTestMode() {
  if (!Save.testMode) return;
  Save.testMode = false; Save.key = Save.realKey || "vitula_save_v1";
  Save.data = { vocs: {}, runs: 0, cleared: {}, bestiary: {} }; Save.load();
}

// menu inicial: botão "Teste" com a escolha do personagem; ao voltar ao menu, o save real volta
{
  const cr = TitleScene.prototype.create;
  TitleScene.prototype.create = function (...a) {
    leaveTestMode();
    const r = cr.apply(this, a);
    // abre espaço: os créditos descem um pouco
    for (const o of this.children.list) if (o.type === "Text" && o.text === t("credits_jowl")) o.setY(530);
    button(this, VIEW_W / 2, 492, 260, "Teste", () => {
      const c = this.add.container(0, 0).setDepth(50);
      c.add(this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x000000, 0.75).setOrigin(0).setInteractive());
      c.add(this.add.nineslice(VIEW_W / 2, VIEW_H / 2, "panel", null, 560, 250, 16, 16, 16, 16));
      c.add(txt(this, VIEW_W / 2, VIEW_H / 2 - 88, "Modo Teste", 24, COLORS.gold, { title: true }).setOrigin(0.5));
      c.add(txt(this, VIEW_W / 2, VIEW_H / 2 - 50, "Escolha o personagem (nível 100). O teste usa um save separado: seu progresso não muda.", 13, COLORS.text, { wordWrap: { width: 500 }, align: "center" }).setOrigin(0.5));
      const vocs = Object.keys(VOCATIONS).filter(v => !VOCATIONS[v].soon);
      vocs.forEach((v, i) => {
        const x = VIEW_W / 2 + (i - (vocs.length - 1) / 2) * 170;
        if (VOCATIONS[v].portrait && this.textures.exists(VOCATIONS[v].portrait)) c.add(this.add.image(x, VIEW_H / 2 + 4, VOCATIONS[v].portrait).setDisplaySize(52, 52));
        const [b, tt] = button(this, x, VIEW_H / 2 + 62, 150, VOCATIONS[v].name, () => enterTestMode(this, v), 14);
        c.add([b, tt]);
      });
      const [b2, t2] = button(this, VIEW_W / 2, VIEW_H / 2 + 108, 120, t("reset_no"), () => c.destroy(), 12);
      c.add([b2, t2]);
    }, 14);
    return r;
  };
}

// ---------------------------------------------------------------- texturas feitas em código
function testTextures(scene) {
  if (!scene.textures.exists("amazon_tower_sketch")) {
    // esboço da Torre das Amazonas em pixel art: 64×128, ampliado sem suavizar
    const W = 64, H = 128, ct = scene.textures.createCanvas("amazon_tower_sketch", W, H), c = ct.getContext();
    const R = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    // base escalonada
    R(6, 112, 52, 14, "#3a3632"); R(8, 110, 48, 4, "#5a5550"); R(4, 122, 56, 6, "#2a2724");
    // corpo cilíndrico: claro à esquerda, escuro à direita (luz vindo da esquerda)
    const cols = ["#7a746c", "#8a847a", "#948d82", "#8a847a", "#7a746c", "#6a645c", "#5a554e", "#4a4640", "#3c3834"];
    for (let x = 0; x < 40; x++) R(12 + x, 34, 1, 78, cols[Math.min(cols.length - 1, Math.floor(x / 40 * cols.length))]);
    // fiadas de pedra (juntas)
    for (let y = 38; y < 110; y += 6) { R(12, y, 40, 1, "rgba(20,18,16,0.55)"); for (let x = 12 + ((y / 6) % 2) * 4; x < 52; x += 8) R(x, y - 5, 1, 5, "rgba(20,18,16,0.4)"); }
    // galeria / ameias no topo
    R(8, 26, 48, 8, "#5a554e"); R(8, 26, 48, 2, "#8a847a"); R(8, 33, 48, 2, "#2a2724");
    for (let x = 8; x < 56; x += 8) { R(x, 18, 5, 8, "#6a645c"); R(x, 18, 5, 1, "#948d82"); }
    // telhado cônico vermelho-escuro com estandarte
    for (let i = 0; i < 16; i++) { const w = 4 + i * 3; R(32 - w / 2, 2 + i, w, 1, i % 3 ? "#6a1c1c" : "#4a1212"); }
    R(31, 0, 2, 4, "#c8a050");
    R(33, 0, 7, 4, "#a02828"); R(33, 4, 5, 1, "#a02828");
    // janelas em seteira com luz de vela
    for (const [x, y] of [[30, 44], [22, 64], [38, 64], [30, 84]]) { R(x - 1, y - 1, 6, 12, "#2a2724"); R(x, y, 4, 10, "#1a1410"); R(x + 1, y + 2, 2, 6, "#e0a040"); }
    // porta em arco com ferragens
    R(24, 94, 16, 18, "#2a2724"); R(26, 92, 12, 2, "#2a2724"); R(28, 90, 8, 2, "#2a2724");
    R(26, 96, 12, 16, "#4a2c18"); R(26, 103, 12, 1, "#2a1a0c"); R(31, 96, 1, 16, "#2a1a0c"); R(35, 104, 2, 2, "#c8a050");
    // hera subindo pela direita
    for (let y = 60; y < 112; y++) if ((y * 7) % 5 < 3) R(46 + ((y * 13) % 5), y, 2, 1, (y % 4) ? "#3a5a2a" : "#4a7a34");
    // escudo das amazonas (lança cruzada no círculo) sobre a porta
    R(28, 73, 8, 7, "#a02828"); R(29, 80, 6, 1, "#a02828"); R(30, 81, 4, 1, "#a02828"); R(31, 82, 2, 1, "#a02828");
    R(31, 72, 2, 10, "#e0c070"); R(30, 71, 4, 1, "#e0c070"); R(31, 70, 2, 1, "#f0d890");   // lança das amazonas
    ct.refresh();
  }
  if (!scene.textures.exists("test_sign")) {
    // placa de madeira
    const g = scene.make.graphics({ add: false });
    g.fillStyle(0x3a2814).fillRect(14, 18, 4, 26);
    g.fillStyle(0x6a4a24).fillRect(0, 2, 32, 18); g.fillStyle(0x8a6434).fillRect(1, 3, 30, 2);
    g.fillStyle(0x2a1a0c).fillRect(0, 19, 32, 2).fillRect(4, 9, 24, 1).fillRect(4, 13, 18, 1);
    g.generateTexture("test_sign", 32, 44); g.destroy();
  }
}

// ---------------------------------------------------------------- montagem dos mapas de teste
Object.assign(DungeonScene.prototype, {
  // grade aberta: 1 = chão, 0 = rocha (só a borda)
  testGrid(W, H, open) {
    const g = this.gen;
    g.w = W; g.h = H; g.cave = true;
    g.cells = new Uint8Array(W * H); g.waterDir = new Uint8Array(W * H);
    g.rooms = []; g.doors = []; g.bridges = []; g.sconces = []; g.drains = []; g.tunnels = []; g.junctions = [];
    g.bridgeSet = new Set();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (open(x, y)) g.cells[y * W + x] = 1;
    let s = 77; g.rng = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  },
  // bloqueia uma casa com um objeto (cerca, placa, construção)
  testBlock(x, y, spr) {
    const k = key(x, y); if (this.props.has(k)) return;
    this.props.set(k, { kind: "test_block", spr: spr || this.add.image(0, 0, "light").setVisible(false), hits: 0, x, y });
  },
  testLabel(x, y, text, color = COLORS.gold, size = 14) {
    const p = this.cellPos(x, y);
    const l = txt(this, p.x, p.y - T * 1.6, text, size, color, { title: true }).setOrigin(0.5).setDepth(p.y + 2000);
    this.ents.add(l); return l;
  },
  testFire(x, y) {
    this.addProp(x, y, "slope_campfire");
    const p = this.cellPos(x, y);
    this.lights.push({ x: p.x, y: p.y - 20, r: 5 * T, warm: true, ph: Math.random() * 10 });
  },
  testPortal(x, y, to, label) {
    const p = this.cellPos(x, y);
    this.makePortal(p.x, p.y - T * 0.35, T * 1.2);
    this.lights.push({ x: p.x, y: p.y - T / 2, r: 3.5 * T, warm: false, ph: 0 });
    this.testPortals.push({ x, y, to });
    if (label) this.testLabel(x, y + 0.4, label, "#9cc8ff", 11);
  },
  testSpawn(kind, x, y) {
    if (!MONSTERS[kind]) return null;
    const m = this.spawnMonster(kind, x, y);
    if (m) m.testHome = { x: m.x, y: m.y, kind };
    return m;
  },

  buildTestFloor() {
    const kind = this.region.testMap;
    this.slope = false; this.forest = false;
    if (this.floorRT) { this.floorRT.destroy(); this.floorRT = null; }
    if (this.world) this.world.destroy(true);
    if (this.ents) this.ents.destroy(true);
    this.world = this.add.layer().setDepth(0);
    this.monsters = []; this.occ = new Map(); this.props = new Map(); this.doors = new Map();
    this.pickups = new Map(); this.spikes = new Map(); this.plates = new Map(); this.clouds = [];
    this.lights = []; this.dusts = []; this.stairs = null; this.campRoom = undefined;
    this.pockets = []; this.holes = new Map(); this.holeBusy = false; this.holeHint = null;
    this.rope = null; this.altar = null; this.slopePass = null; this.testPortals = []; this.testChest = null;
    testTextures(this);
    let start;
    if (kind === "tower") {
      // pátio diante da torre: oval aberto
      const W = 40, H = 32;
      this.testGrid(W, H, (x, y) => { const dx = (x - 20) / 17, dy = (y - 17) / 13; return dx * dx + dy * dy < 1; });
      start = { x: 20, y: 26 };
    } else {
      const W = 112, H = 50;
      this.testGrid(W, H, (x, y) => x >= 2 && y >= 2 && x < W - 2 && y < H - 2);
      start = { x: 56, y: 25 };
    }
    const g = this.gen;
    this.farRoom = 0;
    this.drawStatic();
    this.ents = this.add.layer().setDepth(1);
    this.ambientTint = 0xd0cabc;
    if (kind === "tower") this.populateTowerMap(start); else this.populateTestGrounds(start);

    // herói (mesmo código do buildFloor)
    this.hero.x = start.x; this.hero.y = start.y; this.hero.moveT = 0;
    const p = this.cellPos(start.x, start.y);
    this.hero.shadow = this.add.image(p.x, p.y - 3, "shadow").setScale(0.9, 0.3);
    const ap = this.ap || "kn_", k4 = this.anims.exists(ap + "idle_down");
    this.hero.spr = this.add.sprite(p.x, p.y + 4, ap + "idle_down").setOrigin(0.5, 1).play(ap + "idle_down");
    if (k4) this.hero.spr.setScale(this.heroScale || 0.42);
    this.ents.add([this.hero.shadow, this.hero.spr]);
    this.hero.shadow.setDepth(p.y - 1);
    this.hero.px = p.x; this.hero.py = p.y;
    const cam = this.cameras.main;
    cam.setZoom(this.camZoom());
    cam.setBounds(0, 0, g.w * T, g.h * T);
    this.uiCam.ignore([this.world, this.ents]);
    if (this.glow) this.uiCam.ignore(this.glow);
    cam.startFollow(this.hero.spr, true, 0.35, 0.35, 0, 24);
    this.floorRT.refresh();
    if (LOW_MEM) this.floorRT.shrink();
    this.explored = new Uint8Array(g.w * g.h).fill(1);   // mapa já aberto
    this.buildDarkness();
    this.updateFlow();
    this.reveal();
    const want = kind === "tower" ? "music_title" : "music_slope";
    if (this._music !== want) { this._music = want; if (musicExists(this, want)) playMusic(this, want, 0.5); }
    if (this.hudFloor) this.hudFloor.setText(this.region.name);
    this.time.delayedCall(600, () => this.msg(kind === "tower" ? "Torre das Amazonas — esboço inicial (ainda sem monstros)." : "Campo de Testes: o baú ao lado tem todos os itens no nível máximo (E ou clique)."));
  },

  populateTestGrounds(start) {
    // praça central: baú, tochas e placa
    const cx = start.x, cy = start.y;
    for (const [x, y] of [[cx - 4, cy - 3], [cx + 4, cy - 3], [cx - 4, cy + 3], [cx + 4, cy + 3]]) this.addProp(x, y, "torch_stand");
    this.placeTestChest(cx + 2, cy - 1);
    this.testLabel(cx, cy - 2.2, "Campo de Testes", COLORS.gold, 18);
    // acampamentos por espécie (renascem 20 s depois de mortos)
    for (const [k, x, y] of TEST_CAMPS) {
      if (!MONSTERS[k]) continue;
      this.testFire(x, y);
      this.addProp(x - 3, y - 1, "slope_tent");
      const M = MONSTERS[k];
      this.testLabel(x, y - 1.2, M.plural || M.name, "#e8dcc0", 13);
      for (const [dx, dy] of [[-2, 1], [2, 1], [-1, 2], [1, 2], [2, -1]]) this.testSpawn(k, x + dx, y + dy);
    }
    // cercados: chefes, locais futuros e a torre
    for (const P of TEST_PENS) this.buildPen(P);
  },

  buildPen(P) {
    const gateY = [P.y + (P.h >> 1), P.y + (P.h >> 1) + 1];
    const gx = P.gate === "right" ? P.x + P.w - 1 : P.x;
    const fenceAt = (x, y) => {
      if (x === gx && gateY.includes(y)) return;   // portão
      const p = this.cellPos(x, y);
      const spr = this.add.image(p.x, p.y + 6, "slope_palisade").setOrigin(0.5, 1).setDepth(p.y);
      spr.setScale(PROP_H.slope_palisade / spr.height * 0.85); if (P.future) spr.setTint(0x8a8478);
      this.ents.add(spr); this.testBlock(x, y, spr);
    };
    for (let x = P.x; x < P.x + P.w; x++) { fenceAt(x, P.y); fenceAt(x, P.y + P.h - 1); }
    for (let y = P.y + 1; y < P.y + P.h - 1; y++) { fenceAt(P.x, y); fenceAt(P.x + P.w - 1, y); }
    const mx = P.x + (P.w >> 1), my = P.y + (P.h >> 1);
    // placa com o nome, do lado de fora do portão
    const sx = P.gate === "right" ? P.x + P.w + 1 : P.x - 2, sy = P.y + 1;
    { const p = this.cellPos(sx, sy); const s = this.add.image(p.x, p.y + 6, "test_sign").setOrigin(0.5, 1).setScale(1.3).setDepth(p.y); this.ents.add(s); this.testBlock(sx, sy, s); }
    this.testLabel(mx, P.y - 0.3, P.label + (P.future ? " (em breve)" : ""), P.future ? "#a8a090" : P.boss ? "#ff9a7a" : COLORS.gold, 13);
    this.addProp(P.x + 1, P.y + 1, "torch_stand");
    this.addProp(P.x + P.w - 2, P.y + 1, "torch_stand");
    if (P.boss) {
      // chefe dentro do cercado; o portal leva à sala dele de verdade
      this.testSpawn(P.boss, mx - (P.gate === "right" ? 2 : -2), my);
      this.testPortal(mx + (P.gate === "right" ? 2 : -2), my, P.portal, "Portal: " + P.label);
    } else if (P.tower) {
      // esboço da torre ao fundo do cercado + portal para o pátio dela
      const tx = P.x + P.w - 3, p = this.cellPos(tx, P.y + P.h - 2);
      const tw = this.add.image(p.x, p.y + 10, "amazon_tower_sketch").setOrigin(0.5, 1).setScale(2.2).setDepth(p.y);
      this.ents.add(tw);
      for (let x = tx - 1; x <= tx + 1; x++) for (let y = P.y + P.h - 3; y <= P.y + P.h - 2; y++) this.testBlock(x, y);
      this.testPortal(P.x + 3, my, P.portal, "Portal: " + P.label);
    } else {
      // local futuro: só o terreno marcado
      this.addProp(mx, my, "slope_cairn");
    }
  },

  populateTowerMap(start) {
    const p = this.cellPos(20, 9);
    const tw = this.add.image(p.x, p.y + 16, "amazon_tower_sketch").setOrigin(0.5, 1).setScale(4).setDepth(p.y);
    this.ents.add(tw);
    for (let x = 16; x <= 24; x++) for (let y = 4; y <= 9; y++) this.testBlock(x, y);
    this.lights.push({ x: p.x, y: p.y - 200, r: 6 * T, warm: true, ph: 0 });
    for (const [x, y] of [[13, 12], [27, 12], [11, 19], [29, 19], [14, 25], [26, 25]]) this.addProp(x, y, this.textures.exists("pillar") ? "torch_stand" : "torch_stand");
    this.testLabel(20, 11.2, "Torre das Amazonas (esboço)", COLORS.gold, 16);
    this.testPortal(20, 28, { region: "test_grounds", floor: 1 }, "Voltar ao Campo de Testes");
  },

  // ---------------------------------------------------------------- baú com todos os itens
  placeTestChest(x, y) {
    const p = this.cellPos(x, y), tex = this.textures.exists("chest_closed") ? "chest_closed" : "test_sign";
    const spr = this.add.image(p.x, p.y + 4, tex).setOrigin(0.5, 1).setDepth(p.y);
    spr.setScale(44 / spr.height).setTint(0xffe0a0).setInteractive({ useHandCursor: true });
    spr.on("pointerdown", () => this.openTestChest());
    this.ents.add(spr); this.testBlock(x, y, spr);
    const glow = this.add.image(p.x, p.y - 14, "light").setScale(0.35).setTint(0xffc860).setAlpha(0.4).setBlendMode(Phaser.BlendModes.ADD).setDepth(p.y - 1);
    this.ents.add(glow); this.tweens.add({ targets: glow, alpha: 0.15, duration: 900, yoyo: true, repeat: -1 });
    this.lights.push({ x: p.x, y: p.y - 20, r: 3 * T, warm: true, ph: 0 });
    this.testChest = { x, y };
  },
  testItems() {
    const max = typeof LEGEND_MAX === "number" ? LEGEND_MAX : 10;
    const ok = id => equipOk(id, this.vocId);
    return Object.keys(EQUIP).sort((a, b) => (ok(b) - ok(a)) || ((EQUIP[a].slot || "") > (EQUIP[b].slot || "") ? 1 : -1)).map(id => ({ id, r: 4, p: max }));
  },
  openTestChest() {
    if (this.testBox) { this.testBox.destroy(); this.testBox = null; }
    const items = this.testItems(), COLS = 8, ROWS = 4, PER = COLS * ROWS, pages = Math.max(1, Math.ceil(items.length / PER));
    this.testPage = Phaser.Math.Clamp(this.testPage || 0, 0, pages - 1);
    const W = 520, H = 330, x0 = VIEW_W / 2 - W / 2, y0 = VIEW_H / 2 - H / 2, S = 52;
    const c = this.add.container(0, 0).setDepth(200); this.ui.add(c); this.testBox = c;
    c.add(this.add.rectangle(x0, y0, W, H, 0x0c0a08, 0.95).setOrigin(0).setStrokeStyle(2, 0xc8a050).setInteractive());
    c.add(txt(this, x0 + 14, y0 + 10, `Baú de Testes — página ${this.testPage + 1} / ${pages}`, 15, COLORS.gold, { title: true }));
    c.add(txt(this, x0 + 14, y0 + 32, "Clique num item para pô-lo na mochila (Lendário +" + (typeof LEGEND_MAX === "number" ? LEGEND_MAX : 10) + "). Itens de outra classe ficam apagados.", 10, COLORS.dim));
    const close = txt(this, x0 + W - 22, y0 + 6, "×", 18, COLORS.text).setInteractive({ useHandCursor: true });
    close.on("pointerdown", () => { c.destroy(); this.testBox = null; }); c.add(close);
    const page = items.slice(this.testPage * PER, this.testPage * PER + PER), gx = x0 + (W - COLS * (S + 8) + 8) / 2, gy = y0 + 54;
    const tip = txt(this, x0 + 14, y0 + H - 54, "", 11, COLORS.text);
    page.forEach((g, i) => {
      const x = gx + (i % COLS) * (S + 8), y = gy + Math.floor(i / COLS) * (S + 8), ok = equipOk(g.id, this.vocId);
      const r = this.add.rectangle(x, y, S, S, 0x1a1612, 1).setOrigin(0).setStrokeStyle(1, (RARITY[4] && RARITY[4].hex) || 0xffa030).setInteractive({ useHandCursor: true });
      c.add(r);
      if (this.textures.exists("eq_" + g.id)) { const im = this.add.image(x + S / 2, y + S / 2, "eq_" + g.id); im.setScale((S - 10) / Math.max(im.width, im.height)); if (!ok) im.setAlpha(0.4); c.add(im); }
      c.add(txt(this, x + S - 4, y + S - 14, "+" + g.p, 9, "#ffa030").setOrigin(1, 0));
      r.on("pointerover", () => { r.setFillStyle(0x3a2c18, 1); tip.setText(`${gearName ? gearName(g) : EQUIP[g.id].name}${ok ? "" : "  (outra classe)"}`); });
      r.on("pointerout", () => r.setFillStyle(0x1a1612, 1));
      r.on("pointerdown", () => { this.takeTestItem(g); r.setStrokeStyle(2, 0x7ad060); });
    });
    c.add(tip);
    const btn = (bx, label, fn) => { const b = txt(this, bx, y0 + H - 26, label, 13, COLORS.gold, { title: true }).setOrigin(0.5).setInteractive({ useHandCursor: true }); b.on("pointerdown", fn); c.add(b); };
    if (this.testPage > 0) btn(x0 + 70, "‹ anterior", () => { this.testPage--; this.openTestChest(); });
    if (this.testPage < pages - 1) btn(x0 + W - 70, "próxima ›", () => { this.testPage++; this.openTestChest(); });
    btn(x0 + W / 2, "Pegar todos desta página", () => { for (const g of page) if (equipOk(g.id, this.vocId)) this.takeTestItem(g, true); this.msg("Itens desta página na mochila."); });
  },
  takeTestItem(g, quiet) {
    const d = Save.voc(this.vocId);
    d.gear.push({ id: g.id, r: g.r, p: g.p }); Save.save();
    if (!quiet) this.msg((typeof gearName === "function" ? gearName(g) : EQUIP[g.id].name) + " na mochila.");
    sfx(this, "pickup", 0.2);
  },
});

// ---------------------------------------------------------------- ganchos no calabouço
{
  const bf = DungeonScene.prototype.buildFloor;
  DungeonScene.prototype.buildFloor = function (...a) {
    if (this.region && this.region.testMap) return this.buildTestFloor();
    return bf.apply(this, a);
  };
  // E perto do baú abre o baú
  const ta = DungeonScene.prototype.tryAltar;
  DungeonScene.prototype.tryAltar = function (...a) {
    const c = this.testChest, h = this.hero;
    if (c && !h.dead && Math.abs(h.x - c.x) <= 1 && Math.abs(h.y - c.y) <= 1) { if (this.testBox) { this.testBox.destroy(); this.testBox = null; } else this.openTestChest(); return true; }
    return ta.apply(this, a);
  };
  // pisar num portal do teste leva ao destino
  const ha = DungeonScene.prototype.heroArrived;
  DungeonScene.prototype.heroArrived = function (...a) {
    const r = ha.apply(this, a), h = this.hero;
    const P = this.testPortals && this.testPortals.find(p => p.x === h.x && p.y === h.y);
    if (P && !this.finished) {
      this.finished = true; sfx(this, "levelup", 0.25);
      this.cameras.main.fadeOut(400, 0, 0, 0, () => { this.registry.set("region", P.to.region); this.registry.set("startFloor", P.to.floor); this.scene.start("dungeon"); });
    }
    return r;
  };
  // monstros do teste renascem no acampamento 20 s depois
  const md = DungeonScene.prototype.monsterDied;
  DungeonScene.prototype.monsterDied = function (m, ...a) {
    const r = md.apply(this, [m, ...a]);
    if (m.testHome && this.region && this.region.testMap) {
      const home = m.testHome, rid = this.regionId;
      this.time.delayedCall(20000, () => {
        if (!this.scene.isActive() || this.regionId !== rid || this.finished) return;
        if (this.occ.has(key(home.x, home.y)) || (this.hero.x === home.x && this.hero.y === home.y)) return;
        this.testSpawn(home.kind, home.x, home.y);
      });
    }
    return r;
  };
}
