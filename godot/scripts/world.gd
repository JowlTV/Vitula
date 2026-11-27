extends Node2D
## Mundo de combate do Vitula (porte da DungeonScene do Phaser: dungeon.js, hero.js, monsters.js, spells.js,
## skills2.js e skills3.js). Etapa 1: arena de teste do esgoto. O gerador de andares entra na etapa 3.
signal msg(text: String)
const T := 64
const FONT := preload("res://assets/ui/alegreya.ttf")
var MW := 26
var MH := 18

var voc := "knight"
var ranged := 0
var spells: Dictionary
var stats := {}
var fury_max := 100.0
var hero
var monsters: Array = []
var occ := {}            # Vector2i -> monstro
var props := {}          # Vector2i -> {kind, hits, spr}
var pickups := {}        # Vector2i -> {item, amount, spr}
var gen: Gen = Gen.new()
var fb
var region_id := "karhyn_sewers"
var region: Dictionary
var floors := 5
var seeds := {}
var pockets: Array = []
var holes := {}
var explored := PackedByteArray()
var far_room := 0
var camp_room := -2
var decor_used := {}
var spikes := {}         # Vector2i -> {spr, warn, up}
var plates := {}         # Vector2i -> Vector2i (respiradouro)
var clouds: Array = []
var lights: Array = []   # {node: PointLight2D, base, water, f, ft, target}
var stairs = null
var stairs_spr: Sprite2D
var rope = null
var wp = null
var slope_pass = null
var spike_t := 0.0
var kills_by_type := {}
var roping := false
var hole_busy := false
var fog: Sprite2D
var fog_img: Image
var fog_tex: ImageTexture
var dark: CanvasModulate
var dlg                  # conversa/painéis (game.gd cria)
var recall_t := 0.0
var recall_cd := 0.0
var drink_buffs := {}
signal floor_built
signal tut(ev: String)
signal loot(icon: Texture2D, text: String, col: Color, sum: int)
var flow := PackedInt32Array()
var floor_n := 1
var time_ := 0.0
var next_wave := 120.0
var gold_run := 0
var kills := 0
var barrier_cells: Array = []
var barrier_t := 0.0
var finished := false
var paused := false
var auto_attack := false

var ground: Node2D
var ents: Node2D
var fxl: Node2D
var _dir_t0 := -1.0
var bot := false

# ============================================================== montagem
func start(v: String, level := 1) -> void:
	voc = v
	ranged = int(D.VOCATIONS[v].get("ranged", 0))
	spells = D.spells(v)
	auto_attack = Save.data.settings.get("auto_attack", false)
	Engine.time_scale = Save.data.settings.get("speed", 0.75)
	var d := Save.voc(v)
	if level > Save.level(v): d.xpTotal = Save.xp_for_level(level)
	Equip.starter_gear(v)
	region_id = Save.reg.get("region", "karhyn_sewers"); region = D.db.REGIONS[region_id]
	floor_n = 1
	var sf := int(Save.reg.get("startFloor", 0))
	if sf > 0: floor_n = mini(sf, floors); Save.reg.startFloor = 0
	stats = compute_stats()
	fb = load("res://scripts/floorbuild.gd").new(self)
	ground = Node2D.new(); add_child(ground)
	ents = Node2D.new(); ents.y_sort_enabled = true; add_child(ents)
	fxl = Node2D.new(); fxl.z_index = 100; add_child(fxl)
	dark = CanvasModulate.new(); dark.color = Color(0.2, 0.2, 0.25); add_child(dark)
	hero = load("res://scripts/hero.gd").new()
	ents.add_child(hero)
	hero.setup(v, D.voc_scale(v))
	var li := Save.level_info(d.xpTotal); hero.level = li.level; hero.xp = li.xp
	hero.max_hp = stats.maxHp + 10 * (hero.level - 1)
	hero.hp = hero.max_hp
	hero.fury = fury_max if D.is_mana(v) else 0.0
	for s in spells: hero.cds[s] = 0.0
	_hero_lights()
	next_wave = 120.0 + randf_range(30, 120)
	build_floor("start")

## luz do herói + luminária equipada (lampião ou Pingente da Deusa)
var lamp_light: PointLight2D
func _hero_lights() -> void:
	hero.light.texture_scale = 3.3 * T * 2 / 128.0; hero.light.color = Color("d8ccb8"); hero.light.energy = 1.0
	lamp_light = PointLight2D.new(); lamp_light.texture = A.light_tex; lamp_light.position = Vector2(0, -18); hero.add_child(lamp_light)
	var lg = Save.voc(voc).equip.get("light")
	if lg and Equip.E(lg.id).has("light"):
		var L: Dictionary = Equip.E(lg.id).light
		lamp_light.texture_scale = L.r * T * 2 / 128.0 * min(1.3, Equip.gear_mult(lg)); lamp_light.color = UI.color_int(int(L.tint)); lamp_light.energy = 0.8
	else: lamp_light.enabled = false

## monta (ou remonta) o andar atual
var floor_mem := {}
var built_floor := -1
const FLOOR_MEM_MS := 5 * 60 * 1000
func build_floor(arrive := "start") -> void:
	if built_floor >= 0 and explored.size():   # guarda o andar que está sendo deixado
		var mons := []
		for m in monsters:
			if not m.dead: mons.append({"kind": m.kind, "x": m.x, "y": m.y, "hp": m.hp, "max": m.max_hp, "ch": m.champion})
		var pks := []
		for c in pickups: pks.append({"c": c, "item": pickups[c].item, "gear": pickups[c].get("gear")})
		floor_mem[built_floor] = {"t": Time.get_ticks_msec(), "mons": mons, "pks": pks, "exp": explored.duplicate()}
	var mem = floor_mem.get(floor_n)
	var fresh: bool = mem != null and Time.get_ticks_msec() - mem.t < FLOOR_MEM_MS
	if mem != null and not fresh: floor_mem.erase(floor_n); seeds.erase(floor_n)
	_build_floor_now(arrive)
	built_floor = floor_n
	if fresh: _restore_floor(mem)

func _restore_floor(mem: Dictionary) -> void:
	for m in monsters: m.queue_free()
	monsters = []; occ = {}
	for c in pickups: pickups[c].spr.queue_free()
	pickups = {}
	for s in mem.mons:
		if s.x == hero.x and s.y == hero.y: continue
		var m = spawn_monster(s.kind, s.x, s.y); m.max_hp = s.max; m.hp = s.hp
		if s.ch: m.champion = true
	for p in mem.pks: drop(p.c, p.item, p.gear)
	if mem.exp.size() == explored.size():
		explored = mem.exp
		for i in explored.size():
			if explored[i]: fog_img.set_pixel(i % gen.w, i / gen.w, Color(0, 0, 0, 0))
		fog_tex.update(fog_img)

func _build_floor_now(arrive: String) -> void:
	for n in ground.get_children(): n.queue_free()
	for n in ents.get_children():
		if n != hero: n.queue_free()
	for n in fxl.get_children(): n.queue_free()
	monsters = []; occ = {}; props = {}; pickups = {}; spikes = {}; plates = {}; clouds = []; lights = []; holes = {}
	stairs = null; rope = null; wp = null; slope_pass = null; barrier_cells = []; barrier_t = 0
	hero.target = null; hero.move_t = 0
	fb.build(arrive)
	MW = gen.w; MH = gen.h
	_build_fog()
	update_flow(); reveal()
	Sfx.music("music_boss" if floor_n == floors else "music_sewers", 0.5)
	floor_built.emit()

func place_hero_at(c: Vector2i) -> void:
	hero.x = c.x; hero.y = c.y; hero.move_t = 0
	var p := cell_pos(c.x, c.y); hero.px = p.x; hero.py = p.y; hero.from_x = p.x; hero.from_y = p.y
	_place_hero()

func add_prop(c: Vector2i, kind: String) -> void:
	if kind == "chest_closed" or props.has(c): return
	var tx: Texture2D = fb.art(kind)
	if tx == null: return
	var s := Sprite2D.new(); s.texture = tx
	var p := cell_pos(c.x, c.y); s.position = p + Vector2(0, 4); s.offset = Vector2(0, -tx.get_height() / 2.0)
	var k: float = D.db.PROP_H[kind] / float(tx.get_height()) if D.db.PROP_H.has(kind) else 1.0
	if kind == "cave_rocks": k = 0.9
	s.scale = Vector2(k, k)
	var sh := Sprite2D.new(); sh.texture = A.shadow_tex; sh.position = Vector2(0, -3) / k; sh.scale = Vector2(tx.get_width() * 0.9 / 64.0, tx.get_width() * 0.3 / 64.0); sh.show_behind_parent = true
	s.add_child(sh)
	ents.add_child(s)
	props[c] = {"kind": kind, "hits": 0, "spr": s, "x": c.x, "y": c.y}
	if kind == "torch_stand": add_light(p - Vector2(0, 38), 3.6 * T, Color("ffa255"), false, true)

func remove_prop(c: Vector2i) -> void:
	if props.has(c): props[c].spr.queue_free(); props.erase(c)

func clear_cell(c: Vector2i) -> void:
	remove_prop(c)
	if occ.has(c):
		var m = occ[c]; m.queue_free(); monsters.erase(m); occ.erase(c)

## luz pontual (tochas quentes, lodo esverdeado, cogumelos azuis); r = raio em px
func add_light(at: Vector2, r: float, c: Color, water := false, glow := false) -> void:
	var l := PointLight2D.new(); l.texture = A.light_tex; l.position = at; l.color = c
	l.texture_scale = r * 2 / 128.0; l.energy = 0.55 if water else 1.0
	ground.add_child(l)
	var e := {"node": l, "base": l.energy, "water": water, "f": 1.0, "ft": 0.0, "target": 1.0}
	if glow:
		var g := Sprite2D.new(); g.texture = A.light_tex; g.position = at; g.scale = Vector2.ONE * (r * 1.4 / 128.0)
		g.modulate = Color(1, 0.6, 0.25, 0.18); var cm := CanvasItemMaterial.new(); cm.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD; cm.light_mode = CanvasItemMaterial.LIGHT_MODE_UNSHADED; g.material = cm
		g.z_index = 60; ground.add_child(g); e.glow = g
	lights.append(e)

func add_spike(c: Vector2i) -> void:
	var base := Node2D.new(); base.position = Vector2(c.x * T, c.y * T); base.z_index = -4; ground.add_child(base)
	for r in [[Rect2(3, 3, T - 6, T - 6), Color("1c1b20")], [Rect2(4, 4, T - 8, 2), Color("8a6a3a")], [Rect2(4, T - 6, T - 8, 2), Color("8a6a3a")], [Rect2(4, 4, 2, T - 8), Color("8a6a3a")], [Rect2(T - 6, 4, 2, T - 8), Color("8a6a3a")]]:
		var cr := ColorRect.new(); cr.position = r[0].position; cr.size = r[0].size; cr.color = r[1]; base.add_child(cr)
	for k in 3:
		for j in 3:
			var hole := ColorRect.new(); hole.color = Color("050406"); hole.position = Vector2(16 + k * 14, 16 + j * 14); hole.size = Vector2(4, 4); base.add_child(hole)
	var warn := ColorRect.new(); warn.color = Color(0.75, 0.19, 0.13, 0); warn.position = Vector2(4, 4); warn.size = Vector2(T - 8, T - 8); base.add_child(warn)
	var spr := Sprite2D.new(); spr.texture = fb.art("spikes_extended"); spr.position = Vector2(T / 2.0, T / 2.0); spr.visible = false; base.add_child(spr)
	spikes[c] = {"spr": spr, "warn": warn, "up": false}

func add_plate(c: Vector2i, vent: Vector2i) -> void:
	plates[c] = vent
	var b := Node2D.new(); b.position = Vector2(c.x * T, c.y * T); b.z_index = -5; ground.add_child(b)
	for r in [[Rect2(10, 12, T - 20, T - 20), Color(0, 0, 0, 0.45)], [Rect2(12, 12, T - 24, T - 26), Color("6a6670")], [Rect2(12, 12, T - 24, 3), Color("86828c")], [Rect2(12, T - 17, T - 24, 3), Color("4a4750")]]:
		var cr := ColorRect.new(); cr.position = r[0].position; cr.size = r[0].size; cr.color = r[1]; b.add_child(cr)

