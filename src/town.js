// Cidadela de Karhyn: cidade murada para caminhar, com depot, ferreiro, vendedora de poções e a entrada dos esgotos.
// Abre depois que os Esgotos são vencidos. Layout inspirado numa cidadela fortificada: portão ao sul com torres,
// avenida até o salão de colunas ao norte, praça com fonte no centro, torre de vigia, casas de enxaimel e ciprestes.

const TOWN_TINT = 0xc2c6d0; // luz fria e nublada da cidade, aplicada no herói e nos NPCs
const TOWN_W = 48, TOWN_H = 36;
// artes grandes da cidade que já chegaram do SpriteCook (as que faltam são desenhadas por código até chegarem)
const TOWN_ART = ["town_gate", "town_hall", "town_tower", "town_fountain", "town_house_red", "town_house_thatch", "town_cypress", "town_lamp", "town_grass", "town_floor_wood", "town_depot_wall", "town_smithy", "town_cobble", "town_rampart"];
const TOWN_FILES = ["town_street", "town_wall", "town_roof", "town_door", "town_window", "depot_chest", "smith_forge", "smith_bench",
  "potion_counter", "npc_smith", "npc_potion_seller", "npc_depot_guard"];

function cityUnlocked() { return true; }

class TownScene extends Phaser.Scene {
  constructor() { super("town"); }

  create() {
    this.anims.globalTimeScale = 1;
    this.vocId = this.registry.get("vocation") || "knight";
    this.cameras.main.setBackgroundColor("#1a1c18");
    this.cameras.main.roundPixels = true;
    this.world = this.add.layer();
    this.uiLayer = this.add.layer().setDepth(1000000);
    this.uiCam = zoom2(this.cameras.add(0, 0, VIEW_W * 2, VIEW_H * 2));
    this.cameras.main.ignore(this.uiLayer);
    this.uiCam.ignore(this.world);
    this.solid = new Set(); this.zones = [];
    // a cena é reaproveitada ao voltar da loja/esgoto: zera o estado da visita anterior
    this.leaving = false; this.dialog = null; this.grassPat = null; this.woodPat = null; this.rampPat = null;
    if (this.textures.exists("town_ground")) this.textures.remove("town_ground");
    this.makePlaceholders();
    this.layout();
    this.drawGround();
    this.placeThings();
    this.spawnHero();
    this.buildUi();
    this.ambience();
    // teclas
    const K = Phaser.Input.Keyboard.KeyCodes, kb = this.input.keyboard;
    this.keysIn = {};
    for (const [id] of ACTIONS) this.keysIn[id] = Settings.data.keys[id].filter(n => K[n] !== undefined).map(n => kb.addKey(K[n]));
    kb.addCapture("UP,DOWN,LEFT,RIGHT,SPACE");
    (this.keysIn.interact || []).forEach(k => k.on("down", () => this.interact()));
    this.input.keyboard.on("keydown", ev => this.dialogKey(ev));
    (this.keysIn.pause || []).forEach(k => k.on("down", () => this.dialog ? this.closeDialog() : this.openMenu()));
    (this.keysIn.zoomIn || []).forEach(k => k.on("down", () => this.zoomBy(0.2)));
    (this.keysIn.zoomOut || []).forEach(k => k.on("down", () => this.zoomBy(-0.2)));
    this.input.on("wheel", (_p, _o, _dx, dy) => this.zoomBy(dy > 0 ? -0.2 : 0.2));
    this.cameras.main.fadeIn(500, 0, 0, 0);
    stopAllButMusic(this);
    goddessMusic(this, true);
  }

