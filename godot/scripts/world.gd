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
var walls := {}          # Vector2i -> true
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
	if level > d.level: d.level = level
	stats = compute_stats()
	ground = Node2D.new(); add_child(ground)
	ents = Node2D.new(); ents.y_sort_enabled = true; add_child(ents)
	fxl = Node2D.new(); fxl.z_index = 100; add_child(fxl)
	var cm := CanvasModulate.new(); cm.color = Color(0.62, 0.62, 0.7); add_child(cm)
	build_arena()
	hero = load("res://scripts/hero.gd").new()
	ents.add_child(hero)
	hero.setup(v, D.voc_scale(v))
	hero.level = d.level
	hero.max_hp = stats.maxHp + 10 * (hero.level - 1)
	hero.hp = hero.max_hp
	hero.fury = fury_max if D.is_mana(v) else 0.0
	for s in spells: hero.cds[s] = 0.0
	hero.x = 4; hero.y = MH / 2
	var p := cell_pos(hero.x, hero.y); hero.px = p.x; hero.py = p.y
	update_flow()
	for i in 14: spawn_random()
	_place_hero()

func build_arena() -> void:
	# sala grande do esgoto com pilares e barris (arte do Phaser: floor, wall_top_v3, wall_front_v3)
	var floor_tex: Texture2D = A.tex("res://assets/art/floor.png")
	var top: Texture2D = A.tex("res://assets/art/wall_top_v3.png")
	var front: Texture2D = A.tex("res://assets/art/wall_front_v3.png")
	var fl := Sprite2D.new(); fl.texture = floor_tex; fl.texture_repeat = CanvasItem.TEXTURE_REPEAT_ENABLED
	fl.region_enabled = true; fl.region_rect = Rect2(0, 0, MW * T, MH * T); fl.centered = false
	ground.add_child(fl)
	for yy in MH:
		for xx in MW:
			var border := xx == 0 or yy == 0 or xx == MW - 1 or yy == MH - 1
			var pillar := (xx % 6 == 3 and yy % 5 == 2) and not border
			if border or pillar: walls[Vector2i(xx, yy)] = true
	for c in walls:
		var below: Vector2i = c + Vector2i(0, 1)
		var s := Sprite2D.new(); s.centered = false; s.position = Vector2(c.x * T, c.y * T)
		var tx: Texture2D = front if (not walls.has(below) and below.y < MH) else top
		s.texture = tx; s.scale = Vector2(T / float(tx.get_width()), T / float(tx.get_height()))
		ground.add_child(s)
	for c in [Vector2i(8, 3), Vector2i(9, 3), Vector2i(15, 14), Vector2i(20, 4), Vector2i(21, 12)]:
		add_prop(c, "barrel")

func add_prop(c: Vector2i, kind: String) -> void:
	var s := Sprite2D.new(); s.texture = A.tex("res://assets/art/%s.png" % kind)
	var p := cell_pos(c.x, c.y); s.position = p + Vector2(0, 4); s.offset = Vector2(0, -s.texture.get_height() / 2.0)
	var k: float = D.db.PROP_H.get(kind, 40) / float(s.texture.get_height()); s.scale = Vector2(k, k)
	ents.add_child(s)
	props[c] = {"kind": kind, "hits": 0, "spr": s}

func cell_pos(cx: int, cy: int) -> Vector2: return Vector2(cx * T + T / 2.0, cy * T + T * 0.82)
func is_floor(cx: int, cy: int) -> bool: return cx >= 0 and cy >= 0 and cx < MW and cy < MH and not walls.has(Vector2i(cx, cy))
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
	s.weaponAtk = D.db.FIST_ATTACK; s.gearDef = 0; s.gearBlock = 0; s.gearDodge = 0; s.gearCrit = 0; s.gearMl = 0
	return s
func attr(id: String) -> int: return Save.voc(voc).attr.get(id, 0)
func sword_eff() -> float: return attr("weapon") + Save.skill(voc, "distance" if ranged else "sword").lvl
func shield_lvl() -> float: return Save.skill(voc, "shield").lvl + attr("shield")
func ml_eff() -> float: return Save.voc(voc).ml.lvl + attr("ml") + stats.gearMl
func defense_value() -> float:
	var v: float = stats.armor + stats.gearDef + 0.25 * (shield_lvl() - D.SKILLS.shield.start)
	return v * 1.54 if hero.guard_t > 0 else v        # Égide: +54% de defesa
