// Memória dos andares: ao voltar a um andar (pela corda) em até 5 minutos, ele está exatamente como você o deixou
// (mesmo mapa, monstros vivos com a vida que tinham, itens no chão e a parte explorada). Depois disso, o andar é refeito.
const FLOOR_MEM_MS = 5 * 60 * 1000;
{
  const bf = DungeonScene.prototype.buildFloor;
  DungeonScene.prototype.buildFloor = function (...a) {
    this.floorMem = this.floorMem || {};
    // guarda o andar que está sendo deixado
    if (this._builtFloor != null && this.monsters && this.gen && this._builtRegion === this.regionId) {
      this.floorMem[this._builtFloor] = {
        t: Date.now(),
        monsters: this.monsters.filter(m => !m.dead).map(m => ({ kind: m.kind, x: m.x, y: m.y, hp: m.hp, maxHp: m.maxHp, champion: !!m.champion })),
        pickups: [...this.pickups.entries()].map(([k, p]) => ({ x: k % 1000, y: Math.floor(k / 1000), item: p.item, meta: p.meta })),
        explored: this.explored.slice(),
      };
    }
    const f = this.floorN, mem = this.floorMem[f];
    const fresh = mem && Date.now() - mem.t < FLOOR_MEM_MS;
    if (mem && !fresh) { delete this.floorMem[f]; if (this.seeds) delete this.seeds[f]; }   // passou de 5 min: andar novo
    const r = bf.apply(this, a);
    this._builtFloor = f; this._builtRegion = this.regionId;
    if (fresh) this.restoreFloor(mem);
    return r;
  };
}
DungeonScene.prototype.restoreFloor = function (mem) {
  for (const m of this.monsters) { m.spr.destroy(); m.shadow.destroy(); m.bar.destroy(); }
  this.monsters = []; this.occ = new Map();
  for (const p of this.pickups.values()) if (p.spr) p.spr.destroy();
  this.pickups = new Map();
  const h = this.hero;
  for (const s of mem.monsters) {
    if (h && s.x === h.x && s.y === h.y) continue;
    const m = this.spawnMonster(s.kind, s.x, s.y); m.maxHp = s.maxHp; m.hp = s.hp;
    if (s.champion) { m.champion = true; m.spr.setScale(m.spr.scaleX * 1.25); }
  }
  for (const p of mem.pickups) this.drop(p.x, p.y, p.item, p.meta);
  if (mem.explored && mem.explored.length === this.explored.length) this.explored.set(mem.explored);
  this.drawMinimap();
};