  // ------------------------------------------------------------ mapa
  key(x, y) { return y * 1000 + x; }
  block(x0, y0, w, h) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.solid.add(this.key(x, y)); }
  isSolid(x, y) { return x < 0 || y < 0 || x >= TOWN_W || y >= TOWN_H || this.solid.has(this.key(x, y)); }

  // Planta (48×36): muralha em volta com portão ao sul; avenida do portão ao Templo de Magdha (norte);
  // praça da fonte no centro; rua leste–oeste com calçada (oeste: depósito e casas; leste: poções, ferraria, taverna);
  // rua do sul (oeste: bairro pobre de terra; leste: casas e o bueiro do esgoto).
  // Códigos: g grama · c paralelepípedo · p pedra da praça · s calçada · d terra · w muralha
  layout() {
    const g = this.ground = [];
    for (let y = 0; y < TOWN_H; y++) { g.push([]); for (let x = 0; x < TOWN_W; x++) g[y].push("g"); }
    const rect = (x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < TOWN_W && y < TOWN_H) g[y][x] = t; };
    rect(0, 0, TOWN_W - 1, 2, "w"); rect(0, TOWN_H - 3, TOWN_W - 1, TOWN_H - 1, "w");
    rect(0, 0, 1, TOWN_H - 1, "w"); rect(TOWN_W - 2, 0, TOWN_W - 1, TOWN_H - 1, "w");
    rect(23, TOWN_H - 3, 24, TOWN_H - 1, "c");            // passagem do portão
    rect(23, 10, 24, TOWN_H - 4, "c");                    // avenida
    rect(2, 16, 45, 17, "c");                             // rua leste–oeste
    rect(2, 15, 16, 15, "s"); rect(31, 15, 45, 15, "s");  // calçadas na frente das casas
    rect(17, 11, 30, 21, "p");                            // praça
    rect(22, 10, 25, 10, "p");                            // escadaria do templo
    rect(16, 27, 45, 28, "c"); rect(2, 27, 15, 28, "d");  // rua do sul (terra no bairro pobre)
    rect(3, 24, 14, 26, "d"); rect(39, 19, 45, 21, "c");  // terreiro do bairro pobre; pátio da taverna
    rect(38, 29, 41, 30, "c");                            // beco do bueiro
    for (let y = 0; y < TOWN_H; y++) for (let x = 0; x < TOWN_W; x++) if (g[y][x] === "w") this.solid.add(this.key(x, y));
  }

  // chão: grama de base + autotiles de 15 peças do SpriteCook (grade dupla), cada um sobre o anterior
  drawGround() {
    const W = TOWN_W * T, H = TOWN_H * T;
    const ct = this.textures.createCanvas("town_ground", W, H), c = ct.getContext();
    c.imageSmoothingEnabled = false;
    c.fillStyle = c.createPattern(this.textures.get("ground_grass").getSourceImage(), "repeat"); c.fillRect(0, 0, W, H);
    const FRAME = [-1, 15, 8, 9, 0, 11, 14, 7, 13, 4, 1, 10, 3, 2, 5, 6];
    const layer = (tex, fill, swap = {}) => {
      const img = this.textures.get(tex).getSourceImage(), ts = img.width / 4;
      const on = (x, y) => x >= 0 && y >= 0 && x < TOWN_W && y < TOWN_H && fill(this.ground[y][x]);
      for (let y = 0; y <= TOWN_H; y++) for (let x = 0; x <= TOWN_W; x++) {
        const m = (on(x - 1, y - 1) ? 1 : 0) | (on(x, y - 1) ? 2 : 0) | (on(x - 1, y) ? 4 : 0) | (on(x, y) ? 8 : 0), f = swap[m] !== undefined ? swap[m] : FRAME[m];
        if (f < 0) continue;
        c.drawImage(img, (f % 4) * ts, Math.floor(f / 4) * ts, ts, ts, x * T - T / 2, y * T - T / 2, T, T);
      }
    };
    layer("ts_dirt_grass", t => t === "d");
    // paralelepípedo × grama: o quadro do miolo (6) veio com grama na geração; o miolo usa o quadro 10, que é pedra pura
    // ruas: o mesmo calçamento em espinha de peixe que é a "parte de baixo" da calçada e da praça (quadro 12 = só calçamento),
    // assim não há emenda entre rua, calçada e praça. (O tileset paralelepípedo × grama veio com quadros defeituosos.)
    {
      const sw = this.textures.get("ts_sidewalk_cobble").getSourceImage(), ts = sw.width / 4;
      const big = document.createElement("canvas"); big.width = big.height = T; const bc = big.getContext("2d"); bc.imageSmoothingEnabled = false;
      bc.drawImage(sw, 0, 3 * ts, ts, ts, 0, 0, T, T);
      c.fillStyle = c.createPattern(big, "repeat");
      const road = t => t === "c" || t === "p" || t === "s";
      for (let y = 0; y < TOWN_H; y++) for (let x = 0; x < TOWN_W; x++) if (road(this.ground[y][x])) c.fillRect(x * T, y * T, T, T);
      // borda: tufos de grama irregulares avançando sobre a pedra, e uma sombra fina onde a pedra começa
      const rng = new Phaser.Math.RandomDataGenerator(["karhyn-borda"]);
      const tuft = ["#2f3a24", "#34402a", "#2a3420", "#3a4530", "#252c1c"];
      for (let y = 0; y < TOWN_H; y++) for (let x = 0; x < TOWN_W; x++) {
        if (!road(this.ground[y][x])) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= TOWN_W || ny >= TOWN_H) continue;
          const n = this.ground[ny][nx]; if (n !== "g" && n !== "d") continue;
          c.fillStyle = "rgba(0,0,0,0.28)";
          if (dx) c.fillRect(x * T + (dx > 0 ? T - 3 : 0), y * T, 3, T); else c.fillRect(x * T, y * T + (dy > 0 ? T - 3 : 0), T, 3);
          for (let i = 0; i < 14; i++) {
            c.fillStyle = n === "d" ? "#4a3a28" : tuft[rng.between(0, 4)];
            const a = rng.between(0, 15) * 4, b = rng.between(0, 2) * 3, w = rng.between(1, 2) * 3;
            if (dx) c.fillRect(x * T + (dx > 0 ? T - w - b : b), y * T + a, w, 4); else c.fillRect(x * T + a, y * T + (dy > 0 ? T - w - b : b), 4, w);
          }
        }
      }
    }
    layer("ts_sidewalk_cobble", t => t === "s");
    layer("ts_plaza_cobble", t => t === "p");
    // muralhas laterais: passadiço de pedra visto de cima (topo do trecho de muralha, girado)
    const wall = this.textures.get("k2_wall").getSourceImage(), topH = Math.round(wall.height * 0.42);
    c.fillStyle = "#1c1c20"; c.fillRect(0, 0, W, 2 * T); c.fillRect(0, H - 3 * T, W, 3 * T);
    for (const x0 of [0, W - 2 * T]) for (let y = 0; y < H; y += 2 * T) {
      c.save(); c.translate(x0 + 2 * T, y); c.rotate(Math.PI / 2);
      c.drawImage(wall, 0, 0, wall.width, topH, 0, 0, 2 * T, 2 * T); c.restore();
      c.fillStyle = "rgba(0,0,0,0.25)"; c.fillRect(x0 === 0 ? 2 * T - 6 : x0, y, 6, 2 * T);
    }
    ct.refresh();
    this.world.add(this.add.image(0, 0, "town_ground").setOrigin(0).setDepth(-10));
  }

  // coloca uma arte k2_ com a base na linha `by` (casa), a partir da coluna `bx`, com `w` casas de largura;
  // bloqueia as `fd` linhas de baixo (a pegada); `depth` opcional para ficar atrás de quem passa
  art(tex, bx, by, w, fd = 2, solid = true) {
    const img = this.add.image((bx + w / 2) * T, (by + 1) * T, tex).setOrigin(0.5, 1);
    img.setScale(w * T / img.width).setDepth((by + 1) * T - 2).setTint(TOWN_TINT);
    this.world.add(img); groundShadow(this, img, this.world, w > 2 ? 0.95 : 0.85, w > 2 ? 0.55 : 0.9);
    if (solid && fd > 0) this.block(Math.floor(bx), by - fd + 1, Math.ceil(w), fd);
    return img;
  }

  // ------------------------------------------------------------ peças
  // coloca uma arte com a base no pé de um retângulo de casas (fx, fy, fw, fd) e largura alvo em casas
  put(tex, fx, fy, fw, fd, widthTiles, solid = true, dy = 0) {
    const img = this.add.image((fx + fw / 2) * T, (fy + fd) * T + dy, tex).setOrigin(0.5, 1);
    const s = widthTiles * T / img.width; img.setScale(s);
    img.setDepth((fy + fd) * T);
    this.world.add(img);
    if (solid) this.block(fx, fy, fw, fd);
    return img;
  }

  placeThings() {
    const A = (t, x, y, w, fd, solid) => this.art("k2_" + t, x, y, w, fd, solid);
    // muralha: trechos de 2 casas no norte e no sul, torres nos cantos, portão ao sul
    for (let x = 2; x < TOWN_W - 2; x += 2) A("wall", x, 2, 2, 0);
    for (let x = 2; x < TOWN_W - 2; x += 2) if (x < 21 || x > 25) A("wall", x, TOWN_H - 1, 2, 0);
    for (const [x, y] of [[0, 2], [TOWN_W - 2, 2], [0, TOWN_H - 1], [TOWN_W - 2, TOWN_H - 1]]) A("wall_tower", x, y, 2, 0);
    // portão: fica atrás do herói, menos quando ele está dentro do arco (aí o arco passa na frente)
    this.gateImg = A("gate", 21, TOWN_H - 1, 6, 0); this.gateImg.setDepth(29 * T);
    this.block(21, TOWN_H - 6, 2, 6); this.block(25, TOWN_H - 6, 2, 6);
    // templo de Magdha no fim da avenida, com estandartes
    A("temple", 21, 9, 6, 3);
    A("banner", 20, 9, 0.7, 1); A("banner", 27, 9, 0.7, 1);
    // praça: fonte, bancos, barracas
    this.fountain = this.put("town_fountain", 23, 14, 2, 2, 176 / T, true, 6);
    A("bench", 19, 12, 1.4, 1); A("bench", 27, 12, 1.4, 1);
    A("stall_red", 18, 20, 2, 1); A("stall_green", 28, 20, 2, 1);
    // norte da rua (oeste): depósito e casas
    A("depot", 3, 14, 5, 3); A("barrels", 8, 14, 1.1, 1); A("house_red", 9, 14, 3, 3); A("crates", 12, 14, 1.1, 1); A("house_red", 13, 14, 3, 3);
    // norte da rua (leste): poções, ferraria e taverna
    A("potion_shop", 31, 14, 3, 3); A("crates", 34, 14, 1, 1); A("smithy", 35, 14, 4, 3); A("barrels", 39, 14, 1, 1); A("tavern", 40, 14, 5, 3);
    A("tavern_table", 40, 20, 2, 1); A("tavern_table", 43, 20, 2, 1); A("barrels", 45, 19, 1, 1);
    // atrás das casas do norte: casebre, torre de vigia e árvores
    A("cottage", 4, 8, 3, 3); A("tree", 9, 8, 3, 2); A("bush", 13, 7, 1, 1); A("bush", 15, 9, 1, 1);
    A("tree", 31, 8, 3, 2); A("bush", 35, 6, 1, 1); A("bush", 37, 9, 1, 1); A("tower", 41, 9, 2.4, 3);
    // sul: bairro pobre (oeste) e casas + bueiro (leste)
    A("cottage", 3, 26, 3, 3); A("cottage", 8, 26, 3, 3); A("well", 12, 25, 2, 2); A("crates", 14, 24, 1, 1);
    A("house_red", 30, 26, 3, 3); A("house_red", 34, 26, 3, 3); A("barrels", 37, 26, 1, 1); A("house_red", 42, 26, 3, 3);
    A("stall_red", 17, 25, 2, 1);
    // entrada: carroça, placa e árvores junto da muralha sul
    A("cart", 18, 31, 2, 1); A("signpost", 26, 31, 1, 1);
    for (const [x, y] of [[2, 31], [7, 31], [12, 31], [30, 31], [35, 31], [42, 31]]) A("tree", x, y, 3, 1);
    for (const [x, y] of [[16, 31], [28, 32], [2, 20], [45, 24], [16, 22], [31, 23]]) A("bush", x, y, 1, 1);
    // lampiões (praça, avenida e ruas)
    this.lamps = [];
    for (const [x, y] of [[17, 11], [30, 11], [17, 21], [30, 21], [22, 24], [25, 24], [22, 30], [25, 30], [8, 18], [14, 18], [33, 18], [38, 18], [20, 28], [36, 29]])
      this.lamps.push(A("lamp", x, y, 0.55, 1));
    // NPCs e lugares
    this.zones.push({ name: "Seu baú do depot", kind: "locker", x: 4, y: 15, w: 2, h: 1 });
    this.npc("npc_depot_guard", 7, 15, "Guarda do Depot", "depot", { x: 6, y: 15, w: 2, h: 2 });
    this.npc("npc_potion_seller", 34, 15, "Vendedora de Poções", "potions", { x: 31, y: 15, w: 4, h: 2 });
    this.npc("npc_smith", 37, 15, "Ferreiro", "smith", { x: 35, y: 15, w: 4, h: 2 });
    this.zones.push({ name: "Porta da torre", kind: "tower", x: 41, y: 10, w: 3, h: 1 });
    this.zones.push({ name: "Templo de Magdha", kind: "hall", x: 22, y: 10, w: 4, h: 1 });
    // bueiro do esgoto no beco do sul
    this.manhole = { x: 40, y: 30 };
    const mh = this.add.image(40 * T + T / 2, 30 * T + T / 2, "decor_manhole").setDepth(-5);
    mh.setScale(T * 0.9 / mh.width); this.world.add(mh);
    this.zones.push({ name: "Entrada dos Esgotos", kind: "sewer", x: 39, y: 29, w: 3, h: 2 });
    this.zones.push({ name: "Portão de Karhyn", kind: "gate", x: 23, y: TOWN_H - 2, w: 2, h: 2, step: true });
  }

  npc(tex, x, y, name, kind, zone) {
    const idle = tex + "_idle", anim = this.anims.exists(idle);
    const s = (anim ? this.add.sprite(x * T + T / 2, y * T + T - 4, idle).play({ key: idle, startFrame: Phaser.Math.Between(0, 7) }) : this.add.image(x * T + T / 2, y * T + T - 4, tex)).setOrigin(0.5, 1).setScale(0.42).setTint(TOWN_TINT).setDepth(y * T + T - 4);
    const sh = this.add.image(s.x, s.y - 3, "shadow").setScale(0.9, 0.3).setDepth(s.depth - 1);
    this.world.add([sh, s]);
    this.block(x, y, 1, 1);
    if (!anim) this.tweens.add({ targets: s, scaleY: 0.42 * 1.015, duration: 1500, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.zones.push({ name, kind, ...zone });
  }

  // ------------------------------------------------------------ herói
  spawnHero() {
    const from = this.registry.get("townSpawn") || "gate", pos = this.registry.get("townPos");
    const [x, y] = from === "here" && pos ? pos : from === "sewer" ? [40, 28] : [24, 29];
    const h = this.hero = { x, y, px: x * T + T / 2, py: y * T + T - 4, moveT: 0, facing: from === "sewer" ? [0, 1] : [0, -1], lookLeft: false };
    h.shadow = this.add.image(h.px, h.py - 3, "shadow").setScale(0.9, 0.3);
    const ap = vocAnim(this.vocId);
    h.spr = this.add.sprite(h.px, h.py + 4, ap + "idle_up").setOrigin(0.5, 1).setScale(vocScale(this.vocId)).play(from === "sewer" ? ap + "idle_down" : ap + "idle_up");
    this.world.add([h.shadow, h.spr]);
    const cam = this.cameras.main;
    cam.setBounds(0, 0, TOWN_W * T, TOWN_H * T);
    cam.setZoom(this.zoom());
    cam.startFollow(h.spr, true, 0.35, 0.35, 0, 24);
  }
  zoom() { return Phaser.Math.Clamp(Settings.data.zoom || 2.8, 2, 3.6); }
  zoomBy(d) { Settings.data.zoom = Math.round(Phaser.Math.Clamp(this.zoom() + d, 2, 3.6) * 10) / 10; Settings.save(); this.cameras.main.setZoom(this.zoom()); }

  update(_, dtMs) {
    const dt = Math.min(0.05, dtMs / 1000), h = this.hero;
    if (this.dayTint) { this.skyUpdate(dt); this.miniUpdate(); }
    if (h.moveT > 0) {
      h.moveT = Math.max(0, h.moveT - dt);
      const k = 1 - h.moveT / h.moveLen;
      h.px = Phaser.Math.Linear(h.fromX, h.toX, k); h.py = Phaser.Math.Linear(h.fromY, h.toY, k);
      if (h.moveT === 0) this.arrived();
    }
    if (h.moveT === 0 && !this.dialog && !this.leaving) {
      const d = a => (this.keysIn[a] || []).some(k => k.isDown);
      let dx = (d("right") ? 1 : 0) - (d("left") ? 1 : 0), dy = (d("down") ? 1 : 0) - (d("up") ? 1 : 0);
      if (dx || dy) this.tryMove(dx, dy);
    }
    if (h.moveT > 0) h.walkHold = 0.12; else h.walkHold = Math.max(0, (h.walkHold || 0) - dt);
    const [fx, fy] = h.facing, dir = fx ? "side" : (fy < 0 ? "up" : "down");
    if (fx) h.lookLeft = fx < 0;
    const anim = vocAnim(this.vocId) + (h.walkHold > 0 ? "walk" : "idle") + "_" + dir;
    if (h.spr.anims.currentAnim.key !== anim) h.spr.play(anim, true);
    h.spr.setFlipX(dir === "side" && h.lookLeft).setTint(TOWN_TINT);
    h.spr.setPosition(Math.round(h.px), Math.round(h.py + 4)).setDepth(h.py);
    if (this.gateImg) this.gateImg.setDepth(h.y >= TOWN_H - 3 ? h.py + 1 : 29 * T);
    h.shadow.setPosition(h.px, h.py - 3).setDepth(h.py - 1);
    // dica de interação
    const z = this.zoneHere();
    this.hint.setText(z && !z.step && !this.dialog ? `E · ${z.name}` : "");
  }

  tryMove(dx, dy) {
    const h = this.hero;
    h.facing = [dx, dy];
    if (dx && dy && (this.isSolid(h.x + dx, h.y) || this.isSolid(h.x, h.y + dy))) {
      // diagonal travada: tenta só um dos eixos
      if (!this.isSolid(h.x + dx, h.y)) dy = 0; else if (!this.isSolid(h.x, h.y + dy)) dx = 0; else return;
      h.facing = [dx, dy];
    }
    const nx = h.x + dx, ny = h.y + dy;
    if (this.isSolid(nx, ny)) return;
    h.fromX = h.px; h.fromY = h.py; h.x = nx; h.y = ny;
    h.toX = nx * T + T / 2; h.toY = ny * T + T - 4;
    h.moveLen = h.moveT = (dx && dy ? 0.36 : 0.264) / (Settings.data.speed ? Settings.data.speed / 0.75 : 1);
  }

  arrived() {
    const z = this.zoneHere();
    if (z && z.step) this.use(z);
  }

  zoneHere() {
    const h = this.hero;
    return this.zones.find(z => h.x >= z.x && h.x < z.x + z.w && h.y >= z.y && h.y < z.y + z.h);
  }

  interact() {
    if (this.dialog) return;
    const z = this.zoneHere();
    if (z) this.use(z);
  }

  use(z) {
    const V = VOCATIONS[this.vocId], d = Save.voc(this.vocId);
    if (z.kind === "gate") {
      this.say("Portão de Karhyn", "Deixar a cidadela e voltar ao mapa?", [["Sair da cidade", () => this.leave("map")], ["Ficar", () => this.closeDialog()]]);
    } else if (z.kind === "sewer") {
      const max = (Save.data.diffMax || {})["karhyn_sewers:" + this.vocId] || 1;
      let cur = Math.min(this.registry.get("difficulty") || max, max);
      const pct = v => Math.round(v * 100) + "%";
      const opts = [["Descer — " + pct(cur), () => { this.registry.set("region", "karhyn_sewers"); this.registry.set("difficulty", cur); this.leave("dungeon"); }]];
      if (cur < max) opts.push(["Dificuldade ▲", () => { this.registry.set("difficulty", cur + 0.25); this.use(z); }]);
      if (cur > 1) opts.push(["Dificuldade ▼", () => { this.registry.set("difficulty", cur - 0.25); this.use(z); }]);
      opts.push(["Ainda não", () => this.closeDialog()]);
      this.say("Entrada dos Esgotos", `A grade range com o vento que sobe lá de baixo. Ratos guincham na escuridão.\n\nDificuldade: ${pct(cur)} (liberada até ${pct(max)}). Vencer o esgoto na dificuldade máxima libera +25%, até 400%. Monstros mais fortes dão mais xp.`, opts);
    } else if (z.kind === "potions") {
      const n = Object.values(d.potions).reduce((a, b) => a + b, 0);
      this.say("Vendedora de Poções", `"Frascos frescos, ${V.name.toLowerCase()}. Vida, fúria e outras misturas da casa."\n\nNa sua mochila: ${n} poção(ões).  Ouro: ◉ ${d.gold}`,
        [["Ver as poções", () => { this.registry.set("shopFrom", "town"); this.registry.set("shopTab", "potions"); this.leave("shop"); }], ["Até logo", () => this.closeDialog()]]);
    } else if (z.kind === "depot") {
      this.say("Guarda do Depot", `"Bem-vindo ao depot de Karhyn. Cada aventureiro tem seu baú nas cabines do fundo — o que guardar ali não se perde nas descidas."\n\nOuro guardado: ◉ ${d.gold}`,
        [["Abrir meu baú", () => this.openLocker()], ["Obrigado", () => this.closeDialog()]]);
    } else if (z.kind === "locker") {
      this.openLocker();
    } else if (z.kind === "smith") {
      this.say("Ferreiro", `"Traga sua lâmina quando estiver cega. Conserto, afio e reforço armas e armaduras."\n\nReparo e melhoria de equipamentos chegam junto com os equipamentos.`,
        [["Até mais", () => this.closeDialog()]]);
    } else if (z.kind === "tower") {
      this.say("Torre de Vigia", "A porta range. Uma escada em caracol sobe no escuro até o terraço.", [["Subir ao topo", () => this.towerView()], ["Ficar aqui", () => this.closeDialog()]]);
    } else if (z.kind === "hall") {
      this.say("Templo", "Os mestres de armas de Karhyn treinam quem paga em ouro: vida, velocidade de ataque, armadura e fúria.",
        [["Treinar atributos", () => { this.registry.set("shopFrom", "town"); this.registry.set("shopTab", "train"); this.leave("shop"); }], ["Sair", () => this.closeDialog()]]);
    }
  }

  leave(scene) {
    if (this.leaving) return;
    this.leaving = true; this.closeDialog();
    this.registry.set("townSpawn", scene === "dungeon" ? "sewer" : "gate");
    this.registry.set("townPos", [this.hero.x, this.hero.y]);
    if (scene === "dungeon") this.sound.stopAll();
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start(scene));
  }

  // ------------------------------------------------------------ interface
  buildUi() {
    const ui = this.uiLayer;
    ui.add(txt(this, 14, 10, "Cidadela de Karhyn", 22, COLORS.gold));
    this.goldT = txt(this, VIEW_W - 14, 14, `${VOCATIONS[this.vocId].name} · ◉ ${Save.gold(this.vocId)}`, 14, COLORS.gold).setOrigin(1, 0);
    ui.add(this.goldT);
    ui.add(txt(this, 14, VIEW_H - 22, "WASD/setas: andar · E: falar/usar · Esc: menu · roda: zoom", 11, COLORS.dim));
    this.hint = txt(this, VIEW_W / 2, VIEW_H - 70, "", 16, COLORS.text).setOrigin(0.5);
    ui.add(this.hint);
    if (this.textures.exists("vignette")) ui.addAt(this.add.image(0, 0, "vignette").setOrigin(0).setAlpha(0.55), 0);
    // relógio: ícone de sol/lua e a hora
    this.skyIcon = this.add.graphics(); ui.add(this.skyIcon);
    this.skyText = txt(this, VIEW_W - 44, 40, "", 12, COLORS.text).setOrigin(1, 0.5); ui.add(this.skyText);
    // minimapa: chão, construções, NPCs e o bueiro piscando
    const S = 4, mx = VIEW_W - TOWN_W * S - 10, my = VIEW_H - TOWN_H * S - 10;
    this.mini = { S, x: mx, y: my };
    const base = this.add.graphics(); ui.add(base);
    base.fillStyle(0x000000, 0.6).fillRect(mx - 3, my - 3, TOWN_W * S + 6, TOWN_H * S + 6);
    for (let y = 0; y < TOWN_H; y++) for (let x = 0; x < TOWN_W; x++) {
      const t = this.ground[y][x];
      let c = t === "w" ? 0x55524c : t === "c" || t === "s" ? 0x7a746a : t === "p" ? 0x9a948a : t === "d" ? 0x6a5236 : 0x2e3a26;
      if (t !== "w" && this.solid.has(this.key(x, y))) c = 0x8a3a2a;
      base.fillStyle(c, 1).fillRect(mx + x * S, my + y * S, S, S);
    }
    base.lineStyle(1, 0xc8a050, 0.8).strokeRect(mx - 3, my - 3, TOWN_W * S + 6, TOWN_H * S + 6);
    this.miniDyn = this.add.graphics(); ui.add(this.miniDyn);
    ui.add(txt(this, mx, my - 16, "Bueiro do esgoto", 10, "#7fe08a"));
  }

  // ------------------------------------------------------------ hora do dia, chuva e minimapa
  // ciclo completo de 6 minutos; a hora continua de uma visita para a outra
  skyUpdate(dt) {
    let t = ((this.registry.get("townClock") ?? 0.38) + dt / 360) % 1;
    this.registry.set("townClock", t);
    // escuridão 0 (dia) .. 1 (noite): dia 0,30–0,62, entardecer até 0,75, noite até 0,18, amanhecer até 0,30
    const d = t < 0.18 ? 1 : t < 0.30 ? 1 - (t - 0.18) / 0.12 : t < 0.62 ? 0 : t < 0.75 ? (t - 0.62) / 0.13 : 1;
    const dusk = (t > 0.6 && t < 0.78) ? 1 - Math.abs(t - 0.69) / 0.09 : (t > 0.16 && t < 0.32) ? 1 - Math.abs(t - 0.24) / 0.08 : 0;
    const lerp = (a, b, k) => Math.round(a + (b - a) * k), rain = this.raining ? 0.85 : 1;
    let r = lerp(224, 52, d), g = lerp(228, 62, d), b = lerp(236, 104, d);
    r = lerp(r, 232, dusk * 0.6); g = lerp(g, 150, dusk * 0.6); b = lerp(b, 110, dusk * 0.6);
    this.dayTint.setFillStyle(Phaser.Display.Color.GetColor(r * rain | 0, g * rain | 0, b * rain | 0), 1);
    // postes acendem ao anoitecer, com a chama tremendo
    const now = this.time.now / 1000;
    for (const gl of this.lampGlows) gl.setAlpha((0.12 + 0.55 * d) * (0.85 + 0.15 * Math.sin(now * 9 + gl.ph))).setScale(0.45 + 0.25 * d);
    // ícone
    const ic = this.skyIcon, cx = VIEW_W - 26, cy = 40, night = d > 0.5;
    ic.clear();
    if (night) { ic.fillStyle(0xdfe6f2, 1).fillCircle(cx, cy, 9); ic.fillStyle(0x10141e, 1).fillCircle(cx + 5, cy - 3, 8); }
    else { ic.fillStyle(0xf2c050, 1).fillCircle(cx, cy, 7); ic.lineStyle(2, 0xf2c050, 1); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; ic.lineBetween(cx + Math.cos(a) * 10, cy + Math.sin(a) * 10, cx + Math.cos(a) * 13, cy + Math.sin(a) * 13); } }
    if (this.raining) { ic.fillStyle(0x8a94a4, 1).fillEllipse(cx - 4, cy + 6, 18, 9); }
    const hour = Math.floor(((t * 24) + 0) % 24), min = Math.floor((t * 24 * 60) % 60);
    this.skyText.setText(`${night ? "Noite" : dusk > 0.4 ? (t < 0.5 ? "Amanhecer" : "Entardecer") : "Dia"}${this.raining ? " · chuva" : ""}  ${String(hour).padStart(2, "0")}:${String(min - min % 10).padStart(2, "0")}`);
    // chuva de vez em quando: 1 a 2 minutos, com intervalos de 1,5 a 4 minutos
    this.rainT -= dt;
    if (this.rainT <= 0) {
      this.raining = !this.raining;
      this.rainT = this.raining ? Phaser.Math.Between(60, 120) : Phaser.Math.Between(90, 240);
      this.rainFx.emitting = this.raining;
    }
    this.rainVeil.setAlpha(Phaser.Math.Linear(this.rainVeil.alpha, this.raining ? 0.18 : 0, 0.02));
  }

  miniUpdate() {
    const m = this.mini, g = this.miniDyn, S = m.S, h = this.hero;
    g.clear();
    const blink = 0.5 + 0.5 * Math.sin(this.time.now / 180);
    g.fillStyle(0x7fe08a, 0.4 + 0.6 * blink).fillCircle(m.x + (this.manhole.x + 0.5) * S, m.y + (this.manhole.y + 0.5) * S, 4);
    for (const z of this.zones) if (["depot", "potions", "smith", "hall", "tower"].includes(z.kind)) g.fillStyle(0xe0bc60, 1).fillRect(m.x + (z.x + z.w / 2) * S - 1, m.y + (z.y + z.h / 2) * S - 1, 3, 3);
    g.fillStyle(0xffffff, 1).fillRect(m.x + h.x * S, m.y + h.y * S, S, S);
  }

  // retrato do NPC: rosto recortado do 1º quadro da animação parada
  portrait(title) {
    const SRC = { "Guarda do Depot": ["npc_depot_guard_idle", 54], "Vendedora de Poções": ["npc_potion_seller_idle", 64], "Ferreiro": ["npc_smith_idle", 64] };
    const e = SRC[title]; if (!e || !this.textures.exists(e[0])) return null;
    const key = "portrait_" + e[0];
    if (!this.textures.exists(key)) {
      const ct = this.textures.createCanvas(key, 73, 73), cc = ct.getContext(); cc.imageSmoothingEnabled = false;
      cc.drawImage(this.textures.get(e[0]).getSourceImage(), e[1], 20, 73, 73, 0, 0, 73, 73); ct.refresh();
    }
    return key;
  }

  // conversa em formato de chat: balões do NPC à esquerda, suas respostas à direita, opções clicáveis embaixo.
  // Responder mostra a sua fala no chat e depois a reação; seguir conversando com o mesmo NPC mantém o histórico.
  say(title, body, buttons) {
    if (!(this.dialog && this.chatWith === title)) { this.closeDialog(); this.chatLog = []; }
    else { this.dialog.destroy(); this.dialog = null; }
    this.chatWith = title;
    this.chatLog.push({ me: false, text: body });
    const c = this.add.container(0, 0); this.uiLayer.add(c); this.dialog = c;
    const w = 640, x = VIEW_W / 2 - w / 2, pad = 18, maxW = w - 2 * pad - 120;
    const port = this.portrait(title);
    const bubbles = this.chatLog.map(m => {
      const t = txt(this, 0, 0, m.text, 13, m.me ? "#1a140c" : COLORS.text, { wordWrap: { width: maxW - 20 }, lineSpacing: 3 });
      return { m, t, h: t.height + 16 };
    });
    let used = 0, first = bubbles.length;
    while (first > 0 && used + bubbles[first - 1].h + 8 <= 230) { first--; used += bubbles[first].h + 8; }
    bubbles.slice(0, first).forEach(bb => bb.t.destroy());
    const optH = 34, header = 70, hgt = header + used + 14 + buttons.length * (optH + 6) + 10, y = VIEW_H - hgt - 12;
    c.add(this.add.nineslice(x, y, "panel", null, w, hgt, 16, 16, 16, 16).setOrigin(0).setInteractive());
    if (port) {
      c.add(this.add.rectangle(x + pad, y + pad - 4, 56, 56, 0x0c0a08).setOrigin(0).setStrokeStyle(2, 0xc8a050));
      c.add(this.add.image(x + pad + 28, y + pad + 24, port).setDisplaySize(52, 52));
    }
    c.add(txt(this, x + pad + (port ? 70 : 0), y + pad + 10, title, 20, COLORS.gold));
    let cy = y + header;
    for (const bb of bubbles.slice(first)) {
      const bw = Math.min(maxW, bb.t.width + 20), bx = bb.m.me ? x + w - pad - bw : x + pad;
      c.add(this.add.rectangle(bx, cy, bw, bb.h, bb.m.me ? 0xc8a050 : 0x2a241c, bb.m.me ? 0.92 : 0.95).setOrigin(0).setStrokeStyle(1, bb.m.me ? 0xe8cc80 : 0x5a4c38));
      bb.t.setPosition(bx + 10, cy + 8); c.add(bb.t);
      cy += bb.h + 8;
    }
    this.dialogBtns = [];
    let oy = y + header + used + 14;
    buttons.forEach(([label, fn], i) => {
      const bw = w - 2 * pad, bx = x + pad;
      const r = this.add.rectangle(bx, oy, bw, optH, 0x1a1612, 0.95).setOrigin(0).setStrokeStyle(1, 0x7a6440).setInteractive({ useHandCursor: true });
      const t = txt(this, bx + 14, oy + optH / 2, `${i + 1}  ›  ${label}`, 14, COLORS.text).setOrigin(0, 0.5);
      const send = () => {
        if (!this.dialog || this.sending) return;
        this.sending = true;
        const keep = this.chatWith, n = this.chatLog.length;
        this.chatLog.push({ me: true, text: label });
        r.setFillStyle(0xc8a050, 0.9); t.setColor("#1a140c");
        // a sua fala aparece por um instante; depois a reação (nova fala, loja, fechar...)
        this.time.delayedCall(220, () => {
          this.sending = false; fn();
          if (this.dialog && this.chatWith === keep && this.chatLog.length === n + 1) this.closeDialog();
        });
      };
      r.on("pointerover", () => this.dialogSelect(i));
      r.on("pointerup", send);
      c.add([r, t]); this.dialogBtns.push({ b: r, t, fn: send });
      oy += optH + 6;
    });
    this.dialogAt = this.time.now;
    this.dialogSelect(0);
  }
  // baú do depot: passa poções entre a mochila e o depot (clique = 1, Shift+clique = todas)
  openLocker() {
    this.closeDialog();
    const d = Save.voc(this.vocId); d.depot = d.depot || { potions: {} };
    const c = this.add.container(0, 0); this.uiLayer.add(c); this.dialog = c;
    c.add(this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x000000, 0.55).setOrigin(0).setInteractive());
    const w = 700, h = 380, x = VIEW_W / 2 - w / 2, y = VIEW_H / 2 - h / 2;
    c.add(this.add.nineslice(x, y, "panel", null, w, h, 16, 16, 16, 16).setOrigin(0));
    c.add(txt(this, VIEW_W / 2, y + 26, "Depot de Karhyn", 24, COLORS.gold).setOrigin(0.5));
    c.add(txt(this, VIEW_W / 2, y + 52, "Clique num item para passar 1 · Shift+clique passa todos", 11, COLORS.dim).setOrigin(0.5));
    const grid = (title, store, other, gx) => {
      c.add(txt(this, gx + 150, y + 78, title, 16, COLORS.text).setOrigin(0.5));
      for (let i = 0; i < 12; i++) {
        const sx = gx + 12 + (i % 4) * 72, sy = y + 100 + Math.floor(i / 4) * 72;
        c.add(this.add.nineslice(sx, sy, "slot", null, 64, 64, 4, 4, 4, 4).setOrigin(0));
      }
      Object.keys(store).filter(id => store[id] > 0 && POTIONS[id]).forEach((id, i) => {
        const P = POTIONS[id], sx = gx + 12 + (i % 4) * 72 + 32, sy = y + 100 + Math.floor(i / 4) * 72 + 30;
        const ic = this.add.image(sx, sy, P.icon).setInteractive({ useHandCursor: true }); ic.setScale(36 / Math.max(ic.width, ic.height)); if (P.tint) ic.setTint(P.tint);
        ic.on("pointerup", p => {
          const n = p.event.shiftKey ? store[id] : 1;
          store[id] -= n; other[id] = (other[id] || 0) + n; Save.save(); sfx(this, "pickup", 0.4); this.openLocker();
        });
        c.add([ic, txt(this, sx + 26, sy + 24, "×" + store[id], 12, COLORS.text).setOrigin(1)]);
      });
    };
    grid("Mochila", d.potions, d.depot.potions, x + 30);
    grid("Baú do depot", d.depot.potions, d.potions, x + w - 330);
    c.add(txt(this, VIEW_W / 2, y + 140, "⇄", 30, COLORS.gold).setOrigin(0.5));
    c.add(txt(this, x + 30, y + h - 44, `Ouro: ◉ ${d.gold}   ·   equipamentos também ficarão aqui quando chegarem`, 12, COLORS.dim));
    const [b, t] = button(this, x + w - 100, y + h - 38, 140, "Fechar", () => this.closeDialog(), 14); c.add([b, t]);
  }
  // vista do alto da torre: o horizonte de Karhyn (provisório: o mapa da região até chegar a arte própria)
  towerView() {
    this.closeDialog();
    const c = this.add.container(0, 0).setAlpha(0); this.uiLayer.add(c); this.dialog = c;
    c.add(this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x000000, 1).setOrigin(0).setInteractive());
    const img = this.add.image(VIEW_W / 2, VIEW_H / 2, "tower_view").setScale(VIEW_W / 512 * 1.08);
    c.add(img);
    this.tweens.add({ targets: img, x: VIEW_W / 2 - 30, scale: VIEW_W / 512 * 1.14, duration: 20000, ease: "Sine.inOut", yoyo: true, repeat: -1 });
    for (let i = 0; i < 6; i++) {
      const f = this.add.image(Phaser.Math.Between(-200, VIEW_W), Phaser.Math.Between(40, VIEW_H - 80), "light").setScale(3, 0.9).setTint(0xc8d0d8).setAlpha(0.07);
      c.add(f); this.tweens.add({ targets: f, x: f.x + VIEW_W + 400, duration: Phaser.Math.Between(25000, 40000), repeat: -1, onRepeat: () => { f.x = -400; } });
    }
    if (this.textures.exists("vignette")) c.add(this.add.image(0, 0, "vignette").setOrigin(0));
    c.add(txt(this, VIEW_W / 2, 30, "Do alto da torre de vigia", 24, COLORS.gold).setOrigin(0.5));
    c.add(txt(this, VIEW_W / 2, 58, "O vento corta. Ao longe: a Encosta dos Goblins, o Acampamento Orc, a Torre das Amazonas e as Terras Espectrais.", 12, COLORS.text).setOrigin(0.5));
    const [b, t] = button(this, VIEW_W / 2, VIEW_H - 40, 200, "Descer", () => this.tweens.add({ targets: c, alpha: 0, duration: 500, onComplete: () => this.closeDialog() }), 15);
    c.add([b, t]);
    this.tweens.add({ targets: c, alpha: 1, duration: 700 });
  }
  dialogSelect(i) {
    if (!this.dialogBtns || !this.dialogBtns.length) return;
    this.dialogSel = (i + this.dialogBtns.length) % this.dialogBtns.length;
    this.dialogBtns.forEach((o, k) => { if (o.b && o.b.setStrokeStyle) o.b.setStrokeStyle(k === this.dialogSel ? 2 : 1, k === this.dialogSel ? 0xe8cc80 : 0x7a6440); });
  }
  dialogKey(ev) {
    if (!this.dialog || !this.dialogBtns || !this.dialogBtns.length || this.sending || this.time.now - (this.dialogAt || 0) < 180) return;
    const n = parseInt(ev.key, 10);
    if (n >= 1 && n <= this.dialogBtns.length) return this.dialogBtns[n - 1].fn();
    if (ev.key === "ArrowUp" || ev.key === "ArrowLeft") return this.dialogSelect(this.dialogSel - 1);
    if (ev.key === "ArrowDown" || ev.key === "ArrowRight") return this.dialogSelect(this.dialogSel + 1);
    if (ev.key === "Enter" || ev.key === " " || ev.key === "e" || ev.key === "E") this.dialogBtns[this.dialogSel || 0].fn();
  }
  closeDialog() { if (this.dialog) { this.dialog.destroy(); this.dialog = null; } this.dialogBtns = null; this.chatWith = null; this.sending = false; }

  openMenu() {
    this.say("Karhyn", "O que deseja fazer?", [["Voltar ao mapa", () => this.leave("map")], ["Continuar", () => this.closeDialog()]]);
  }

  // ------------------------------------------------------------ atmosfera
  ambience() {
    // tom frio de fim de tarde nublado; luz quente nos postes; névoa baixa passando
    const W = TOWN_W * T, H = TOWN_H * T;
    // luz do dia: um véu em MULTIPLY cuja cor muda com a hora (dia, entardecer, noite, amanhecer)
    this.dayTint = this.add.rectangle(0, 0, W, H, 0xffffff, 1).setOrigin(0).setDepth(800000).setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.world.add(this.dayTint);
    this.lampGlows = [];
    for (const l of this.lamps) {
      const g = this.add.image(l.x, l.y - l.displayHeight * 0.86, "light").setTint(0xffa040).setBlendMode(Phaser.BlendModes.ADD).setScale(0.5).setAlpha(0.35).setDepth(800001);
      this.world.add(g); this.lampGlows.push(g); g.ph = Math.random() * 10;
    }
    // chuva: gotas na tela inteira (camada da interface) e respingos no chão
    if (!this.textures.exists("rain_drop")) { const gr = this.make.graphics({ add: false }); gr.fillStyle(0xffffff).fillRect(0, 0, 1, 12); gr.generateTexture("rain_drop", 1, 12); gr.destroy(); }
    this.rainFx = this.add.particles(0, 0, "rain_drop", { x: { min: -40, max: VIEW_W + 80 }, y: -20, lifespan: 900, speedY: { min: 520, max: 680 }, speedX: { min: -90, max: -60 },
      rotate: 8, alpha: { start: 0.45, end: 0.25 }, tint: 0xb4c4dc, quantity: 3, frequency: 12, emitting: false });
    this.uiLayer.addAt(this.rainFx, 1);
    this.rainVeil = this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x10141e, 0).setOrigin(0); this.uiLayer.addAt(this.rainVeil, 1);
    this.raining = false; this.rainT = Phaser.Math.Between(40, 120);
    for (let i = 0; i < 8; i++) {
      const f = this.add.image(Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), "light").setScale(Phaser.Math.FloatBetween(3, 5), Phaser.Math.FloatBetween(0.8, 1.2))
        .setTint(0xc8d0d8).setAlpha(Phaser.Math.FloatBetween(0.04, 0.08)).setDepth(800002);
      this.world.add(f);
      this.tweens.add({ targets: f, x: f.x + W, duration: Phaser.Math.Between(40000, 70000), repeat: -1, onRepeat: () => { f.x = -600; } });
    }
    // chama dos postes tremendo
    for (const l of this.lamps) {
      const fl = this.add.image(l.x, l.y - l.displayHeight * 0.88, "light").setTint(0xffc060).setBlendMode(Phaser.BlendModes.ADD).setScale(0.07, 0.09).setDepth(l.depth + 1);
      this.world.add(fl);
      this.tweens.add({ targets: fl, scaleX: 0.05, scaleY: 0.1, alpha: 0.7, duration: Phaser.Math.Between(90, 160), yoyo: true, repeat: -1 });
    }
    // fonte: ondas na bacia
    const fx0 = this.fountain.x, fy0 = this.fountain.y - this.fountain.displayHeight * 0.42;
    for (let i = 0; i < 3; i++) {
      const r = this.add.ellipse(fx0, fy0, 20, 8).setStrokeStyle(2, 0xbfe0f0, 0.5).setDepth(this.fountain.depth + 1); this.world.add(r);
      this.tweens.add({ targets: r, scaleX: 4, scaleY: 4, alpha: 0, duration: 2200, delay: i * 730, repeat: -1 });
    }
    // água da fonte: respingos
    const fx = this.fountain.x, fy = this.fountain.y - this.fountain.displayHeight * 0.55;
    const p = this.add.particles(fx, fy, "light", { lifespan: 700, speedY: { min: -60, max: -30 }, speedX: { min: -18, max: 18 }, gravityY: 160,
      scale: { start: 0.02, end: 0.005 }, alpha: { start: 0.7, end: 0 }, tint: 0xcfe4ff, frequency: 70 });
    p.setDepth(this.fountain.depth + 1); this.world.add(p);
  }

  // ------------------------------------------------------------ artes provisórias (até chegarem as do SpriteCook)
  makePlaceholders() {
    const mk = (key, w, h, draw) => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ x: 0, y: 0, add: false }); draw(g, w, h); g.generateTexture(key, w, h); g.destroy();
    };
    const stone = 0x6e6a64, stoneD = 0x4a4744, stoneL = 0x8e8a82, roof = 0x7a2e24, roofD = 0x5a2018, roofL = 0x94402e,
      plaster = 0xcfc4ae, beam = 0x3a2a1e, green = 0x2e5a34, greenD = 0x1e3e24, thatch = 0x9a7a3a, thatchD = 0x6e5422;
    const banner = (g, x, y, h) => { g.fillStyle(0x2a2420).fillRect(x + 4, y - 14, 2, h + 14); g.fillStyle(green).fillRect(x, y, 10, h); g.fillStyle(greenD).fillRect(x + 7, y, 3, h); g.fillTriangle(x, y + h, x + 10, y + h, x + 5, y + h + 6); g.fillStyle(0xc8a050).fillRect(x + 3, y + 6, 4, 4); };
    // casa de enxaimel com telhado de telha
    const house = (g, w, h, thatched) => {
      const wallTop = Math.round(h * 0.52);
      g.fillStyle(plaster).fillRect(6, wallTop, w - 12, h - wallTop);
      g.fillStyle(beam); for (let x = 6; x < w - 6; x += 30) g.fillRect(x, wallTop, 5, h - wallTop);
      g.fillRect(6, wallTop, w - 12, 5); g.fillRect(6, h - 6, w - 12, 6);
      g.fillStyle(0x2a1c12).fillRect(w / 2 - 12, h - 44, 24, 38); g.fillStyle(0x4a3220).fillRect(w / 2 - 9, h - 41, 18, 35);
      for (const x of [26, w - 46]) { g.fillStyle(beam).fillRect(x - 2, wallTop + 16, 24, 22); g.fillStyle(0xe0a040).fillRect(x + 2, wallTop + 20, 16, 14); g.fillStyle(beam).fillRect(x + 9, wallTop + 20, 2, 14); }
      const c = thatched ? thatch : roof, cd = thatched ? thatchD : roofD, cl = thatched ? 0xb8964a : roofL;
      g.fillStyle(c).fillTriangle(0, wallTop + 4, w, wallTop + 4, w / 2, 4); g.fillRect(0, wallTop - 10, w, 14);
      g.fillStyle(cd); for (let y = 14; y < wallTop; y += 9) g.fillRect(Math.max(2, w / 2 - (y - 4) * w / 2 / wallTop), y, Math.min(w - 4, (y - 4) * w / wallTop), 2);
      g.fillStyle(cl).fillRect(w / 2 - 2, 6, 4, wallTop - 6);
      if (!thatched) { g.fillStyle(stoneD).fillRect(w * 0.7, 10, 14, 26); g.fillStyle(stone).fillRect(w * 0.7 + 2, 10, 10, 4); }
    };
    mk("town_house_red", 160, 150, (g, w, h) => house(g, w, h, false));
    mk("town_house_thatch", 170, 150, (g, w, h) => house(g, w, h, true));
    // salão de colunas: telhado, frontão, colunas brancas com estandartes verdes, degraus
    mk("town_hall", 420, 260, (g, w, h) => {
      g.fillStyle(roofD).fillRect(10, 20, w - 20, 80); g.fillStyle(roof); for (let y = 24; y < 96; y += 10) g.fillRect(12, y, w - 24, 6);
      g.fillStyle(stoneL).fillTriangle(w / 2 - 70, 100, w / 2 + 70, 100, w / 2, 50); g.fillStyle(stone).fillRect(w / 2 - 70, 96, 140, 6);
      g.fillStyle(0xd8d0c0).fillRect(16, 100, w - 32, 16);
      g.fillStyle(stoneD).fillRect(24, 116, w - 48, 104);
      for (let x = 30, i = 0; x < w - 40; x += 46, i++) {
        g.fillStyle(0xe8e0d0).fillRect(x, 116, 18, 104); g.fillStyle(0xb8b0a0).fillRect(x + 13, 116, 5, 104);
        if (i % 2 === 1 && Math.abs(x - w / 2) > 30) banner(g, x + 24, 124, 50);
      }
      g.fillStyle(0x1a1410).fillRect(w / 2 - 22, 150, 44, 70);
      g.fillStyle(stone).fillRect(14, 220, w - 28, 12); g.fillStyle(stoneL).fillRect(30, 232, w - 60, 12); g.fillStyle(stone).fillRect(50, 244, w - 100, 14);
    });
    // torre de vigia: pedra, janelas estreitas, terraço com árvore e estandartes
    mk("town_tower", 130, 320, (g, w, h) => {
      g.fillStyle(stone).fillRect(18, 70, w - 36, h - 70); g.fillStyle(stoneD).fillRect(w - 36, 70, 18, h - 70);
      g.fillStyle(stoneD); for (let y = 90; y < h; y += 22) for (let x = 22 + ((y / 22) % 2) * 10; x < w - 40; x += 22) g.fillRect(x, y, 14, 2);
      for (const y of [120, 190, 250]) { g.fillStyle(0x14100c).fillRect(w / 2 - 6, y, 12, 26); g.fillStyle(stoneL).fillRect(w / 2 - 8, y - 4, 16, 4); }
      g.fillStyle(stoneL).fillRect(8, 56, w - 16, 18); g.fillStyle(roof).fillRect(8, 70, w - 16, 6);
      g.fillStyle(stoneL); for (let x = 8; x < w - 12; x += 20) g.fillRect(x, 44, 12, 14);
      g.fillStyle(0x3a2a1a).fillRect(w / 2 - 3, 26, 6, 26);
      g.fillStyle(0x2e4a26).fillCircle(w / 2, 22, 22); g.fillStyle(0x3e6030).fillCircle(w / 2 - 8, 16, 12); g.fillCircle(w / 2 + 10, 20, 10);
      banner(g, 6, 70, 70); banner(g, w - 16, 70, 70);
    });
    // portão: arco central entre duas torres com ameias, portas abertas e estandartes
    mk("town_gate", 400, 300, (g, w, h) => {
      const tw = 110;
      g.fillStyle(stone).fillRect(0, 60, tw, h - 60).fillRect(w - tw, 60, tw, h - 60);
      g.fillStyle(stoneD).fillRect(tw - 18, 60, 18, h - 60).fillRect(w - 18, 60, 18, h - 60);
      g.fillStyle(stoneL); for (let x = 0; x < tw; x += 24) { g.fillRect(x, 40, 14, 20); g.fillRect(w - tw + x, 40, 14, 20); }
      g.fillStyle(stone).fillRect(tw, 100, w - 2 * tw, 70); g.fillStyle(stoneL); for (let x = tw; x < w - tw; x += 24) g.fillRect(x, 84, 14, 16);
      g.fillStyle(0x0e0c0a).fillRect(tw + 20, 140, w - 2 * tw - 40, h - 140); g.fillCircle(w / 2, 140, (w - 2 * tw - 40) / 2);
      g.fillStyle(0x4a3220).fillRect(tw + 20, 150, 24, h - 150).fillRect(w - tw - 44, 150, 24, h - 150);
      g.fillStyle(stoneD); for (let y = 80; y < h; y += 24) for (let x = 6; x < tw - 20; x += 26) { g.fillRect(x, y, 18, 2); g.fillRect(w - tw + x, y, 18, 2); }
      banner(g, 40, 60, 90); banner(g, w - 50, 60, 90);
      g.fillStyle(0x5a5650).fillRect(tw - 2, h - 46, 20, 46).fillRect(w - tw - 18, h - 46, 20, 46); g.fillCircle(tw + 8, h - 52, 9).fillCircle(w - tw - 8, h - 52, 9);
    });
    mk("town_fountain", 150, 110, (g, w, h) => {
      g.fillStyle(stoneD).fillEllipse(w / 2, h - 34, w - 4, 64); g.fillStyle(stone).fillEllipse(w / 2, h - 40, w - 4, 60);
      g.fillStyle(0x2a4a5a).fillEllipse(w / 2, h - 42, w - 26, 42); g.fillStyle(0x3e6a7a).fillEllipse(w / 2 - 10, h - 46, w - 70, 18);
      g.fillStyle(stoneL).fillRect(w / 2 - 7, 22, 14, h - 64); g.fillStyle(stone).fillRect(w / 2 - 14, 18, 28, 8);
      g.fillStyle(0xa8d0e0).fillRect(w / 2 - 2, 4, 4, 16);
    });
    mk("town_cypress", 50, 150, (g, w, h) => {
      g.fillStyle(0x3a2a1a).fillRect(w / 2 - 3, h - 14, 6, 14);
      g.fillStyle(0x1e3020).fillEllipse(w / 2, h / 2 - 6, w - 6, h - 20); g.fillStyle(0x2a4428).fillEllipse(w / 2 - 5, h / 2 - 12, w - 22, h - 46);
      g.fillStyle(0x36522e); for (let y = 20; y < h - 30; y += 12) g.fillRect(w / 2 - 8, y, 6, 4);
    });
    mk("town_lamp", 28, 120, (g, w, h) => {
      g.fillStyle(stoneD).fillRect(4, h - 10, w - 8, 10); g.fillStyle(0x1e1c1c).fillRect(w / 2 - 2, 26, 4, h - 34);
      g.fillStyle(0x1e1c1c).fillRect(4, 8, w - 8, 22); g.fillStyle(0xffb050).fillRect(8, 12, w - 16, 14); g.fillStyle(0x1e1c1c).fillTriangle(2, 9, w - 2, 9, w / 2, 0);
    });
  }
}