func cell_pos(cx: int, cy: int) -> Vector2: return Vector2(cx * T + T / 2.0, cy * T + T * 0.82)
func is_floor(cx: int, cy: int) -> bool: return gen.is_walk(cx, cy)
func walkable(cx: int, cy: int) -> bool: return is_floor(cx, cy) and not props.has(Vector2i(cx, cy))

# ============================================================== campo de distância (BFS a partir do herói, até 30 casas)
func update_flow() -> void:
	flow.resize(MW * MH); flow.fill(-1)
	var q: Array[Vector2i] = [Vector2i(hero.x, hero.y)]
	flow[hero.y * MW + hero.x] = 0
	var i := 0
	while i < q.size():
		var c := q[i]; i += 1
		var v := flow[c.y * MW + c.x]
		if v >= 30: continue
		for d in D.DIRS8:
			var n: Vector2i = c + d
			if not is_floor(n.x, n.y) or props.has(n) or flow[n.y * MW + n.x] >= 0: continue
			if d.x != 0 and d.y != 0 and (not is_floor(c.x + d.x, c.y) or not is_floor(c.x, c.y + d.y)): continue
			flow[n.y * MW + n.x] = v + 1; q.append(n)
func flow_at(cx: int, cy: int) -> int:
	if cx < 0 or cy < 0 or cx >= MW or cy >= MH: return -1
	return flow[cy * MW + cx]

# ============================================================== status (estilo Tibia), como no Phaser
func compute_stats() -> Dictionary:
	var s := {"maxHp": 100, "armor": 0, "recovery": 0, "moveSpeed": 1, "might": 1, "cooldown": 1, "growth": 1, "greed": 1}
	s.merge(D.VOCATIONS[voc].stats, true)
	var d := Save.voc(voc)
	var tr: Dictionary = d.trainings
	s.maxHp += 10 * tr.get("hp", 0); s.armor += tr.get("armor", 0); s.atkSpeed = 1 + 0.05 * tr.get("atkspd", 0)
	fury_max = D.db.FURY_MAX + 10 * tr.get("fury", 0)
	var at: Dictionary = d.attr
	s.maxHp += 25 * at.get("vit", 0); s.armor += 0.5 * at.get("armor", 0); s.atkSpeed += 0.0025 * at.get("aspd", 0)
	s.might *= 1 + 0.02 * at.get("str", 0); s.recovery += 0.5 * at.get("hpreg", 0); s.manaReg = 0.5 * at.get("mpreg", 0)
	# equipamentos vestidos (raridade e +N multiplicam)
	s.weaponAtk = D.db.FIST_ATTACK; s.gearDef = 0.0; s.gearBlock = 0.0; s.gearDodge = 0.0; s.gearCrit = 0.0; s.gearMl = 0.0; s.res = {}; s.weapon = null
	for slot in d.equip:
		var g: Dictionary = d.equip[slot]; var E := Equip.E(g.id)
		if E.is_empty(): continue
		var m := Equip.gear_mult(g)
		if E.slot == "weapon":
			var w := E.duplicate(); w.elDmg = E.get("elDmg", 0) * m; s.weapon = w
			if not ranged or E.get("bow", false): s.weaponAtk = E.get("atk", D.db.FIST_ATTACK) * m
		s.gearDef += E.get("def", 0) * m; s.gearBlock += E.get("block", 0); s.gearDodge += E.get("dodge", 0); s.gearCrit += E.get("crit", 0); s.gearMl += E.get("ml", 0)
		s.recovery += E.get("hpReg", 0); s.manaReg += E.get("manaReg", 0); s.moveSpeed *= 1 + E.get("speed", 0)
		for k in E.get("res", {}): s.res[k] = s.res.get(k, 0.0) + E.res[k]
	# teia de talentos
	var f := Talents.fx(voc)
	s.might *= 1 + f.get("dmg", 0.0); s.maxHp = roundi(s.maxHp * max(0.3, 1 + f.get("hp", 0.0)))
	s.armor += f.get("armor", 0.0); s.talBlock = f.get("block", 0.0); s.recovery += f.get("regen", 0.0); s.atkSpeed = max(0.3, s.atkSpeed + f.get("aspd", 0.0))
	s.talCrit = f.get("crit", 0.0); s.talCritDmg = f.get("critDmg", 0.0); s.leech = f.get("leech", 0.0) * (3 if f.ks.has("thirst") else 1); s.hpDmg = f.get("hpDmg", 0.0)
	s.exec = f.get("exec", 0.0); s.elite = f.get("elite", 0.0); s.lowHp = f.get("lowHp", 0.0); s.taken = min(0.3, f.get("taken", 0.0)); s.thorns = f.get("thorns", 0.0); s.furyGain = f.get("furyGain", 0.0)
	s.moveSpeed *= 1 + f.get("speed", 0.0); s.gearDodge += f.get("dodge", 0.0); s.manaReg += f.get("mreg", 0.0)
	s.ks = f.ks
	fury_max += f.get("fury", 0.0)
	return s

## recalcula status depois de trocar equipamento ou talento (mantém os bônus de nível na vida)
func restat() -> void:
	if hero == null: stats = compute_stats(); return
	var old: float = hero.max_hp - stats.maxHp
	stats = compute_stats()
	hero.max_hp = stats.maxHp + old; hero.hp = min(hero.hp, hero.max_hp)
func attacks_per_sec() -> float: return stats.get("atkSpeed", 1.0) / stats.cooldown
func attr(id: String) -> int: return Save.voc(voc).attr.get(id, 0)
func sword_eff() -> float: return attr("weapon") + Save.skill(voc, "distance" if ranged else "sword").lvl + (10 if buff_on("hunter" if ranged else "berserker") else 0)
func shield_lvl() -> float: return Save.skill(voc, "shield").lvl + attr("shield")
func ml_eff() -> float: return Save.voc(voc).ml.lvl + attr("ml") + stats.gearMl + (10 if buff_on("mage") else 0)
func defense_value() -> float:
	var v: float = stats.armor + stats.gearDef + 0.25 * (shield_lvl() - D.SKILLS.shield.start)
	return v * 1.54 if hero.guard_t > 0 else v        # Égide: +54% de defesa
func block_chance() -> float:
	if ranged: return min(0.35, 0.05 + 0.006 * (Save.skill(voc, "dodge").lvl + stats.gearDodge - D.SKILLS.dodge.start))
	var b: float = min(0.35, 0.05 + 0.006 * (shield_lvl() - D.SKILLS.shield.start)) + 0.005 * attr("block") + stats.gearBlock + stats.talBlock
	return min(0.6, b * 2 if stats.ks.has("iron") else b)
func promo():
	var p = D.db.PROMOTION.get(voc)
	return p if p and Save.voc(voc).get("promoted", false) else null
func max_damage() -> float:
	var pm = promo()
	return (0.085 * stats.weaponAtk * sword_eff() + hero.level / 5.0) * stats.might * (pm.dmgMult if pm else 1.0) + stats.get("hpDmg", 0.0) * (hero.max_hp if hero else stats.maxHp)
func base_damage() -> float:
	return max_damage() * 0.8 * (1.6 if hero.frenzy_t > 0 else 1.0) * (1.4 if hero.kber_t > 0 else 1.0)
func crit_chance() -> float:
	if stats.ks.has("iron"): return 0.0
	return 0.1 + 0.005 * attr("crit") + stats.gearCrit + stats.talCrit + (0.15 if hero.frenzy_t > 0 else 0.0)
func crit_mult() -> float: return 1.8 + stats.get("talCritDmg", 0.0)
func xp_next() -> float: return 8 * pow(hero.level, 1.35)
func range_now() -> int: return ranged + (2 if hero.eagle_t > 0 else 0) + (6 if hero.far_t > 0 else 0)
func spell_unlocked(id: String) -> bool:
	return Talents.spell_unlocked(voc, id, hero.level)

# ============================================================== laço principal
func _physics_process(raw_dt: float) -> void:
	if hero == null or finished or paused: return
	var dt: float = min(0.05, raw_dt)
	time_ += dt
	update_hero(dt)
	for m in monsters.duplicate(): update_monster(m, dt)
	skill_tick(dt)
	if time_ > next_wave: spawn_wave(); next_wave = time_ + randf_range(90, 180)
	update_traps(dt)
	update_lights(dt)
	update_recall(dt)
	for k in hero.buffs.keys():
		hero.buffs[k] -= dt
		if hero.buffs[k] <= 0: hero.buffs.erase(k)
	tick_monster_poison(dt)

func input_dir() -> Vector2i:
	if bot: return bot_dir()
	var dx := int(Input.is_action_pressed("andar_dir")) - int(Input.is_action_pressed("andar_esq"))
	var dy := int(Input.is_action_pressed("andar_baixo")) - int(Input.is_action_pressed("andar_cima"))
	if dx == 0 and dy == 0: _dir_t0 = -1.0; return Vector2i.ZERO
	# ao começar a andar, espera 70 ms pela segunda tecla (diagonal)
	var now := Time.get_ticks_msec() / 1000.0
	if _dir_t0 < 0: _dir_t0 = now
	if not (dx != 0 and dy != 0) and now - _dir_t0 < 0.07 and hero.move_t <= 0: return Vector2i.ZERO
	return Vector2i(dx, dy)

func update_hero(dt: float) -> void:
	var h = hero
	if h.dead: return
	if h.target and (h.target.dead or not monsters.has(h.target) or max(abs(h.target.x - h.x), abs(h.target.y - h.y)) > 9): h.target = null
	for s in h.cds: h.cds[s] = max(0.0, h.cds[s] - dt)
	for s in h.pot_cd: h.pot_cd[s] = max(0.0, h.pot_cd[s] - dt)
	h.atk_t = max(0.0, h.atk_t - dt)
	h.regen += dt
	if h.regen >= 1:
		h.regen -= 1
		if stats.recovery > 0: heal(stats.recovery, false)
	var mana := D.is_mana(voc)
	if stats.manaReg and (mana or h.fury_idle < 4): h.fury = min(fury_max, h.fury + stats.manaReg * dt)
	tick_poison(dt)
	var pv = D.VOCATIONS[voc].get("passive")
	if pv:
		h.p_reg += dt
		if h.p_reg >= pv.every:
			h.p_reg -= pv.every
			var pm = promo()
			heal(h.max_hp * pv.regenPct * (pm.regenMult if pm else 1.0))
	if mana: h.fury = min(fury_max, h.fury + (3 + 0.15 * ml_eff()) * dt)
	else:
		h.fury_idle += dt
		if h.fury_idle > 4: h.fury = max(0.0, h.fury - 4 * dt)
	update_aura(dt)
	if h.move_t > 0:
		var used: float = min(dt, h.move_t); h.move_t -= used; h.carry = dt - used
		var k: float = 1.0 - h.move_t / h.move_len
		var to := cell_pos(h.x, h.y)
		h.px = lerpf(h.from_x, to.x, k); h.py = lerpf(h.from_y, to.y, k)
		if h.move_t == 0: hero_arrived()
	_place_hero()
	h.flash = max(0.0, h.flash - dt * 7)
	var tint := Color(1, 1, 1)
	if h.flash > 0.75: tint = Color("ffd8d8")
	elif h.flash > 0: tint = Color("f0a0a0")
	elif h.poison_t > 0: tint = Color("a8f08a")
	h.spr.modulate = tint
	# animação: 4 direções (baixo, cima, lado espelhado)
	if h.move_t > 0: h.walk_hold = 0.12
	else: h.walk_hold = max(0.0, h.walk_hold - dt)
	var walking: bool = h.walk_hold > 0
	var atk: bool = h.attack_t > 0 and not (ranged and h.move_t > 0)
	var fx: int = h.facing.x
	var dir: String = h.atk_dir if atk else ("side" if fx != 0 else ("up" if h.facing.y < 0 else "down"))
	var anim: String = ("attack" if atk else "walk" if walking else "idle") + "_" + dir
	h.pose_t = max(0.0, h.pose_t - dt)
	if h.pose_t > 0 and h.pose != "" and not atk and not walking: anim = h.pose
	if not atk and fx != 0: h.look_left = fx < 0
	h.spr.flip_h = dir == "side" and (h.atk_left if atk else h.look_left)
	h.attack_t = max(0.0, h.attack_t - dt)
	if h.spr.animation != anim or (not h.spr.is_playing() and h.spr.sprite_frames.get_animation_loop(anim)): h.spr.play(anim)
	# ataque básico
	h.atk_queued = max(0.0, h.atk_queued - dt)
	if ranged: archer_attack(dt)
	else: melee_attack()
	if h.move_t > 0: return
	var d := input_dir()
	if d != Vector2i.ZERO: try_move(d.x, d.y)
	if h.move_t > 0 and h.carry > 0: h.move_t = max(0.001, h.move_t - h.carry)
	h.carry = 0.0