func block_chance() -> float:
	if ranged: return min(0.35, 0.05 + 0.006 * (Save.skill(voc, "dodge").lvl - D.SKILLS.dodge.start))
	return min(0.6, min(0.35, 0.05 + 0.006 * (shield_lvl() - D.SKILLS.shield.start)) + 0.005 * attr("block") + stats.gearBlock)
func promo():
	var p = D.db.PROMOTION.get(voc)
	return p if p and Save.voc(voc).get("promoted", false) else null
func max_damage() -> float:
	var pm = promo()
	return (0.085 * stats.weaponAtk * sword_eff() + hero.level / 5.0) * stats.might * (pm.dmgMult if pm else 1.0)
func base_damage() -> float:
	return max_damage() * 0.8 * (1.6 if hero.frenzy_t > 0 else 1.0) * (1.4 if hero.kber_t > 0 else 1.0)
func crit_chance() -> float: return 0.1 + 0.005 * attr("crit") + stats.gearCrit + (0.15 if hero.frenzy_t > 0 else 0.0)
func crit_mult() -> float: return 1.8
func xp_next() -> float: return 8 * pow(hero.level, 1.35)
func range_now() -> int: return ranged + (2 if hero.eagle_t > 0 else 0) + (6 if hero.far_t > 0 else 0)
func spell_unlocked(id: String) -> bool:
	# etapa 1: libera pelo nível (a teia de talentos entra na etapa 4)
	return hero.level >= int(spells[id].level)

# ============================================================== laço principal
func _physics_process(raw_dt: float) -> void:
	if hero == null or finished or paused: return
	var dt: float = min(0.05, raw_dt)
	time_ += dt
	update_hero(dt)
	for m in monsters.duplicate(): update_monster(m, dt)
	skill_tick(dt)
	if time_ > next_wave: spawn_wave(); next_wave = time_ + randf_range(90, 180)
	if monsters.size() < 6: spawn_random(true)

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
	update_flow()

func hero_arrived() -> void:
	var k := Vector2i(hero.x, hero.y)
	if pickups.has(k): collect(k)

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
	tw.finished.connect(func(): a.queue_free(); on_hit.call())

func arrow_hit(t, mult: float, el := "physical") -> void:
	var crit := randf() < crit_chance()
	var far: bool = hero.far_t > 0
	var hp0: float = t.hp
	var dmg := base_damage() * mult * randf_range(0.85, 1.15) * (crit_mult() if crit else 1.0)
	damage_monster(t, dmg, "holy" if far else el)
	hit_fx(t, crit)
	if far: far_mark(t, hp0)

