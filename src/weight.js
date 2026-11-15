// Sistema de peso (capacidade em oz, como no Tibia).
// Todos começam com 200 oz; por nível: Cavaleiro +25, Arqueiro +18, magos +10.
// Contam: equipamentos vestidos, equipamentos na mochila e poções. Flechas e ouro não pesam.
// Quase cheio (90%+): 5% mais lento. Cheio (100%): 20% mais lento e não pega equipamentos do chão.
const CAP_BASE = 200, CAP_PER_LVL = { knight: 25, archer: 18, sorcerer: 10, druid: 10 };
const POTION_OZ = 1.5, CAP_NEAR = 0.9;
// peso base por tipo; cresce um pouco com a força do item (rank 0 → 1)
const SLOT_OZ = { weapon: 32, shield: 34, helmet: 20, armor: 60, legs: 36, boots: 14, light: 10, amulet: 4, ring: 1 };
for (const id in EQUIP) {
  const E = EQUIP[id];
  let base = E.bow ? 26 : E.quiver ? 14 : SLOT_OZ[E.slot] || 15;
  if (E.twoH && !E.bow) base *= 1.4;
  E.oz = E.oz || Math.round(base * (0.8 + 0.5 * (E.rank || 0)) * 2) / 2;   // arredonda em 0,5
}
const fmtOz = v => (Math.round(v * 10) / 10).toString().replace(".", ",");
function capOf(vocId, level) { return CAP_BASE + (CAP_PER_LVL[vocId] || 10) * Math.max(0, (level || 1) - 1); }
function loadOf(vocId) {
  const d = Save.voc(vocId); let w = 0;
  for (const s in d.equip || {}) { const g = d.equip[s]; if (g && EQUIP[g.id]) w += EQUIP[g.id].oz; }
  for (const g of d.gear || []) if (EQUIP[g.id]) w += EQUIP[g.id].oz;
  for (const p in d.potions || {}) w += (d.potions[p] || 0) * POTION_OZ;
  return w;
}
// 1 = normal, 0.95 = quase cheio, 0.8 = cheio
function capSpeed(scene) {
  const lvl = scene.hero && scene.hero.level || 1, f = loadOf(scene.vocId) / capOf(scene.vocId, lvl);
  return f >= 1 ? 0.8 : f >= CAP_NEAR ? 0.95 : 1;
}
function capState(scene) { const s = capSpeed(scene); return s === 1 ? 0 : s > 0.9 ? 1 : 2; }

// aviso quando muda de faixa (some ao voltar ao normal)
function capNotify(scene) {
  const st = capState(scene);
  if (st === scene.capLast) return; const was = scene.capLast; scene.capLast = st;
  if (was === undefined) return;
  const msg = st === 2 ? t("cap_full") : st === 1 ? t("cap_near") : t("cap_ok");
  if (scene.msg) scene.msg(msg);
}

// ---------------------------------------------------------------- masmorra
{
  const tm = DungeonScene.prototype.tryMove;
  DungeonScene.prototype.tryMove = function (dx, dy) {
    const r = tm.call(this, dx, dy), h = this.hero, f = capSpeed(this);
    if (f < 1 && h.moveT > 0 && h.moveT === h.moveLen && h.moveLen > 0.2 / this.stats.moveSpeed) { h.moveLen /= f; h.moveT = h.moveLen; }
    return r;
  };
  // cheio: equipamento fica no chão (o resto — ouro, comida, gemas — sempre entra)
  const col = DungeonScene.prototype.collect;
  DungeonScene.prototype.collect = function (k) {
    const pk = this.pickups.get(k);
    if (pk && ITEMS[pk.item] && ITEMS[pk.item].gear) {
      const add = EQUIP[ITEMS[pk.item].gear] ? EQUIP[ITEMS[pk.item].gear].oz : 0, cap = capOf(this.vocId, this.hero.level);
      if (loadOf(this.vocId) + add > cap) {
        if (!pk.warned || this.time.now - pk.warned > 3000) { pk.warned = this.time.now; this.msg(t("cap_no_room", { oz: fmtOz(add) })); }
        return;
      }
    }
    const r = col.call(this, k); capNotify(this); return r;
  };
  const ei = DungeonScene.prototype.restat;
  DungeonScene.prototype.restat = function (...a) { const r = ei.apply(this, a); capNotify(this); return r; };
  const ax = DungeonScene.prototype.addXp;
  DungeonScene.prototype.addXp = function (...a) { const r = ax.apply(this, a); capNotify(this); return r; };
}

// vender um equipamento da mochila (clique direito): 25% do preço, em qualquer lugar
function sellGear(scene, i) {
  const d = Save.voc(scene.vocId), g = d.gear[i]; if (!g || !EQUIP[g.id]) return;
  const v = Math.max(5, Math.round((EQUIP[g.id].price || 20) * 0.25 * gearMult(g)));
  d.gear.splice(i, 1); Save.addGold(scene.vocId, v); Save.save();
  if (scene.msg) scene.msg(t("sold_item", { name: gearName(g), n: v }));
  sfx(scene, "pickup", 0.4); capNotify(scene);
}

// ---------------------------------------------------------------- cidade (a mochila também abre lá)
{
  const tm = TownScene.prototype.tryMove;
  TownScene.prototype.tryMove = function (dx, dy) {
    const r = tm.call(this, dx, dy), h = this.hero, f = capSpeed(this);
    if (f < 1 && h.moveT > 0 && h.moveT === h.moveLen) { h.moveLen /= f; h.moveT = h.moveLen; }
    return r;
  };
}