func _place_hero() -> void:
	hero.position = Vector2(roundf(hero.px), roundf(hero.py + 4))

func adjacent_monster(cx: int, cy: int, pref: Vector2i):
	var pk := Vector2i(cx, cy) + pref
	if occ.has(pk): return occ[pk]
	var best = null
	for d in D.DIRS8:
		var m = occ.get(Vector2i(cx, cy) + d)
		if m and not m.dead and (best == null or m.hp < best.hp): best = m
	return best

func melee_attack() -> void:
	var h = hero
	if h.atk_t <= 0 and h.atk_queued > 0 and not (h.target and not h.target.dead) and not adjacent_monster(h.x, h.y, h.facing):
		h.atk_queued = 0; h.atk_t = 0.5 * stats.cooldown / stats.atkSpeed; hero_swing(h.facing.x, h.facing.y)
	if h.atk_t <= 0 and (auto_attack or h.atk_queued > 0):
		h.atk_queued = 0
		var locked = h.target if h.target and not h.target.dead else null
		var t = (locked if max(abs(locked.x - h.x), abs(locked.y - h.y)) == 1 else null) if locked else adjacent_monster(h.x, h.y, h.facing)
		if t:
			h.target = t
			h.atk_t = 1.0 * stats.cooldown / stats.atkSpeed
			hero_swing(signi(t.x - h.x), signi(t.y - h.y))
			await get_tree().create_timer(0.2, false).timeout     # acerta no quadro de impacto
			if t.dead or finished: return
			var sx := signi(t.x - h.x); var sy := signi(t.y - h.y)
			fx("basic_slash", Vector2(t.px, t.py - 22), 0.9, t.x < h.x, 45.0 * sy * sx if sx != 0 and sy != 0 else 0.0)
			var crit := randf() < crit_chance()
			damage_monster(t, base_damage() * randf_range(0.85, 1.15) * (crit_mult() if crit else 1.0))
			weapon_element(t)
			if h.kber_t > 0: berserk_cleave(t)
			hit_fx(t, crit)
			add_fury(9); train_skill("sword"); Sfx.play("hit", 0.3)

func try_move(dx: int, dy: int) -> void:
	var h = hero
	var diag := dx != 0 and dy != 0
	if diag and (not walkable(h.x + dx, h.y + dy) or (not walkable(h.x + dx, h.y) and not walkable(h.x, h.y + dy))):
		if walkable(h.x + dx, h.y) and not occ.has(Vector2i(h.x + dx, h.y)): dy = 0
		elif walkable(h.x, h.y + dy) and not occ.has(Vector2i(h.x, h.y + dy)): dx = 0
		else: return
		diag = false
	var n := Vector2i(h.x + dx, h.y + dy)
	h.facing = Vector2i(dx, dy)
	if dx != 0: h.look_left = dx < 0
	if props.has(n):
		if D.db.BREAKABLE.has(props[n].kind):
			hero_swing(dx, dy)
			var c := cell_pos(n.x, n.y)
			get_tree().create_timer(0.2, false).timeout.connect(func(): if not finished: fx("basic_slash", Vector2(c.x, c.y - 22), 0.9, dx < 0))
		bump_prop(n); h.move_t = 0.18; h.move_len = 0.18; h.from_x = h.px; h.from_y = h.py
		return
	if (occ.has(n) and not h.flee_t > 0) or not is_floor(n.x, n.y): return
	h.from_x = h.px; h.from_y = h.py
	h.x = n.x; h.y = n.y
	h.move_len = 0.22 / stats.moveSpeed * (1.35 if diag else 1.0) / (1.4 if h.flee_t > 0 else 1.0)
	h.move_t = h.move_len
	if recall_t > 0: recall_t = 0.0; emit_signal("msg", D.t("recall_cancel"))
	tut.emit("move")
	reveal()
	update_flow()

func hero_arrived() -> void:
	var k := Vector2i(hero.x, hero.y)
	if pickups.has(k): collect(k)
	if plates.has(k): trigger_vent(plates[k])
	if wp != null and k == wp: wp_step()
	if slope_pass != null and k == slope_pass and not finished: _end_of_sewers(); return
	if stairs != null and k == stairs and not finished:
		if floor_n < floors:
			floor_n += 1; Sfx.play("levelup", 0.3)
			_transition(func():
				build_floor()
				emit_signal("msg", D.t("cave_collapse") if floor_n == 3 else D.t("floor_info", {"region": region.name, "n": floor_n}) if floor_n < floors else D.t("last_floor")))
	hole_hint()

func bump_prop(c: Vector2i) -> void:
	var pr: Dictionary = props[c]
	if not D.db.BREAKABLE.has(pr.kind): return
	pr.hits += 1
	var s: Sprite2D = pr.spr
	var tw := create_tween(); tw.tween_property(s, "position:x", s.position.x + 3, 0.04); tw.tween_property(s, "position:x", s.position.x, 0.04)
	Sfx.play("hit", 0.25)
	if pr.hits >= D.db.BREAKABLE[pr.kind]:
		s.queue_free(); props.erase(c); Sfx.play("break", 0.5)
		drop(c, D.weighted(D.db.LOOT)); update_flow()

func hero_swing(dx: int, dy: int) -> void:
	var h = hero
	if dx == 0 and dy == 0:
		dx = h.facing.x; dy = h.facing.y
		if dx == 0 and dy == 0: dy = 1
	h.attack_t = 0.42
	h.atk_dir = "side" if dx != 0 else ("up" if dy < 0 else "down")
	h.atk_left = dx < 0 if dx != 0 else h.look_left
	if dx != 0: h.look_left = dx < 0
	h.spr.flip_h = h.atk_dir == "side" and h.atk_left
	h.spr.play("attack_" + h.atk_dir); h.spr.frame = 0

# ---------------------------------------------------------------- arqueiro
func clear_shot(x0: int, y0: int, x1: int, y1: int) -> bool:
	var n: int = max(abs(x1 - x0), abs(y1 - y0))
	for i in range(1, n):
		var cx := roundi(x0 + (x1 - x0) * float(i) / n); var cy := roundi(y0 + (y1 - y0) * float(i) / n)
		if not is_floor(cx, cy) or props.has(Vector2i(cx, cy)): return false
	return true

func ranged_target(lock := false):
	var h = hero; var R := range_now()
	var sel = h.target
	if sel and not sel.dead and monsters.has(sel) and max(abs(sel.x - h.x), abs(sel.y - h.y)) <= R and clear_shot(h.x, h.y, sel.x, sel.y): return sel
	if sel and not sel.dead and monsters.has(sel): return null
	var best = null; var bd := 1e9
	for m in monsters:
		if m.dead: continue
		var d: int = max(abs(m.x - h.x), abs(m.y - h.y))
		if d > R or not clear_shot(h.x, h.y, m.x, m.y): continue
		var score := d - (0.5 if signi(m.x - h.x) == h.facing.x and signi(m.y - h.y) == h.facing.y else 0.0)
		if score < bd: bd = score; best = m
	if best and lock: h.target = best
	return best

func shoot_arrow(from: Vector2, to: Vector2, on_hit: Callable, speed := 900.0) -> void:
	var ang := (to - from).angle()
	var a := play_fx("pfx_arrow", from, 0.55 * 2, false, ang, true)
	var dur: float = max(0.08, from.distance_to(to) / speed)
	var tw := create_tween(); tw.tween_property(a, "position", to, dur)
	tw.finished.connect(func():
		if is_instance_valid(a): a.queue_free()
		if not finished: on_hit.call())

func arrow_hit(t, mult: float, el := "physical", kind := "normal") -> void:
	if not is_instance_valid(t) or t.dead: return
	var A: Dictionary = D.db.ARROWS.get(kind, D.db.ARROWS.normal)
	if kind != "normal": el = A.el
	var crit := randf() < crit_chance()
	var far: bool = hero.far_t > 0
	var hp0: float = t.hp
	var dmg: float = base_damage() * mult * A.mult * randf_range(0.85, 1.15) * (crit_mult() if crit else 1.0)
	damage_monster(t, dmg, "holy" if far else el)
	hit_fx(t, crit)
	if A.get("area", false):
		for d in D.DIRS8:
			var m = occ.get(Vector2i(t.x + d.x, t.y + d.y))
			if m and not m.dead: damage_monster(m, dmg * 0.7, A.el)
		fx("heal" if kind == "holy" else "explosion", Vector2(t.px, t.py - 20), 0.9 if kind == "holy" else 0.75)
		Sfx.play("explode", 0.25)
	if far and is_instance_valid(t): far_mark(t, hp0)

# ---------------------------------------------------------------- flechas (a normal é infinita)
func arrow_type() -> String:
	var d := Save.voc(voc); var sel: String = d.get("arrowSel", "normal")
	return sel if sel != "normal" and int(d.arrows.get(sel, 0)) > 0 else "normal"
func spend_arrow() -> String:
	var d := Save.voc(voc); var k := arrow_type()
	if k == "normal": return k
	d.arrows[k] = int(d.arrows[k]) - 1
	if d.arrows[k] <= 0 and d.get("arrowSel") == k: emit_signal("msg", D.t("arrows_out_type", {"name": D.t("arrow_" + k)}))
	return k
func cycle_arrow() -> void:
	if not ranged: return
	var d := Save.voc(voc); var have := []
	for k in D.db.ARROW_IDS:
		if k == "normal" or int(d.arrows.get(k, 0)) > 0: have.append(k)
	d.arrowSel = have[(have.find(d.get("arrowSel", "normal")) + 1) % have.size()]; Save.save()
	emit_signal("msg", D.t("arrow_selected", {"name": D.t("arrow_" + d.arrowSel), "n": D.t("infinite") if d.arrowSel == "normal" else str(int(d.arrows.get(d.arrowSel, 0)))}))

## arma com elemento, magia ou veneno (corpo a corpo)
func weapon_element(t) -> void:
	var W = stats.get("weapon")
	if W == null or ranged or t.dead: return
	if W.has("el") and W.get("elDmg", 0): damage_monster(t, W.elDmg * randf_range(0.8, 1.2), W.el)
	if W.get("magic", false) and not t.dead: damage_monster(t, (5 + 1.5 * ml_eff()) * randf_range(0.8, 1.2), "energy")
	if W.has("poison") and not t.dead: t.set_meta("poison", [float(W.poison.dur), max(1.0, base_damage() * W.poison.pct), 0.0])
func tick_monster_poison(dt: float) -> void:
	for m in monsters:
		if m.dead or not m.has_meta("poison"): continue
		var p: Array = m.get_meta("poison")
		p[0] -= dt; p[2] += dt
		if p[2] >= 1: p[2] -= 1; damage_monster(m, p[1], "earth", true)
		if p[0] <= 0: m.remove_meta("poison")
func buff_on(id: String) -> bool: return hero.buffs.get(id, 0.0) > 0

func archer_attack(dt: float) -> void:
	var h = hero
	h.eagle_t = max(0.0, h.eagle_t - dt); h.flee_t = max(0.0, h.flee_t - dt); h.frenzy_t = max(0.0, h.frenzy_t - dt)
	if h.atk_t > 0 or not (auto_attack or h.atk_queued > 0): return
	h.atk_queued = 0
	var t = ranged_target(true)
	if not t: return
	var kind := spend_arrow()
	h.atk_t = 1.1 / 1.25 * stats.cooldown / stats.atkSpeed * (0.5 if h.eagle_t > 0 else 1.0) / (1.4 if h.flee_t > 0 else 1.0)
	var dx := signi(t.x - h.x); var dy := signi(t.y - h.y)
	h.facing = Vector2i(dx, dy)
	var side: bool = abs(t.x - h.x) >= abs(t.y - h.y)
	hero_swing(dx if side else 0, 0 if side else dy)
	await get_tree().create_timer(0.3, false).timeout
	if h.dead or finished: return
	shoot_arrow(Vector2(h.px, h.py - 40), Vector2(t.px, t.py - 24), func():
		if t.dead or finished: return
		arrow_hit(t, 1.0, "physical", kind)
		if h.frenzy_t > 0: berserk_hit(t)
		add_fury(8); train_skill("distance"); Sfx.play("hit", 0.25))
	Sfx.play("pickup", 0.15)