func archer_attack(dt: float) -> void:
	var h = hero
	h.eagle_t = max(0.0, h.eagle_t - dt); h.flee_t = max(0.0, h.flee_t - dt); h.frenzy_t = max(0.0, h.frenzy_t - dt)
	if h.atk_t > 0 or not (auto_attack or h.atk_queued > 0): return
	h.atk_queued = 0
	var t = ranged_target(true)
	if not t: return
	h.atk_t = 1.1 / 1.25 * stats.cooldown / stats.atkSpeed * (0.5 if h.eagle_t > 0 else 1.0) / (1.4 if h.flee_t > 0 else 1.0)
	var dx := signi(t.x - h.x); var dy := signi(t.y - h.y)
	h.facing = Vector2i(dx, dy)
	var side: bool = abs(t.x - h.x) >= abs(t.y - h.y)
	hero_swing(dx if side else 0, 0 if side else dy)
	await get_tree().create_timer(0.3, false).timeout
	if h.dead or finished: return
	shoot_arrow(Vector2(h.px, h.py - 40), Vector2(t.px, t.py - 24), func():
		if t.dead or finished: return
		arrow_hit(t, 1.0)
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
	var real: float = max(1.0, max(amount * 0.25, amount - defense_value()))   # a defesa nunca anula mais que 75%
	h.hp -= real; h.flash = 1
	add_fury(4)
	float_text(Vector2(h.px + randf_range(-6, 6), h.py - 66), str(roundi(real)), Color(D.COLORS.hurt))
	Sfx.play("hurt", 0.35)
	if real >= h.max_hp * 0.1:
		if not h.attack_t > 0: h.pose = "hurt"; h.pose_t = 0.42
		shake(0.13, 4); splat(Vector2(h.px, h.py - 2), 6)
	if attacker and not attacker.dead and h.guard_t > 0 and amount > 0: damage_monster(attacker, max(1.0, amount * 0.1))   # Égide devolve 10%
	if h.hp <= 0:
		h.hp = 0; h.dead = true
		h.spr.play("death")
		emit_signal("msg", D.t("you_died") if D.i18n.pt.has("you_died") else "Você morreu.")
		get_tree().create_timer(2.5, false).timeout.connect(func(): get_tree().reload_current_scene())

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
	if h.dead or amount <= 0: return
	var before: float = h.hp; h.hp = min(h.max_hp, h.hp + amount)
	if show and h.hp - before >= 1: float_text(Vector2(h.px, h.py - 66), "+%d" % roundi(h.hp - before), Color(D.COLORS.heal))

func add_fury(v: float) -> void:
	if D.is_mana(voc): return
	hero.fury = min(fury_max, hero.fury + v); hero.fury_idle = 0

func add_xp(v: float) -> void:
	v *= 0.95
	var h = hero; var d := Save.voc(voc)
	h.xp += v * stats.growth
	while h.xp >= xp_next():
		h.xp -= xp_next(); h.level += 1; h.max_hp += 10; h.hp = h.max_hp
		float_text(Vector2(h.px, h.py - 84), D.t("level_up_float", {"n": h.level}), Color(D.COLORS.gold))
		emit_signal("msg", D.t("level_up_talent", {"n": h.level}))
		d.charges[1] = 1.0
		if D.is_mana(voc): h.fury = fury_max
		Sfx.play("levelup", 0.4)
		check_promotion()
	d.level = h.level; d.xp = h.xp; Save.save()

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
		kills += 1
		add_xp(m.data.xp * (5 if m.champion else 1))
		var c := Vector2i(m.x, m.y)
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
	var tw := create_tween(); tw.tween_interval(3.8); tw.tween_property(m, "modulate:a", 0.0, 1.2); tw.tween_callback(m.queue_free)

# ============================================================== itens no chão
func drop(c: Vector2i, item: String) -> void:
	if item == "none" or not D.ITEMS.has(item): return
	if pickups.has(c):
		var alt := free_neighbors(c)
		if alt.is_empty(): return
		c = alt[0]
	var p := cell_pos(c.x, c.y)
	var s := Sprite2D.new(); s.texture = A.tex("res://assets/art/%s.png" % D.ITEMS[item].icon)
	s.position = p + Vector2(0, 6); s.offset = Vector2(0, -s.texture.get_height() / 2.0); s.z_index = -1
	ents.add_child(s)
	var amount := 0
	if item == "gold": amount = randi_range(5, 12)
	if item == "silver": amount = randi_range(2, 5)
	if amount: amount = roundi(amount * (1 + 0.2 * (floor_n - 1)))
	pickups[c] = {"item": item, "amount": amount, "spr": s}
	if c == Vector2i(hero.x, hero.y): collect(c)

func free_neighbors(c: Vector2i) -> Array:
	var out := []
	for d in [Vector2i(0, 1), Vector2i(-1, 0), Vector2i(1, 0), Vector2i(0, -1), Vector2i(1, 1), Vector2i(-1, 1)]:
		var n: Vector2i = c + d
		if walkable(n.x, n.y) and not pickups.has(n): out.append(n)
	return out

func collect(c: Vector2i) -> void:
	var pk: Dictionary = pickups[c]; pickups.erase(c); pk.spr.queue_free()
	var info: Dictionary = D.ITEMS[pk.item]; var h = hero; var at := Vector2(h.px, h.py - 60)
	match pk.item:
		"gold", "silver":
			gold_run += pk.amount; float_text(at, D.t("gold_float", {"n": pk.amount}), Color(D.COLORS.gold)); Sfx.play("pickup", 0.35)
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