func hit_fx(t, crit: bool) -> void:
	if not is_instance_valid(t.spr): return
	var flip: bool = hero.px > t.px
	if crit: play_fx("pfx_crit", Vector2(t.px, t.py + 4), 0.6 * 2, flip)
	else: play_fx("pfx_hit", Vector2(t.px + (8 if flip else -8), t.py + 4 - t.body_h * 0.25), 0.8 * 2, flip)

# ---------------------------------------------------------------- herói: dano, cura, experiência
func hurt_hero(amount: float, pure := 0.0, el := "physical", attacker = null) -> void:
	var h = hero
	if h.dead: return
	if pure > 0:
		h.hp -= pure; float_text(Vector2(h.px + 8, h.py - 60), str(roundi(pure)), Color("7fd04a"))
		if h.hp > 0: return
		h.hp = 0.0001; amount = 1; pure = 0
	train_skill("dodge" if ranged else "shield")
	if randf() < block_chance():
		float_text(Vector2(h.px, h.py - 66), D.t("dodged" if ranged else "blocked"), Color("9fd0ff")); Sfx.play("hit", 0.2); return
	if attacker and Best.complete(attacker.kind, kills_by_type): amount *= 1 - Best.BONUS
	amount *= 1 - stats.get("taken", 0.0)
	var real: float = max(1.0, max(amount * 0.25, amount - defense_value()))   # a defesa nunca anula mais que 75%
	h.hp -= real; h.flash = 1
	add_fury(4)
	float_text(Vector2(h.px + randf_range(-6, 6), h.py - 66), str(roundi(real)), Color(D.COLORS.hurt))
	Sfx.play("hurt", 0.35)
	if real >= h.max_hp * 0.1:
		if not h.attack_t > 0: h.pose = "hurt"; h.pose_t = 0.42
		shake(0.13, 4); splat(Vector2(h.px, h.py - 2), 6)
	if attacker and not attacker.dead and h.guard_t > 0 and amount > 0: damage_monster(attacker, max(1.0, amount * 0.1))   # Égide devolve 10%
	if attacker and not attacker.dead and stats.get("thorns", 0) and amount > 0: damage_monster(attacker, amount * stats.thorns)
	if h.hp <= 0:
		h.hp = 0; h.dead = true
		h.spr.play("death")
		get_tree().create_timer(1.6, false).timeout.connect(func(): finish(false))

func poison_hero(p: Dictionary) -> void:
	var h = hero
	if h.dead: return
	if not h.poison_t > 0: float_text(Vector2(h.px, h.py - 80), D.t("poisoned"), Color("8fe060"))
	h.poison_t = p.dur; h.poison_dps = h.max_hp * p.pct
func tick_poison(dt: float) -> void:
	var h = hero
	if not h.poison_t > 0 or h.dead: return
	h.poison_t -= dt; h.poison_tick += dt
	if h.poison_tick >= 1: h.poison_tick -= 1; hurt_hero(0, max(1, roundi(h.poison_dps)), "earth")

func heal(amount: float, show := true) -> void:
	var h = hero
	if stats.ks.has("thirst"): amount *= 0.5
	if h.dead or amount <= 0: return
	var before: float = h.hp; h.hp = min(h.max_hp, h.hp + amount)
	if show and h.hp - before >= 1: float_text(Vector2(h.px, h.py - 66), "+%d" % roundi(h.hp - before), Color(D.COLORS.heal))

func add_fury(v: float) -> void:
	v *= 1 + stats.get("furyGain", 0.0)
	if D.is_mana(voc): return
	hero.fury = min(fury_max, hero.fury + v); hero.fury_idle = 0

func add_xp(v: float) -> void:
	v *= 0.95
	var h = hero; var d := Save.voc(voc)
	h.xp += v * stats.growth; d.xpTotal += v * stats.growth
	while h.xp >= xp_next():
		h.xp -= xp_next(); h.level += 1; h.max_hp += 10; h.hp = h.max_hp
		float_text(Vector2(h.px, h.py - 84), D.t("level_up_float", {"n": h.level}), Color(D.COLORS.gold))
		emit_signal("msg", D.t("level_up_talent", {"n": h.level}))
		if not d.has("charges"): d.charges = [0.0, 0.0]
		d.charges[1] = 1.0
		if D.is_mana(voc): h.fury = fury_max
		Sfx.play("levelup", 0.4)
		check_promotion()
	Save.save()

func check_promotion() -> void:
	var p = D.db.PROMOTION.get(voc); var d := Save.voc(voc)
	if not p or d.get("promoted", false) or hero.level < p.level: return
	d.promoted = true; Save.save()
	emit_signal("msg", D.t("promoted", {"name": p.name, "regen": p.regenMult, "dmg": roundi((p.dmgMult - 1) * 100)}))
	fx("heal", Vector2(hero.px, hero.py - 28), 1.2)

func train_skill(id: String, n := 1.0) -> void:
	var sk := Save.skill(voc, id)
	sk.tries += n * 1.32 * pow(0.95, max(0, floor((sk.lvl - D.SKILLS[id].start) / 10.0)))
	var need := D.skill_tries_needed(id, sk.lvl)
	if sk.tries >= need:
		sk.tries -= need; sk.lvl += 1
		emit_signal("msg", D.t("skill_up", {"name": D.SKILLS[id].name, "n": sk.lvl}))
		float_text(Vector2(hero.px, hero.py - 96), "%s %d" % [D.SKILLS[id].name, sk.lvl], Color("9fd0ff"))
		Sfx.play("levelup", 0.25); Save.save()

func train_magic(spent: float) -> void:
	var ml: Dictionary = Save.voc(voc).ml
	ml.spent += spent
	var need := D.ml_needed(voc, ml.lvl)
	while ml.spent >= need:
		ml.spent -= need; ml.lvl += 1
		emit_signal("msg", D.t("ml_up", {"n": ml.lvl}))
		float_text(Vector2(hero.px, hero.py - 96), D.t("ml_float", {"n": ml.lvl}), Color("c0a0ff"))
		need = D.ml_needed(voc, ml.lvl)
	Save.save()

func cycle_target() -> void:
	var h = hero
	var list := monsters.filter(func(m): return not m.dead and max(abs(m.x - h.x), abs(m.y - h.y)) <= 9)
	if list.is_empty(): emit_signal("msg", D.t("no_target")); return
	list.sort_custom(func(a, b): return Vector2(a.x - h.x, a.y - h.y).length() < Vector2(b.x - h.x, b.y - h.y).length())
	h.target = list[0]

func use_potion(slot: int) -> void:
	var h = hero; var d := Save.voc(voc)
	var id := "health" if slot == 0 else ("mana" if D.is_mana(voc) else "fury")
	if h.dead or h.pot_cd.get(id, 0.0) > 0: return
	if d.charges[slot] < 1:
		emit_signal("msg", D.t("pot_charging", {"name": D.db.POTIONS[id].name, "p": floori(100 * d.charges[slot])})); return
	d.charges[slot] = 0.0; h.pot_cd[id] = D.db.POT_CD; Save.save()
	if id == "health": heal(h.max_hp * 0.4, false); pot_glow(Color(1, 0.19, 0.19))
	elif id == "mana": h.fury = min(fury_max, h.fury + fury_max * 0.6); pot_glow(Color(0.23, 0.48, 1))
	else: h.fury = fury_max; pot_glow(Color(1, 0.54, 0.19))
	Sfx.play("gem", 0.4)

func pot_glow(c: Color) -> void:
	var g := light_spr(Vector2(hero.px, hero.py - 20), c, 0.21, 0.63)
	var tw := create_tween().set_parallel(); tw.tween_property(g, "scale", Vector2(0.77, 0.77), 0.6); tw.tween_property(g, "modulate:a", 0.0, 0.6)
	tw.chain().tween_callback(g.queue_free)

# ============================================================== magias (spells.js, skills2.js, skills3.js)
func cast(id: String) -> void:
	var h = hero
	if not spells.has(id) or finished or paused or h.dead: return
	var sp: Dictionary = spells[id]
	if not spell_unlocked(id):
		emit_signal("msg", D.t("spell_locked", {"name": sp.name, "n": sp.level})); return
	if h.cds[id] > 0: return
	if h.fury < sp.fury:
		emit_signal("msg", D.t("fury_low", {"resource": D.VOCATIONS[voc].get("resource", D.t("fury_label")), "name": sp.name, "cost": sp.fury})); return
	h.fury -= sp.fury
	train_magic(sp.fury)
	h.cds[id] = sp.cd * stats.cooldown
	if id in ["heal", "aura", "frenzy", "flee", "guard", "quake", "kberserk", "farsight", "barrier"]: h.pose = "cast"; h.pose_t = 0.45
	if has_method("sp_" + id): call("sp_" + id, sp)

func _refund(id: String, sp: Dictionary) -> void: hero.cds[id] = 0.0; hero.fury += sp.fury

func sp_heal(_sp) -> void:
	heal(hero.max_hp * 0.25 if voc == "knight" else (10 + 6 * ml_eff()) * 0.85)
	fx("heal", Vector2(hero.px, hero.py - 28), 0.7); Sfx.play("levelup", 0.2)

func sp_front(_sp) -> void:
	var h = hero; var dx: int = h.facing.x; var dy: int = h.facing.y
	if dx == 0 and dy == 0: dx = 1
	hero_swing(dx, dy)
	var mid := cell_pos(h.x + dx * 2, h.y + dy * 2)
	var c := play_fx("front_cut", Vector2(mid.x, mid.y - 22), 1.0, false, atan2(dy, dx))
	c.scale = Vector2(Vector2(dx, dy).length() * 3 * T / 200.0, 0.9)
	Sfx.play("hit", 0.5)
	var hits := 0
	for k in range(1, 4):
		if hits >= 2: break
		var cx: int = h.x + dx * k; var cy: int = h.y + dy * k
		if not is_floor(cx, cy): break
		var m = occ.get(Vector2i(cx, cy))
		if m: hits += 1; damage_monster(m, base_damage() * 2.0)
		elif props.has(Vector2i(cx, cy)): bump_prop(Vector2i(cx, cy)); break

func sp_quake(sp) -> void:
	var h = hero
	hero_swing(h.facing.x, h.facing.y); Sfx.play("explode", 0.45)
	var base := 3.0 * T / 200.0
	var s := play_fx("ring_wave", Vector2(h.px, h.py - 10), base, false, 0.0, false, Color("d8b080"))
	var tw := create_tween().set_parallel(); tw.tween_property(s, "scale", Vector2(base * 2, base * 2), 0.8)
	tw.tween_property(s, "modulate:a", 0.0, 0.3).set_delay(0.65)
	for k in 10:
		var a := randf() * TAU; var r := randf_range(20, 2 * T)
		splat(Vector2(h.px + cos(a) * r, h.py + sin(a) * r * 0.7), 1)
	for m in monsters:
		if m.dead or max(abs(m.x - h.x), abs(m.y - h.y)) > 2: continue
		m.slow_t = sp.dur; m.holy_slow = false
		m.quake_dot = {"n": 4, "t": 0.0, "dmg": base_damage() * 0.75}

func sp_guard(sp) -> void:
	hero.guard_t = sp.dur
	float_text(Vector2(hero.px, hero.py - 90), D.t("guard_float"), Color("9fd0ff")); Sfx.play("levelup", 0.25)

func sp_aura(sp) -> void:
	var h = hero
	h.aura_t = sp.dur; h.aura_tick = 0.0
	if not is_instance_valid(h.aura_spr):
		h.aura_spr = AnimatedSprite2D.new(); h.aura_spr.sprite_frames = A.fx("aura"); h.aura_spr.scale = Vector2(1.35, 0.75)
		h.aura_spr.modulate.a = 0.85; h.aura_spr.position = Vector2(0, -2); h.aura_spr.z_index = -1; h.add_child(h.aura_spr)
	h.aura_spr.visible = true; h.aura_spr.play("play"); Sfx.play("explode", 0.25)

func update_aura(dt: float) -> void:
	var h = hero
	if h.aura_t <= 0: return
	h.aura_t -= dt; h.aura_tick -= dt
	if h.aura_tick <= 0:
		h.aura_tick = 0.5
		for m in monsters.duplicate():
			if max(abs(m.x - h.x), abs(m.y - h.y)) <= 1: damage_monster(m, base_damage() * 0.55)
		heal(h.max_hp * 0.015, false)
	if h.aura_t <= 0 and is_instance_valid(h.aura_spr): h.aura_spr.visible = false

func sp_slasher(_sp) -> void:
	var h = hero; var dx: int = h.facing.x; var dy: int = h.facing.y
	hero_swing(dx, dy)
	var base := base_damage() * 2.0 * 2.2; var mult := crit_mult() + 0.15
	await get_tree().create_timer(0.18, false).timeout
	if finished: return
	var p := cell_pos(h.x + dx * 2, h.y + dy * 2)
	var s := play_fx("slasher", Vector2(p.x, p.y - 22), 3.2 * T / 96.0, dx < 0, deg_to_rad(90 * dy) if dy != 0 and dx == 0 else 0.0, false, Color.WHITE, true)
	s.scale.y = s.scale.x * 0.5   # quadro 96×192: mantém a proporção do Phaser
	flash_screen(Color(1, 0.9, 0.78, 0.35), 0.09)
	for k in range(1, 4):
		var cx: int = h.x + dx * k; var cy: int = h.y + dy * k
		if not is_floor(cx, cy): break
		var m = occ.get(Vector2i(cx, cy))
		if m and not m.dead:
			damage_monster(m, base * mult); splat(Vector2(m.px, m.py - 4), 6)
			float_text(Vector2(m.px, m.py - 60), D.t("crit_float"), Color("ffd040"))
	Sfx.play("hit", 0.5)

func sp_kberserk(sp) -> void:
	hero.kber_t = sp.dur
	float_text(Vector2(hero.px, hero.py - 90), D.t("kberserk_float"), Color("ff5040"))
	flash_screen(Color(1, 0.24, 0.16, 0.3), 0.16); Sfx.play("levelup", 0.3)

func sp_xcut(_sp) -> void:
	var h = hero; var dx: int = h.facing.x; var dy: int = h.facing.y
	hero_swing(dx, dy)
	var cx: int = h.x + dx; var cy: int = h.y + dy; var dmg := base_damage() * 2.0 * 1.8
	await get_tree().create_timer(0.18, false).timeout
	if finished: return
	var rot := -atan2(dy, -dx) if dx < 0 else atan2(dy, dx if (dx != 0 or dy != 0) else 1)
	play_fx("pfx_xcut", Vector2(h.px, h.py + 4), 2.0, dx < 0, rot)
	for o in [Vector2i(0, 0), Vector2i(1, 1), Vector2i(-1, -1), Vector2i(1, -1), Vector2i(-1, 1)]:
		var m = occ.get(Vector2i(cx, cy) + o)
		if not m or m.dead: continue
		damage_monster(m, dmg)
		if not m.dead:
			var tot: float = m.hp * (0.1 if m.elite else 0.3)
			m.bleed = {"t": 5.0, "dps": tot / 5.0, "acc": 0.0}; splat(Vector2(m.px, m.py), 5)
	Sfx.play("hit", 0.5)

func berserk_cleave(t) -> void:
	var dx := signi(t.x - hero.x); var dy := signi(t.y - hero.y)
	for k in range(1, 3):
		var m = occ.get(Vector2i(t.x + dx * k, t.y + dy * k))
		if m and not m.dead: damage_monster(m, base_damage())
	heal(base_damage() * 0.25)

# ---- arqueiro
func sp_holy(sp) -> void:
	var h = hero; var tg = ranged_target()
	if not tg: emit_signal("msg", D.t("no_target")); _refund("holy", sp); return
	var dx := signi(tg.x - h.x); var dy := signi(tg.y - h.y); var side: bool = abs(tg.x - h.x) >= abs(tg.y - h.y)
	hero_swing(dx if side else 0, 0 if side else dy)
	await get_tree().create_timer(0.25, false).timeout
	if h.dead or finished: return
	var from := Vector2(h.px, h.py - 40); var to := Vector2(tg.px, tg.py - 24)
	var a := play_fx("holy_arrow", from, 0.7, false, (to - from).angle(), true, Color(1, 1, 1, 0.75), true)
	a.stop(); a.frame = 1
	var gl := light_spr(from, Color("fff0a0"), 0.22, 0.45)
	var dur: float = max(0.08, from.distance_to(to) / 1400.0)
	var tw := create_tween().set_parallel(); tw.tween_property(a, "position", to, dur); tw.tween_property(gl, "position", to, dur)
	tw.chain().tween_callback(func():
		a.queue_free(); gl.queue_free()
		if tg.dead or finished: return
		damage_monster(tg, base_damage() * 2.0, "holy")
		var b := play_fx("holy_arrow", to, 1.0, false, 0.0, false, Color.WHITE, true); b.frame = 3)
	Sfx.play("gem", 0.4)

func sp_missile(sp) -> void:
	var h = hero; var tg = ranged_target()
	var dx: int = signi(tg.x - h.x) if tg else h.facing.x; var dy: int = signi(tg.y - h.y) if tg else h.facing.y
	if dx == 0 and dy == 0: dx = 1
	hero_swing(dx if abs(dx) >= abs(dy) and dx != 0 else 0, 0 if abs(dx) >= abs(dy) and dx != 0 else dy)
	var dmg := base_damage() * 2.0 * 1.8; var hits := []
	var cx: int = h.x; var cy: int = h.y
	for k in range(1, 10):
		if hits.size() >= 3: break
		cx += dx; cy += dy
		if not is_floor(cx, cy): break
		var m = occ.get(Vector2i(cx, cy))
		if m and not m.dead: hits.append(m)
	var end: Vector2 = Vector2(hits[0].px, hits[0].py + 6) if hits.size() else cell_pos(cx, cy)
	var ang := atan2(dy, dx)
	var from := Vector2(h.px, h.py - 40); var to := end - Vector2(0, 30)
	var a := play_fx("missile", from, 1.6 * T / 96.0, false, ang, true, Color.WHITE, true)
	a.scale.y = a.scale.x * 0.5; a.flip_v = dx < 0
	var halo := light_spr(from, Color("fff0b0"), 0.54, 0.57)
	var fly: float = max(0.07, from.distance_to(to) / 1600.0)
	var tw := create_tween().set_parallel(); tw.tween_property(a, "position", to, fly); tw.tween_property(halo, "position", to, fly)
	tw.chain().tween_callback(func():
		a.queue_free()
		var t2 := create_tween().set_parallel(); t2.tween_property(halo, "scale", Vector2(1.3, 1.3), 0.38); t2.tween_property(halo, "modulate:a", 0.0, 0.38)
		t2.chain().tween_callback(halo.queue_free)
		if finished: return
		for m in hits:
			if m.dead: continue
			damage_monster(m, dmg, "holy")
			if not m.dead and can_enter(m.x + dx, m.y + dy, m):
				move_monster(m, m.x + dx, m.y + dy)
				if not m.slow_t > 0 or m.holy_slow: m.slow_t = 3; m.holy_slow = true)
	flash_screen(Color(0.6, 0.56, 0.45, 0.25), 0.12); Sfx.play("gem", 0.5)

func sp_volley(sp) -> void:
	var tg = ranged_target()
	if not tg: emit_signal("msg", D.t("no_target")); _refund("volley", sp); return
	var c := Vector2i(tg.x, tg.y); var p := cell_pos(c.x, c.y)
	hero_swing(signi(c.x - hero.x), 0)
	var s := play_fx("volley", Vector2(p.x, p.y - 8), 4.0 * T / 124.0)
	s.offset = Vector2(0, -139 * 0.3)
	Sfx.play("pickup", 0.3)
	await get_tree().create_timer(0.39, false).timeout
	if finished: return
	var near := monsters.filter(func(m): return not m.dead and Vector2(m.x - c.x, m.y - c.y).length() <= 2.9)
	near.sort_custom(func(u, v): return Vector2(u.x - c.x, u.y - c.y).length() < Vector2(v.x - c.x, v.y - c.y).length())
	for m in near.slice(0, 6):
		m.slow_t = sp.dur; m.holy_slow = false
		damage_monster(m, base_damage() * 2.0 * 1.2)
	Sfx.play("hit", 0.4)

func sp_frenzy(sp) -> void:
	hero.frenzy_t = sp.dur
	float_text(Vector2(hero.px, hero.py - 90), D.t("frenzy_float"), Color("ffb040"))
	fx("heal", Vector2(hero.px, hero.py - 28), 0.8); flash_screen(Color(1, 0.7, 0.31, 0.3), 0.18); Sfx.play("levelup", 0.25)

func sp_flee(sp) -> void:
	hero.flee_t = sp.dur
	float_text(Vector2(hero.px, hero.py - 90), D.t("flee_float"), Color("9fe08a")); Sfx.play("pickup", 0.4)

func sp_farsight(sp) -> void:
	hero.far_t = sp.dur
	float_text(Vector2(hero.px, hero.py - 90), D.t("farsight_float"), Color("fff0a0")); Sfx.play("levelup", 0.25)

func sp_barrier(sp) -> void:
	var h = hero; var f: Vector2i = h.facing
	var perp := Vector2i(1 if f.y != 0 else 0, 1 if f.x != 0 else 0)
	for c in barrier_cells: c.g.queue_free()
	barrier_cells = []
	for s in [-1, 0, 1]:
		var cx: int = h.x + f.x * 2 + perp.x * s; var cy: int = h.y + f.y * 2 + perp.y * s
		if not is_floor(cx, cy) or occ.has(Vector2i(cx, cy)): continue
		var p := cell_pos(cx, cy)
		var g := light_spr(Vector2(p.x, p.y - 26), Color("fff0a0"), 0.55, 0.8); g.scale = Vector2(0.55, 0.9)
		barrier_cells.append({"x": cx, "y": cy, "g": g})
	barrier_t = sp.dur; Sfx.play("gem", 0.4)
func barrier_at(cx: int, cy: int) -> bool:
	if barrier_t <= 0: return false
	for c in barrier_cells:
		if c.x == cx and c.y == cy: return true
	return false

func berserk_hit(t) -> void:
	var dmg := base_damage()
	for d in D.DIRS8:
		var m = occ.get(Vector2i(t.x, t.y) + d)
		if m and not m.dead: damage_monster(m, dmg * 0.4, "holy")
	play_fx("holy_arrow", Vector2(t.px, t.py - 24), 0.45)
	var from = t; var hit := [t]
	for n in 3:
		var cand := monsters.filter(func(m): return not m.dead and not hit.has(m) and max(abs(m.x - from.x), abs(m.y - from.y)) <= 4)
		if cand.is_empty(): break
		cand.sort_custom(func(a, b): return Vector2(a.x - from.x, a.y - from.y).length() < Vector2(b.x - from.x, b.y - from.y).length())
		var nx = cand[0]; hit.append(nx)
		var src = from
		get_tree().create_timer(n * 0.14, false).timeout.connect(func():
			if finished: return
			shoot_arrow(Vector2(src.px, src.py - 24), Vector2(nx.px, nx.py - 24), func(): if not nx.dead and not finished: arrow_hit(nx, 0.7), 1100))
		from = nx

func far_mark(t, hp_before: float) -> void:
	t.marks += 1
	if t.marks == 1: t.mark_hp0 = hp_before
	if t.marks >= 3 and not t.dead:
		var taken: float = max(0.0, t.mark_hp0 - t.hp); t.marks = 0
		var pop := taken * 0.5
		if pop > 0:
			t.hp -= pop; float_text(Vector2(t.px, t.py - 64), str(roundi(pop)), Color("fff0a0")); fx("heal", Vector2(t.px, t.py - 28), 0.7)
			if t.hp <= 0: damage_monster(t, 1)

func skill_tick(dt: float) -> void:
	var h = hero
	h.guard_t = max(0.0, h.guard_t - dt); h.kber_t = max(0.0, h.kber_t - dt); h.far_t = max(0.0, h.far_t - dt)
	if not ranged: h.flee_t = max(0.0, h.flee_t - dt); h.frenzy_t = max(0.0, h.frenzy_t - dt)
	# contorno de energia (Égide azul, Vento verde, Berserker dourado/vermelho, Visão dourada)
	var gc := Color(0, 0, 0, 0)
	if h.kber_t > 0: gc = Color("ff3020")
	elif h.frenzy_t > 0: gc = Color("ffb040")
	elif h.guard_t > 0: gc = Color("7ab8ff")
	elif h.flee_t > 0: gc = Color("9fffb0")
	elif h.far_t > 0: gc = Color("fff0a0")
	gc.a = (0.45 + 0.2 * sin(time_ * 10)) if gc.a > 0 else 0.0
	h.glow.modulate = gc
	for m in monsters.duplicate():
		if m.dead: continue
		if m.quake_dot:
			var q: Dictionary = m.quake_dot
			q.t -= dt
			if q.t <= 0:
				q.t = 0.5; q.n -= 1; damage_monster(m, q.dmg)
				if q.n <= 0: m.quake_dot = null
		if m.bleed and not m.dead:
			var b: Dictionary = m.bleed
			b.t -= dt; b.acc += dt
			if b.acc >= 0.5:
				damage_monster(m, b.dps * b.acc); b.acc = 0.0
				if not m.dead: splat(Vector2(m.px, m.py), 1)
			if b.t <= 0: m.bleed = null
	if barrier_t > 0:
		barrier_t -= dt
		for c in barrier_cells: c.g.modulate.a = 0.6 + 0.25 * sin(time_ * 8 + c.x)
		if barrier_t <= 0:
			for c in barrier_cells: c.g.queue_free()
			barrier_cells = []

# ============================================================== monstros (monsters.js)
func roomy_cell(cx: int, cy: int) -> bool:
	if not walkable(cx, cy): return false
	var n := 0
	for d in D.DIRS8: if walkable(cx + d.x, cy + d.y): n += 1
	return n >= 5

func floor_monsters() -> Array: return D.db.FLOOR_MONSTERS[str(floor_n)]

func spawn_monster(kind: String, cx: int, cy: int):
	var m = load("res://scripts/monster.gd").new()
	ents.add_child(m)
	m.setup(self, kind, cx, cy, floor_n)
	m.position = Vector2(m.px, m.py + 4)
	monsters.append(m); occ[Vector2i(cx, cy)] = m
	return m

func spawn_random(awake := false) -> void:
	for i in 60:
		var cx := randi_range(1, MW - 2); var cy := randi_range(1, MH - 2)
		if not roomy_cell(cx, cy) or occ.has(Vector2i(cx, cy)) or max(abs(cx - hero.x), abs(cy - hero.y)) < 6: continue
		var m = spawn_monster(D.weighted(floor_monsters()), cx, cy); m.awake = awake
		return

func spawn_wave() -> void:
	var h = hero; var spots := []
	for yy in range(h.y - 9, h.y + 10):
		for xx in range(h.x - 9, h.x + 10):
			var d: int = max(abs(xx - h.x), abs(yy - h.y))
			if d < 5 or not walkable(xx, yy) or occ.has(Vector2i(xx, yy)) or flow_at(xx, yy) < 0: continue
			spots.append(Vector2i(xx, yy))
	if spots.size() < 4: return
	spots.shuffle()
	for i in min(spots.size(), 7 + floor_n * 2):
		var m = spawn_monster(D.weighted(floor_monsters()), spots[i].x, spots[i].y); m.awake = true
		if i == 0:
			m.champion = true; m.hp *= 4; m.max_hp = m.hp; m.dmg *= 1.6; m.spr.scale *= 2.0; m.body_h *= 2.0
	shake(0.3, 4); Sfx.play("boss", 0.5); emit_signal("msg", D.t("horde_msg"))

func can_enter(cx: int, cy: int, m) -> bool:
	if not walkable(cx, cy) or occ.has(Vector2i(cx, cy)) or (cx == hero.x and cy == hero.y): return false
	if barrier_at(cx, cy): return false
	return true

func update_monster(m, dt: float) -> void:
	if m.dead: return
	var h = hero
	m.flash = max(0.0, m.flash - dt * 4); m.bob += dt
	if m.move_t > 0:
		m.move_t = max(0.0, m.move_t - dt)
		var to := cell_pos(m.x, m.y); var k: float = 1.0 - m.move_t / m.move_len
		m.px = lerpf(m.from_x, to.x, k); m.py = lerpf(m.from_y, to.y, k)
	m.lunge *= 0.82
	var bobv: float = sin(m.bob * (9 if m.fly else 12)) * (2.5 if m.fly else (1.2 if m.move_t > 0 else 0.4))
	var lift := 16.0 if m.fly else 0.0
	m.position = Vector2(roundf(m.px), roundf(m.py + 4))
	m.spr.position = Vector2(m.lunge.x, -lift + bobv + m.lunge.y)
	var col := Color.WHITE
	if m.flash > 0: col = Color(3, 3, 3)
	elif m.champion: col = Color("ff9a8a")
	elif m.slow_t > 0: col = Color("fff0c0") if m.holy_slow else Color("b8d0ff")
	m.spr.modulate = col
	m.bar.queue_redraw()
	var slow: bool = m.slow_t > 0
	if slow: m.slow_t -= dt
	var sm := (0.85 if m.holy_slow else 0.5) if slow else 1.0
	m.atk_t -= dt * sm; m.step_t -= dt * sm
	m.ia.update(dt)

func monster_bite(m) -> void:
	var h = hero
	m.atk_t = m.data.atk
	var dv := Vector2(h.x - m.x, h.y - m.y); m.lunge = dv.normalized() * 7
	if h.x != m.x: m.spr.flip_h = h.x < m.x
	monster_swing(m)
	var hp0: float = h.hp
	hurt_hero(m.dmg * randf_range(0.85, 1.15), 0, D.db.MONSTER_ELEMENT.get(m.kind, "physical"), m)
	if m.data.has("poison") and h.hp < hp0: poison_hero(m.data.poison)

func monster_swing(m) -> void:
	m.spr.play("attack")
	if not m.spr.animation_finished.is_connected(_mon_back.bind(m)): m.spr.animation_finished.connect(_mon_back.bind(m), CONNECT_ONE_SHOT)
func _mon_back(m) -> void: if not m.dead: m.spr.play("walk")

func power(m) -> float: return m.max_hp * m.dmg

func monster_step(m) -> void:
	var here := flow_at(m.x, m.y); var cur := 99999 if here < 0 else here
	var dirs: Array = D.DIRS8.duplicate(); dirs.shuffle()
	if m.fly and randf() < 0.35:
		for d in dirs: if can_enter(m.x + d.x, m.y + d.y, m): move_monster(m, m.x + d.x, m.y + d.y); return
		return
	var best = null; var best_cost := 1e9; var blocker = null; var block_cost := 1e9; var side = null; var side_cost := 1e9
	for d in dirs:
		var nx: int = m.x + d.x; var ny: int = m.y + d.y
		if d.x != 0 and d.y != 0 and (not walkable(m.x + d.x, m.y) or not walkable(m.x, m.y + d.y)): continue
		var v := flow_at(nx, ny)
		if v < 0: continue
		var cost := v * 10 + (4 if d.x != 0 and d.y != 0 else 0)
		var o = occ.get(Vector2i(nx, ny))
		if o and o != m and not o.dead:
			if v < cur and cost < block_cost: block_cost = cost; blocker = o
			continue
		if not can_enter(nx, ny, m): continue
		if v < cur and cost < best_cost: best_cost = cost; best = Vector2i(nx, ny)
		elif v <= cur and cost < side_cost: side_cost = cost; side = Vector2i(nx, ny)
	if best != null: move_monster(m, best.x, best.y); return
	if blocker:
		if power(m) > power(blocker): monster_attacks_monster(m, blocker); return
		if side != null: move_monster(m, side.x, side.y); return
		m.stuck += 1
		if m.stuck > 3:
			for d in dirs:
				var nx: int = m.x + d.x; var ny: int = m.y + d.y; var v := flow_at(nx, ny)
				if v >= 0 and v <= cur + 1 and can_enter(nx, ny, m): m.stuck = 0; move_monster(m, nx, ny); return

func move_monster(m, cx: int, cy: int) -> void:
	m.stuck = 0
	occ.erase(Vector2i(m.x, m.y)); occ[Vector2i(cx, cy)] = m
	if cx != m.x: m.spr.flip_h = cx < m.x
	m.from_x = m.px; m.from_y = m.py; m.x = cx; m.y = cy
	m.move_len = m.data.step * 0.9; m.move_t = m.move_len

func monster_attacks_monster(m, o) -> void:
	if m.atk_t > 0: return
	m.atk_t = m.data.atk
	m.lunge = Vector2(o.x - m.x, o.y - m.y).normalized() * 7
	monster_swing(m)
	var dmg: float = m.dmg * randf_range(0.85, 1.15)
	o.hp -= dmg; o.flash = 1; o.awake = true
	float_text(Vector2(o.px, o.py - 50), str(roundi(dmg)), Color("c08080"))
	if o.hp <= 0: monster_died(o, true)

func damage_monster(m, amount: float, el := "physical", pierce := false) -> void:
	if m.dead: return
	if Best.complete(m.kind, kills_by_type): amount *= 1 + Best.BONUS
	# teia: execução, elites, vida baixa, Olhos de Carcará
	if amount > 0:
		if stats.get("exec", 0) and m.hp < m.max_hp * 0.3: amount *= 1 + stats.exec
		if stats.get("elite", 0) and (m.elite or m.champion): amount *= 1 + stats.elite
		if stats.get("lowHp", 0) and hero.hp < hero.max_hp * 0.5: amount *= 1 + stats.lowHp
		if stats.ks.has("carcara"): amount *= crit_mult() if m.hp >= m.max_hp * 0.999 else 0.85
		if stats.get("leech", 0) and not hero.dead: hero.hp = min(hero.max_hp, hero.hp + amount * stats.leech)
	var res: float = D.db.MONSTER_RES.get(m.kind, {}).get(el, 0.0)
	amount = max(1.0, amount * (1 - res) - (m.data.get("arm", 0.0) if el == "physical" and not pierce else 0.0))
	if res >= 1: amount = 0
	var fp := Vector2(m.px + randf_range(-6, 6), m.py - 50 - (0 if el == "physical" else 10))
	if res >= 1: float_text(fp, "imune", Color(D.COLORS.white), 11)
	else: dmg_text(fp, amount, null if el == "physical" else Color(D.db.ELEMENTS[el].color))
	if amount <= 0: return
	m.awake = true; m.hp -= amount; m.flash = 1
	if m.hp <= 0: monster_died(m)

func monster_died(m, by_monster := false) -> void:
	m.dead = true; m.bar.queue_redraw()
	splat(Vector2(m.px, m.py - 4), 26 if m.elite else 12, Color("2f5a1c") if m.kind == "slime" else Color("5a0a0a"))
	occ.erase(Vector2i(m.x, m.y))
	monsters.erase(m)
	if hero.target == m: hero.target = null
	if not by_monster:
		var bt0 := Best.tier(m.kind, kills_by_type)
		kills += 1; kills_by_type[m.kind] = kills_by_type.get(m.kind, 0) + 1
		var bt1 := Best.tier(m.kind, kills_by_type)
		if bt1 > bt0:
			emit_signal("msg", D.t("best_unlock", {"name": m.data.name, "tier": D.t("best_tier_%d" % bt1)}) + (" " + D.t("best_bonus_on") if bt1 == 4 else "")); Sfx.play("levelup", 0.25)
		add_xp(m.data.xp * (5 if m.champion else 1))
		var ct = Save.voc(voc).get("contract")
		if ct and ct.kind == m.kind and int(ct.got) < int(ct.n):
			ct.got = int(ct.got) + 1; Save.save()
			emit_signal("msg", D.t("contract_progress_done", {"n": int(ct.n), "name": m.data.name}) if ct.got >= ct.n else D.t("contract_progress", {"got": int(ct.got), "n": int(ct.n), "name": m.data.name}))
		var c := Vector2i(m.x, m.y)
		var eq_chance := 1.0 if m.elite else 0.35 if m.champion else 0.025
		if randf() < eq_chance:
			var gg = roll_equip(m)
			if gg: drop(c, "eq_" + gg.id, gg)
		if m.elite or (m.champion and randf() < 0.25): drop(c, "boss_essence")
		if m.elite and floor_n <= 5 and randf() < 0.015: drop(c, "eq_goddess_pendant", Equip.gear_new("goddess_pendant", 4))
		if randf() < 0.6 or m.elite or m.champion: drop(c, "gold")
		if randf() < 0.12: drop(c, ["apple", "bread", "meat"][randi() % 3])
		var d := Save.voc(voc); var add: float = m.max_hp / D.db.POTION_FILL
		for sl in [0, 1]:
			var was: float = d.charges[sl]; d.charges[sl] = min(1.0, was + add)
			if was < 1 and d.charges[sl] >= 1:
				float_text(Vector2(hero.px, hero.py - 100 - sl * 16), D.t("potion_filled"), Color("7ab0ff") if sl else Color("ff7070")); Sfx.play("gem", 0.3)
		Save.save()
	# morte animada: o último quadro fica como corpo por 5 s
	m.ia.active = false
	m.spr.modulate = Color.WHITE; m.spr.position = Vector2.ZERO
	m.spr.play("death"); m.shadow.visible = false; m.z_index = -1
	var ttl := 40.0 if pickups.has(Vector2i(m.x, m.y)) else 5.0
	var tw := create_tween(); tw.tween_interval(ttl - 1.2); tw.tween_property(m, "modulate:a", 0.0, 1.2); tw.tween_callback(m.queue_free)
	if m.elite and not by_monster: boss_fell(m)

# ============================================================== itens no chão
func drop(c: Vector2i, item: String, gear = null) -> void:
	if item.begins_with("eq_"):
		if gear == null: gear = Equip.gear_new(item.substr(3))
	elif item == "none" or not D.ITEMS.has(item): return
	if pickups.has(c):
		var alt := free_neighbors(c)
		if alt.is_empty(): return
		c = alt[0]
	var p := cell_pos(c.x, c.y)
	var s := Sprite2D.new()
	if gear: s.texture = Equip.icon(gear.id); s.scale = Vector2(0.8, 0.8)
	elif item == "boss_essence": s.texture = Equip.item_icon("i_red_gem"); s.modulate = Color("ff9a30")
	else: s.texture = A.tex("res://assets/art/%s.png" % D.ITEMS[item].icon)
	s.position = p + Vector2(0, 6); s.offset = Vector2(0, -s.texture.get_height() / 2.0); s.z_index = -1
	if gear and int(gear.r) > 0:
		var gl := Sprite2D.new(); gl.texture = A.light_tex; gl.scale = Vector2(0.5, 0.3); gl.modulate = Equip.rarity_color(int(gear.r)); gl.modulate.a = 0.6; gl.show_behind_parent = true; s.add_child(gl)
	ents.add_child(s)
	var amount := 0
	if item == "gold": amount = randi_range(5, 12)
	if item == "silver": amount = randi_range(2, 5)
	if amount: amount = roundi(amount * (1 + 0.2 * (floor_n - 1)))
	pickups[c] = {"item": item, "amount": amount, "spr": s, "gear": gear}
	if c == Vector2i(hero.x, hero.y): collect(c)

func free_neighbors(c: Vector2i) -> Array:
	var out := []
	for d in [Vector2i(0, 1), Vector2i(-1, 0), Vector2i(1, 0), Vector2i(0, -1), Vector2i(1, 1), Vector2i(-1, 1)]:
		var n: Vector2i = c + d
		if walkable(n.x, n.y) and not pickups.has(n): out.append(n)
	return out

func collect(c: Vector2i) -> void:
	var pk: Dictionary = pickups[c]
	var h = hero; var at := Vector2(h.px, h.py - 60)
	if pk.get("gear"):
		var d := Save.voc(voc); var add := Equip.oz(pk.gear.id)
		if Equip.load_of(voc) + add > Equip.cap_of(voc, h.level):
			if Time.get_ticks_msec() - pk.get("warned", -9999) > 3000: pk.warned = Time.get_ticks_msec(); emit_signal("msg", D.t("cap_no_room", {"oz": Equip.fmt_oz(add)}))
			return
		pickups.erase(c); pk.spr.queue_free()
		d.gear.append(pk.gear); Save.save(); Sfx.play("gem", 0.4)
		float_text(at, Equip.gear_name(pk.gear), Equip.rarity_color(int(pk.gear.r)), 11)
		loot.emit(Equip.icon(pk.gear.id), Equip.gear_name(pk.gear), Equip.rarity_color(int(pk.gear.r)), 0)
		emit_signal("msg", D.t("got_item", {"name": Equip.gear_name(pk.gear), "rarity": Equip.rarity_name(int(pk.gear.r))}))
		return
	if pk.item == "boss_essence":
		pickups.erase(c); pk.spr.queue_free(); Save.voc(voc).essence += 1; Save.save(); Sfx.play("gem", 0.5)
		float_text(at, "+1 " + D.ITEMS.boss_essence.name if D.ITEMS.has("boss_essence") else "+1 Essência", Color("ffa030")); return
	pickups.erase(c); pk.spr.queue_free(); tut.emit("loot")
	var info: Dictionary = D.ITEMS[pk.item]
	if not pk.item in ["gold", "silver"]:
		var nm: String = info.name
		loot.emit(A.tex("res://assets/art/%s.png" % info.icon), nm.substr(0, 1).to_upper() + nm.substr(1), Color("c8e0a0"), 0)
	match pk.item:
		"gold", "silver":
			if buff_on("luck"): pk.amount = roundi(pk.amount * 1.5)
			gold_run += pk.amount; loot.emit(Equip.item_icon("i_gold_coin"), "", Color(D.COLORS.gold), pk.amount); float_text(at, D.t("gold_float", {"n": pk.amount}), Color(D.COLORS.gold)); Sfx.play("pickup", 0.35)
		"red_gem":
			gold_run += info.gold; float_text(at, D.t("gold_float", {"n": info.gold}), Color(D.COLORS.gold)); Sfx.play("gem")
		"blue_gem":
			add_xp(info.xp); float_text(at, "+%d exp" % info.xp, Color(D.COLORS.soul)); Sfx.play("gem")
		_:
			heal(h.max_hp * info.healPct if info.has("healPct") else info.get("heal", 0)); Sfx.play("pickup", 0.35)
			if info.has("heal") and D.is_mana(voc):
				var mm: float = min(fury_max - h.fury, fury_max * info.heal / 100.0)
				if mm >= 1: h.fury += mm; float_text(at - Vector2(0, 18), "+%d mana" % roundi(mm), Color("7ab0ff"))

# ============================================================== efeitos visuais
func play_fx(name: String, at: Vector2, sc := 1.0, flip := false, rot := 0.0, keep := false, tint := Color.WHITE, add_blend := false) -> AnimatedSprite2D:
	var s := AnimatedSprite2D.new(); s.sprite_frames = A.fx(name)
	var f: Array = A.FX[name]
	if f.size() > 6:   # pivô do pixelfx
		s.centered = false; s.offset = -f[6]
	s.position = at; s.scale = Vector2(sc, sc); s.flip_h = flip; s.rotation = rot; s.modulate = tint
	if add_blend: var cm := CanvasItemMaterial.new(); cm.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD; s.material = cm
	fxl.add_child(s); s.play("play")
	if not keep and not s.sprite_frames.get_animation_loop("play"): s.animation_finished.connect(s.queue_free)
	return s
func fx(name: String, at: Vector2, sc: float, flip := false, angle_deg := 0.0) -> void:
	play_fx(name, at, sc, flip, deg_to_rad(angle_deg))
func light_spr(at: Vector2, c: Color, sc: float, alpha: float) -> Sprite2D:
	var g := Sprite2D.new(); g.texture = A.light_tex; g.position = at; g.scale = Vector2(sc, sc); g.modulate = Color(c, alpha)
	var cm := CanvasItemMaterial.new(); cm.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD; g.material = cm
	fxl.add_child(g); return g

func float_text(at: Vector2, s: String, c: Color, size := 10) -> Label:
	var l := Label.new(); l.text = s
	l.add_theme_font_override("font", FONT)
	l.add_theme_font_size_override("font_size", size * 2)
	l.add_theme_color_override("font_color", c)
	l.add_theme_color_override("font_outline_color", Color("0c0608")); l.add_theme_constant_override("outline_size", 6)
	l.scale = Vector2(0.5, 0.5)
	l.size = Vector2(160, 40); l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.pivot_offset = Vector2(80, 20); l.position = at - Vector2(80, 20)
	l.z_index = 200; fxl.add_child(l)
	var tw := create_tween().set_parallel()
	tw.tween_property(l, "position:y", l.position.y - 22, 0.7)
	tw.tween_property(l, "modulate:a", 0.0, 0.4).set_delay(0.3)
	tw.chain().tween_callback(l.queue_free)
	return l
func dmg_text(at: Vector2, amount: float, el_color) -> void:
	var n := roundi(amount)
	var c: Color = Color("ffd84a") if n > 120 else Color("ff4a3a") if n > 50 else (el_color if el_color else Color(D.COLORS.white))
	var l := float_text(at, str(n), c, 11)
	if n > 50:
		var k := 1.35 if n > 120 else 1.15
		l.scale = Vector2(0.5 * k, 0.5 * k)
		create_tween().tween_property(l, "scale", Vector2(0.5, 0.5), 0.26 if n > 120 else 0.2).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)

func splat(at: Vector2, n: int, c := Color("5a0a0a")) -> void:
	for i in n:
		var s := Sprite2D.new(); s.texture = A.shadow_tex
		s.position = at + Vector2(randf_range(-14, 14), randf_range(-6, 6))
		var k := randf_range(0.12, 0.32); s.scale = Vector2(k, k * 0.55)
		s.modulate = Color(c.r * 3.0, c.g * 3.0, c.b * 3.0, 0.9)
		ground.add_child(s)
		var tw := create_tween(); tw.tween_interval(8.0); tw.tween_property(s, "modulate:a", 0.0, 2.0); tw.tween_callback(s.queue_free)

var _shake_t := 0.0
func shake(dur: float, amp: float) -> void:
	var cam := get_viewport().get_camera_2d()
	if not cam: return
	var tw := create_tween()
	for i in int(dur / 0.03):
		tw.tween_property(cam, "offset", Vector2(randf_range(-amp, amp), randf_range(-amp, amp)), 0.03)
	tw.tween_property(cam, "offset", Vector2.ZERO, 0.03)
signal screen_flash(c: Color, dur: float)
func flash_screen(c: Color, dur: float) -> void: emit_signal("screen_flash", c, dur)

# ============================================================== bot de teste
func bot_dir() -> Vector2i:
	var h = hero
	if h.move_t > 0 or h.dead: return Vector2i.ZERO
	var best = null; var bd := 1e9
	for m in monsters:
		var d := Vector2(m.x - h.x, m.y - h.y).length()
		if d < bd: bd = d; best = m
	if best == null or bd < 1.5: return Vector2i.ZERO
	return Vector2i(signi(best.x - h.x), signi(best.y - h.y))

# ============================================================== andar: transições, corda, tocas, waypoint (floor.js, hero.js, waypoint.js)
signal fade(out: bool, dur: float)
func _transition(fn: Callable) -> void:
	paused = true; fade.emit(true, 0.25)
	await get_tree().create_timer(0.27).timeout
	fn.call(); paused = false; fade.emit(false, 0.3)

## E: tocas, waypoint ou corda
func interact() -> void:
	var h = hero
	if h.dead or finished or paused: return
	if try_hole(): return
	if wp != null and max(abs(h.x - wp.x), abs(h.y - wp.y)) <= 1: wp_step(); wp_menu(); return
	if rope == null or abs(h.x - rope.x) > 1 or abs(h.y - rope.y) > 1 or roping: return
	if floor_n > 1:
		roping = true
		_transition(func(): floor_n -= 1; build_floor("stairs"); roping = false; emit_signal("msg", D.t("rope_up", {"n": floor_n})))
		return
	leave_to_town("sewer")

func leave_to_town(spawn: String) -> void:
	if finished: return
	finished = true
	var d := Save.voc(voc); d.gold += roundi(gold_run * stats.greed); Save.add_kills(kills_by_type); Save.data.runs = Save.data.get("runs", 0) + 1; Save.save()
	Save.reg.townSpawn = spawn
	fade.emit(true, 0.4)
	await get_tree().create_timer(0.42).timeout
	get_tree().change_scene_to_file("res://town.tscn")

func hole_hint() -> void:
	var h = hero
	for d in D.DIRS8:
		var c := Vector2i(h.x + d.x, h.y + d.y)
		if holes.has(c): emit_signal("msg", D.t("hole_hint_in" if holes[c].inside else "hole_hint_out")); return

func try_hole() -> bool:
	var h = hero
	if holes.is_empty() or hole_busy: return hole_busy
	for d in D.DIRS8:
		var c := Vector2i(h.x + d.x, h.y + d.y)
		if not holes.has(c): continue
		var hole: Dictionary = holes[c]; var to: Vector2i = hole.to
		if not walkable(to.x, to.y) or occ.has(to):
			var best = null; var bd := 99
			for dy in range(-3, 4):
				for dx in range(-3, 4):
					var t := to + Vector2i(dx, dy)
					if walkable(t.x, t.y) and not occ.has(t) and abs(dx) + abs(dy) < bd: bd = abs(dx) + abs(dy); best = t
			if best == null: return true
			to = best
		hole_busy = true
		_transition(func():
			hole_busy = false; place_hero_at(to); reveal(); update_flow()
			emit_signal("msg", D.t("hole_enter" if hole.inside else "hole_exit")))
		return true
	return false

func wp_list() -> Dictionary:
	var d := Save.voc(voc)
	if not d.has("wps"): d.wps = {}
	return d.wps
func wp_step() -> void:
	var L := wp_list()
	if not L.has(region_id): L[region_id] = []
	if not floor_n in L[region_id]:
		L[region_id].append(floor_n); L[region_id].sort(); Save.save()
		emit_signal("msg", D.t("wp_on", {"region": region.name, "n": floor_n})); Sfx.play("levelup", 0.3)
	emit_signal("msg", D.t("wp_press", {"k": "E"}))
func wp_menu() -> void:
	if dlg == null or dlg.is_open(): return
	var opts := [[D.t("wp_town"), func(): dlg.close(); leave_to_town("waypoint")]]
	for f in wp_list().get(region_id, []):
		if int(f) == floor_n: continue
		opts.append([D.t("wp_floor", {"region": region.name, "n": int(f)}), func():
			dlg.close(); floor_n = int(f); _transition(func(): build_floor())])
	opts.append([D.t("wp_stay"), func(): dlg.close()])
	set_paused(true)
	dlg.say(D.t("wp_title"), D.t("wp_body"), opts.slice(0, 9))

func set_paused(v: bool) -> void: paused = v

# ---------------------------------------------------------------- armadilhas
func update_traps(dt: float) -> void:
	spike_t += dt
	var up := fmod(spike_t, 2.6) > 1.7; var ph := fmod(spike_t, 2.6)
	var h = hero
	for c in spikes:
		var s: Dictionary = spikes[c]
		if s.up != up: s.up = up; s.spr.visible = up
		s.warn.color.a = 0.0 if up else (0.25 + 0.2 * sin(time_ * 30) if ph > 1.2 else 0.0)
		if not up: continue
		if h.x == c.x and h.y == c.y and h.move_t <= 0 and time_ - h.get_meta("spike", -9.0) > 1: h.set_meta("spike", time_); hurt_hero(12)
		var m = occ.get(c)
		if m and not m.fly and time_ - m.get_meta("spike", -9.0) > 1: m.set_meta("spike", time_); damage_monster(m, 10)
	for cl in clouds.duplicate():
		cl.t -= dt; cl.tick -= dt
		cl.node.modulate.a = clamp(cl.t, 0.0, 1.0); cl.node.rotation += dt * 0.4
		if cl.tick <= 0:
			cl.tick = 0.5
			for d in [Vector2i.ZERO] + D.DIRS8:
				var c: Vector2i = cl.c + d
				if h.x == c.x and h.y == c.y: hurt_hero(6)
				var m = occ.get(c)
				if m: damage_monster(m, 6)
		if cl.t <= 0: cl.node.queue_free(); clouds.erase(cl)

func trigger_vent(v: Vector2i) -> void:
	emit_signal("msg", D.t("gas_trap")); Sfx.play("explode", 0.2)
	var n := Node2D.new(); n.position = Vector2(v.x * T + T / 2.0, v.y * T + T / 2.0); n.z_index = 90; fxl.add_child(n)
	for k in 10:
		var s := Sprite2D.new(); s.texture = A.light_tex; s.position = Vector2(randf_range(-T, T), randf_range(-T, T)); s.scale = Vector2.ONE * randf_range(0.3, 0.5); s.modulate = Color(0.44, 0.75, 0.23, 0.35); n.add_child(s)
	clouds.append({"c": v, "t": 4.0, "tick": 0.0, "node": n})

# ---------------------------------------------------------------- luzes (oscilação) e névoa da guerra
func update_lights(dt: float) -> void:
	for l in lights:
		l.ft -= dt
		if l.ft <= 0: l.ft = 0.06 + randf() * 0.18; l.target = 1 + (randf() * 2 - 1) * (0.25 if l.water else 0.12)
		l.f = lerpf(l.f, l.target, min(1.0, dt * 10))
		l.node.energy = l.base * l.f
		if l.has("glow"): l.glow.modulate.a = 0.16 * l.f + 0.04
	var aura := 1.8 if hero.aura_t > 0 else 1.0
	hero.light.texture_scale = 3.3 * T * 2 / 128.0 * aura * (0.97 + randf() * 0.06)

func _build_fog() -> void:
	fog_img = Image.create(gen.w, gen.h, false, Image.FORMAT_RGBA8)
	fog_img.fill(Color(0, 0, 0, 1))
	fog_tex = ImageTexture.create_from_image(fog_img)
	fog = Sprite2D.new(); fog.texture = fog_tex; fog.centered = false; fog.scale = Vector2(T, T); fog.z_index = 120
	fog.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	var cm := CanvasItemMaterial.new(); cm.light_mode = CanvasItemMaterial.LIGHT_MODE_UNSHADED; fog.material = cm
	fog.position = Vector2(-T / 2.0, -T / 2.0 - 6)
	fog_img.resize(gen.w, gen.h)
	ground.add_child(fog)

## o que o herói enxerga (raio 7) passa a ficar visível para sempre neste andar
func reveal() -> void:
	if fog_img == null or explored.size() != gen.w * gen.h: return
	var h = hero; var changed := false
	for dy in range(-7, 8):
		for dx in range(-7, 8):
			if dx * dx + dy * dy > 52: continue
			var x: int = h.x + dx; var y: int = h.y + dy
			if x < 0 or y < 0 or x >= gen.w or y >= gen.h: continue
			var i: int = y * gen.w + x
			if explored[i]: continue
			explored[i] = 1; changed = true
			fog_img.set_pixel(x, y, Color(0, 0, 0, 0))
	if changed:
		# o sprite fica deslocado meia casa: cada pixel cobre a casa e o filtro linear suaviza a borda
		fog.position = Vector2(0, -6); fog.offset = Vector2(-0.5, -0.5) + Vector2(0.5, 0.5)
		fog_tex.update(fog_img)

# ---------------------------------------------------------------- chefe, equipamentos e fim
func depth() -> float: return float(floor_n) / (6.0 * floors)
func roll_equip(m) -> Variant:
	var top: float = min(1.0, 0.12 + depth())
	var pool := []; var tot := 0.0
	for id in D.db.EQUIP:
		var e := Equip.E(id)
		if e.slot == "light" or not Equip.equip_ok(id, voc) or e.get("rank", 0) > top: continue
		var wt := 4.0 if e.get("rank", 0) >= top - 0.25 else 1.0
		pool.append([id, wt]); tot += wt
	var x := randf() * tot; var id = null
	for e in pool:
		x -= e[1]
		if x <= 0: id = e[0]; break
	if id == null: return null
	var W: Array = [0, 0, 40, 42, 18] if m.kind == "giant_spider" else [30, 34, 22, 10, 4] if m.elite else [46, 30, 14, 8, 2] if m.champion else [66, 23, 8, 3, 0]
	var s := 0.0
	for v in W: s += v
	var y := randf() * s; var r := 0
	while r < 4:
		y -= W[r]
		if y <= 0: break
		r += 1
	return Equip.gear_new(id, r)

func boss_fell(m) -> void:
	Sfx.play("boss", 0.6)
	emit_signal("msg", D.t("boss_fell", {"name": m.data.name}))
	gold_run += int(m.data.get("gold", 0))
	var d := Save.voc(voc)
	if not d.get("firstBoss", false):
		d.firstBoss = true; Save.save()
		get_tree().create_timer(1.8, false).timeout.connect(func(): emit_signal("msg", D.t("oracle_awake")))
	for o in monsters.duplicate():
		if o != m and not o.dead and not o.elite and max(abs(o.x - m.x), abs(o.y - m.y)) <= 10: o.hp = 0; monster_died(o)
	if floor_n >= floors:
		d.slopeOpen = true; Save.save(); _open_portal(m.x, m.y)
	else:
		stairs = Vector2i(m.x, m.y)
		if pickups.has(stairs):
			var pk: Dictionary = pickups[stairs]; pickups.erase(stairs); pk.spr.queue_free()
			var alt := free_neighbors(stairs)
			if alt.size(): drop(alt[0], pk.item, pk.get("gear"))
		fb._draw_stairs()

func _open_portal(bx: int, by: int) -> void:
	var best = null; var bd := 99
	for r in range(1, 8):
		for dy in range(-r, r + 1):
			for dx in range(-r, r + 1):
				var c := Vector2i(bx + dx, by + dy)
				if walkable(c.x, c.y) and not occ.has(c) and not pickups.has(c) and c != Vector2i(hero.x, hero.y) and abs(dx) + abs(dy) < bd: bd = abs(dx) + abs(dy); best = c
	if best == null: return
	var p := cell_pos(best.x, best.y)
	var por := play_fx("pfx_portal", p + Vector2(0, -T * 0.35 + T * 1.25 * 0.15), T * 1.25 / 150.0 * 2, false, 0.0, true)
	por.z_index = -2
	add_light(p - Vector2(0, T / 2.0), 3.5 * T, Color("4a8cff"))
	slope_pass = best
	get_tree().create_timer(1.8, false).timeout.connect(func(): emit_signal("msg", D.t("slope_pass_open")))

func _end_of_sewers() -> void:
	finished = true
	var d := Save.voc(voc); d.gold += roundi(gold_run * stats.greed); Save.add_kills(kills_by_type)
	Save.data.cleared[region_id + ":" + voc] = true; Save.save()
	if dlg:
		dlg.say(D.t("dungeon_won"), "O Rei Rato caiu e o portal leva à Encosta dos Goblins.\n\nA versão Godot vai até aqui: a Encosta continua só na versão em Phaser por enquanto.\n\nOuro guardado: %d · Nível %d · %d criaturas derrotadas." % [Save.gold(voc), hero.level, kills],
			[[D.t("back_to_city"), func(): dlg.close(); Save.reg.townSpawn = "sewer"; get_tree().change_scene_to_file("res://town.tscn")]])

func finish(victory: bool) -> void:
	if finished: return
	finished = true
	var earned := roundi(gold_run * stats.greed)
	var d := Save.voc(voc); d.gold += earned; Save.add_kills(kills_by_type); Save.data.runs = Save.data.get("runs", 0) + 1; Save.save()
	if dlg == null: get_tree().change_scene_to_file("res://town.tscn"); return
	var v: Dictionary = D.VOCATIONS[voc]
	dlg.say(D.t("dungeon_won") if victory else D.t("you_fell"), D.t("run_summary", {"d": 100, "f": floor_n, "total": floors, "lvl": hero.level, "k": kills, "g": earned, "voc": v.name, "bag": Save.gold(voc)}),
		[[D.t("descend_again"), func(): dlg.close(); Save.reg.startFloor = 0; get_tree().reload_current_scene()],
		 [D.t("back_to_city"), func(): dlg.close(); Save.reg.townSpawn = "sewer"; get_tree().change_scene_to_file("res://town.tscn")]])

# ---------------------------------------------------------------- volta à cidade (H): 5 s parado
func try_recall() -> void:
	if finished or hero.dead: return
	if recall_cd > 0: emit_signal("msg", D.t("recall_cd", {"n": ceili(recall_cd)})); return
	if recall_t > 0: return
	recall_t = 5.0; emit_signal("msg", D.t("recall_start"))
	play_fx("recall", Vector2(hero.px, hero.py - 20), 1.0)
func update_recall(dt: float) -> void:
	recall_cd = max(0.0, recall_cd - dt)
	if recall_t <= 0: return
	recall_t -= dt
	if recall_t <= 0: recall_cd = 60; leave_to_town("recall")

## poções de efeito (berserker, mago, caçador, sorte): bebidas pela mochila
func drink_buff(id: String) -> void:
	var d := Save.voc(voc); var P: Dictionary = D.db.POTIONS.get(id, {})
	if P.is_empty() or not P.has("dur") or hero.dead: return
	if hero.pot_cd.get(id, 0.0) > 0: emit_signal("msg", D.t("pot_cd", {"name": P.name, "s": ceili(hero.pot_cd[id])})); return
	if int(d.potions.get(id, 0)) <= 0: return
	d.potions[id] -= 1; hero.pot_cd[id] = float(P.cd); hero.buffs[id] = float(P.dur); Save.save()
	emit_signal("msg", "%s: %s" % [P.name, P.desc]); Sfx.play("gem", 0.4)
	pot_glow(Color("ffa030"))
