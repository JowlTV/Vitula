extends Node2D
## Vila de Karhyn (porte de town.js): rua de oeste a leste, lojas, Harpa Mágica, depot, Oráculo, waypoint e bueiro.
## O cenário vem do próprio jogo em Phaser (assets/townx: chão gerado + casas e props com as mesmas posições).
const T := 64
const TOWN_W := 46
const TOWN_H := 17
const WP_TOWN := Vector2i(41, 8)
const RECALL_SPOT := Vector2i(39, 8)
const FACE := {"smith": "face_smith", "potions": "face_potions", "depot": "face_depot", "locker": "face_depot", "inn": "face_inn"}
const ROOM := {"smith": "npc_smith", "inn": "npc_inn", "potions": "npc_potions", "depot": "npc_depot", "locker": "npc_depot"}

var voc := "knight"
var solid := {}
var zones: Array = []
var hero
var world: Node2D
var dlg
var cam: Camera2D
var hud: CanvasLayer
var hint: Label
var gold_lbl: Label
var leaving := false
var lore_n := {}
var _dir_t0 := -1.0
var map_box: Control

func _ready() -> void:
	voc = Save.reg.get("vocation", "knight")
	Engine.time_scale = 1.0
	var d := Save.voc(voc)
	Equip.starter_gear(voc)
	world = Node2D.new(); add_child(world)
	var cm := CanvasModulate.new(); cm.color = Color(0.86, 0.87, 0.93); add_child(cm)
	_build()
	_spawn_hero()
	dlg = load("res://scripts/dialog.gd").new(); add_child(dlg)
	dlg.closed.connect(_refresh_gold)
	_build_ui()
	Sfx.music("music_town", 0.5)
	if not d.get("tutTown", false):
		get_tree().create_timer(3.2).timeout.connect(func():
			if dlg.is_open() or leaving: return
			d.tutTown = true; Save.save()
			dlg.say("Karhyn", D.t("town_welcome"), [[D.t("understood"), func(): dlg.close()]]))
	if "teste" in OS.get_cmdline_user_args(): _teste()

# ------------------------------------------------------------ cenário
func _build() -> void:
	var info = JSON.parse_string(FileAccess.get_file_as_string("res://assets/townx/town.json"))
	for k in info.solid: solid[Vector2i(int(k) % 1000, int(k) / 1000)] = true
	for z in info.zones:
		if z.kind == "waypoint": continue
		zones.append(z)
	zones.append({"kind": "library", "x": 31, "y": 7, "w": 3, "h": 1, "step": false})
	zones.append({"kind": "waypoint", "x": WP_TOWN.x, "y": WP_TOWN.y, "w": 1, "h": 1, "step": false})
	if Save.voc(voc).get("firstBoss", false): zones.append({"kind": "hall", "x": 37, "y": 8, "w": 4, "h": 1, "step": false})
	var objs = JSON.parse_string(FileAccess.get_file_as_string("res://assets/townx/objs.json"))
	var add_mat := CanvasItemMaterial.new(); add_mat.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	for o in objs:
		if not o.v: continue
		var tex := UI.tex("res://assets/townx/%s.png" % o.k)
		if tex == null: continue
		var s := Sprite2D.new(); s.texture = tex; s.centered = false
		s.offset = -Vector2(o.ox * tex.get_width(), o.oy * tex.get_height())
		s.position = Vector2(o.x, o.y); s.scale = Vector2(o.sx, o.sy); s.flip_h = o.fl
		s.modulate = UI.color_int(int(o.t)); s.modulate.a = o.a
		s.z_index = clampi(int(o.d), -4000, 4000)
		if int(o.b) == 1: s.material = add_mat; s.z_index = 3000
		if o.k == "town_ground": s.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		world.add_child(s)
	# luzes quentes dos lampiões e azul do waypoint
	for o in objs:
		if o.k == "k2_lamp":
			var l := PointLight2D.new(); l.texture = A.light_tex; l.texture_scale = 3.2; l.energy = 0.7; l.color = Color(1, 0.72, 0.4)
			l.position = Vector2(o.x, o.y - 40); world.add_child(l)
	var wp := Sprite2D.new(); wp.texture = load("res://assets/waypoint.png")
	wp.position = Vector2(WP_TOWN.x * T + T / 2.0, WP_TOWN.y * T + T / 2.0); wp.scale = Vector2.ONE * (T * 0.82 / wp.texture.get_width())
	wp.z_index = WP_TOWN.y * T; world.add_child(wp)
	var wl := PointLight2D.new(); wl.texture = A.light_tex; wl.texture_scale = 2.2; wl.energy = 0.9; wl.color = Color("8ac8ff"); wl.position = wp.position; world.add_child(wl)
	var tw := create_tween().set_loops(); tw.tween_property(wl, "energy", 0.35, 1.1); tw.tween_property(wl, "energy", 0.9, 1.1)

func is_solid(x: int, y: int) -> bool: return x < 0 or y < 0 or x >= TOWN_W or y >= TOWN_H or solid.has(Vector2i(x, y))

# ------------------------------------------------------------ herói
func _spawn_hero() -> void:
	var from: String = Save.reg.get("townSpawn", "gate")
	var p := Vector2i(4, 9)
	match from:
		"here": p = Save.reg.get("townPos", p)
		"recall": p = RECALL_SPOT
		"waypoint": p = WP_TOWN + Vector2i(0, 1)
		"sewer": p = Vector2i(41, 9)
	hero = load("res://scripts/hero.gd").new(); world.add_child(hero)
	hero.setup(voc, D.voc_scale(voc))
	hero.light.energy = 0.6
	hero.x = p.x; hero.y = p.y; hero.facing = Vector2i(-1, 0) if from == "sewer" else Vector2i(1, 0)
	var c := _cell(p.x, p.y); hero.px = c.x; hero.py = c.y
	_place()
	cam = Camera2D.new(); cam.limit_left = 0; cam.limit_top = 0; cam.limit_right = TOWN_W * T; cam.limit_bottom = TOWN_H * T
	cam.position_smoothing_enabled = true; cam.position_smoothing_speed = 9.0
	var z: float = Save.data.settings.get("zoom", 1.0); cam.zoom = Vector2(z, z) * 1.25
	add_child(cam); cam.position = hero.position + Vector2(0, -24); cam.reset_smoothing()

func _cell(x: int, y: int) -> Vector2: return Vector2(x * T + T / 2.0, y * T + T - 4)
func _place() -> void:
	hero.position = Vector2(roundf(hero.px), roundf(hero.py + 4)); hero.z_index = int(hero.py)

func _process(dt0: float) -> void:
	var dt: float = min(0.05, dt0)
	var h = hero
	if h.move_t > 0:
		h.move_t = max(0.0, h.move_t - dt)
		var k: float = 1.0 - h.move_t / h.move_len
		var to := _cell(h.x, h.y)
		h.px = lerpf(h.from_x, to.x, k); h.py = lerpf(h.from_y, to.y, k)
		if h.move_t == 0: _arrived()
	var busy: bool = dlg.is_open() or leaving or map_box != null or Bag.is_open() or Best.is_open() or Talents.is_open()
	if h.move_t == 0 and not busy:
		var dx := int(Input.is_action_pressed("andar_dir")) - int(Input.is_action_pressed("andar_esq"))
		var dy := int(Input.is_action_pressed("andar_baixo")) - int(Input.is_action_pressed("andar_cima"))
		if Touch.dir != Vector2i.ZERO: dx = Touch.dir.x; dy = Touch.dir.y
		if dx == 0 and dy == 0: _dir_t0 = -1.0
		else:
			var now := Time.get_ticks_msec() / 1000.0
			if _dir_t0 < 0: _dir_t0 = now
			if (dx != 0 and dy != 0) or now - _dir_t0 >= 0.07 or h.walk_hold > 0: _try_move(dx, dy)
	if h.move_t > 0: h.walk_hold = 0.12
	else: h.walk_hold = max(0.0, h.walk_hold - dt)
	var fx: int = h.facing.x
	var dir := "side" if fx != 0 else ("up" if h.facing.y < 0 else "down")
	if fx != 0: h.look_left = fx < 0
	var anim := ("walk" if h.walk_hold > 0 else "idle") + "_" + dir
	if h.spr.animation != anim: h.spr.play(anim)
	h.spr.flip_h = dir == "side" and h.look_left
	_place()
	cam.position = hero.position + Vector2(0, -24)
	var z = zone_here()
	hint.text = "" if z == null or z.get("step", false) or busy else "E · " + zone_name(z)

func _try_move(dx: int, dy: int) -> void:
	var h = hero
	h.facing = Vector2i(dx, dy)
	if dx != 0 and dy != 0 and (is_solid(h.x + dx, h.y) or is_solid(h.x, h.y + dy)):
		if not is_solid(h.x + dx, h.y): dy = 0
		elif not is_solid(h.x, h.y + dy): dx = 0
		else: return
		h.facing = Vector2i(dx, dy)
	var nx: int = h.x + dx; var ny: int = h.y + dy
	if is_solid(nx, ny): return
	h.from_x = h.px; h.from_y = h.py; h.x = nx; h.y = ny
	h.move_len = (0.36 if dx != 0 and dy != 0 else 0.264) / (Save.data.settings.get("speed", 0.75) / 0.75)
	h.move_t = h.move_len

func _arrived() -> void:
	var z = zone_here()
	if z and z.get("step", false): use(z)

func zone_here() -> Variant:
	for z in zones:
		if hero.x >= z.x and hero.x < z.x + z.w and hero.y >= z.y and hero.y < z.y + z.h: return z
	return null

func zone_name(z) -> String:
	match z.kind:
		"smith": return D.t("zone_smith_enter")
		"inn": return D.t("tavern_title")
		"potions": return D.t("zone_potions_enter")
		"depot": return D.t("zone_depot_enter")
		"locker": return D.t("zone_locker")
		"lodging": return D.t("lodging_title")
		"hall": return D.t("zone_oracle")
		"sewer": return D.t("zone_sewer_enter")
		"gate": return D.t("zone_gate")
		"waypoint": return D.t("wp_title")
		"library": return D.t("library_name")
	return z.kind

func _unhandled_input(e: InputEvent) -> void:
	if not (e is InputEventKey and e.pressed and not e.echo): return
	if Bag.is_open() or Best.is_open() or Talents.is_open(): return
	match e.keycode:
		KEY_E, KEY_ENTER:
			if not dlg.is_open() and map_box == null:
				var z = zone_here()
				if z: use(z)
		KEY_M: _toggle_map()
		KEY_N:
			if not dlg.is_open(): Best.open(self)
		KEY_U:
			if not dlg.is_open(): Talents.open(self, voc, false)
		KEY_I, KEY_B:
			if not dlg.is_open(): Bag.open(self, voc, true)
		KEY_ESCAPE, KEY_P:
			if map_box: _toggle_map()
			elif not dlg.is_open(): dlg.say("Karhyn", D.t("what_to_do"), [[D.t("continue_label"), func(): dlg.close()], [D.t("back_to_menu"), func(): leave("menu")]])
		KEY_EQUAL, KEY_KP_ADD: _zoom(0.1)
		KEY_MINUS, KEY_KP_SUBTRACT: _zoom(-0.1)

func _zoom(dz: float) -> void:
	var z: float = clamp(Save.data.settings.get("zoom", 1.0) + dz, 0.7, 2.0); Save.data.settings.zoom = z; Save.save()
	cam.zoom = Vector2(z, z) * 1.25

# ------------------------------------------------------------ lugares
func _face(kind: String) -> Texture2D: return UI.tex("res://assets/interior/%s.png" % FACE[kind]) if FACE.has(kind) else null

func say(kind: String, title: String, body: String, buttons: Array) -> void:
	dlg.say(title, body, buttons, _face(kind))

func lore(kind: String, title: String, back: Callable) -> Array:
	var L: Array = []
	var n := 1
	while true:
		var k := "lore_%s_%d" % [kind, n]
		var s := D.t(k)
		if s == k: break
		L.append(s); n += 1
	return [D.t("ask_lore"), func():
		var i: int = lore_n.get(kind, 0) % L.size(); lore_n[kind] = lore_n.get(kind, 0) + 1
		say(kind, title, L[i], [[D.t("lore_more") if lore_n[kind] % L.size() else D.t("lore_restart"), func(): lore(kind, title, back)[1].call()], [D.t("lore_back"), back]])]

func use(z) -> void:
	var d := Save.voc(voc)
	var kind: String = z.kind
	if ROOM.has(kind): dlg.show_room("res://assets/interior/%s.jpg" % ROOM[kind])
	match kind:
		"gate":
			say(kind, D.t("zone_gate"), D.t("gate_ask"), [[D.t("gate_leave"), func(): leave("menu")], [D.t("gate_stay"), func(): dlg.close()]])
		"sewer":
			say(kind, D.t("sewer_title"), D.t("sewer_desc"), [[D.t("sewer_go"), func():
				Save.reg.region = "karhyn_sewers"; Save.reg.startFloor = 0; leave("dungeon")], [D.t("sewer_wait"), func(): dlg.close()]])
		"potions":
			var n := 0
			for k in d.potions: n += int(d.potions[k])
			say(kind, D.t("potion_seller"), D.t("potion_greet", {"voc": D.VOCATIONS[voc].name.to_lower(), "n": n, "gold": int(d.gold)}),
				[[D.t("see_potions"), func(): Shops.potion_shop(self)], lore("potions", D.t("potion_seller"), func(): use(z)), [D.t("bye"), func(): dlg.close()]])
		"depot":
			say(kind, D.t("depot_guard"), D.t("depot_greet", {"gold": int(d.gold)}),
				[[D.t("open_locker"), func(): Shops.locker(self)], lore("depot", D.t("depot_guard"), func(): use(z)), [D.t("thanks"), func(): dlg.close()]])
		"locker": Shops.locker(self)
		"smith":
			var opts := [[D.t("upgrade_gear"), func(): Shops.forge(self)]]
			if voc == "archer": opts.append([D.t("buy_arrows"), func(): Shops.arrow_shop(self)])
			opts.append(lore("smith", D.t("smith_title"), func(): use(z)))
			opts.append([D.t("bye2"), func(): dlg.close()])
			say(kind, D.t("smith_title"), D.t("smith_greet"), opts)
		"inn":
			say(kind, D.t("tavern_title"), D.t("tavern_desc"), [[D.t("zone_board"), func(): Shops.board(self)], lore("inn", D.t("tavern_title"), func(): use(z)), [D.t("leave"), func(): dlg.close()]])
		"lodging":
			say(kind, D.t("lodging_title"), D.t("lodging_desc"), [[D.t("lodging_rest"), func(): dlg.close(); _fade(0.3, 0.6)], lore("lodging", D.t("lodging_title"), func(): use(z)), [D.t("leave"), func(): dlg.close()]])
		"hall":
			say(kind, D.t("zone_oracle"), D.t("oracle_after"), [[D.t("talent_respec_opt"), func(): dlg.close(); Talents.open(self, voc, true)], [D.t("leave"), func(): dlg.close()]])
		"waypoint": _wp_menu()
		"library": Best.open(self)

func _wp_menu() -> void:
	var wps: Array = Save.voc(voc).get("wps", {}).get("karhyn_sewers", [])
	if wps.is_empty():
		say("", D.t("wp_title"), D.t("wp_none"), [[D.t("leave"), func(): dlg.close()]]); return
	var opts := []
	for f in wps.slice(0, 7):
		opts.append([D.t("wp_floor", {"region": D.db.REGIONS.karhyn_sewers.name, "n": int(f)}), func():
			dlg.close(); Save.reg.region = "karhyn_sewers"; Save.reg.startFloor = int(f); Save.reg.wpArrive = true; leave("dungeon")])
	opts.append([D.t("wp_stay"), func(): dlg.close()])
	say("", D.t("wp_title"), D.t("wp_body"), opts)

func _fade(out_t: float, in_t: float) -> void:
	var r := ColorRect.new(); r.color = Color(0, 0, 0, 0); r.size = Vector2(960, 540); r.mouse_filter = Control.MOUSE_FILTER_IGNORE; hud.add_child(r)
	var tw := create_tween(); tw.tween_property(r, "color:a", 1.0, out_t); tw.tween_property(r, "color:a", 0.0, in_t); tw.tween_callback(r.queue_free)

func leave(scene: String) -> void:
	if leaving: return
	leaving = true; dlg.close()
	Save.reg.townSpawn = "sewer" if scene == "dungeon" else "gate"
	Save.reg.townPos = Vector2i(hero.x, hero.y)
	Save.save()
	_fade(0.4, 5.0)
	await get_tree().create_timer(0.42).timeout
	match scene:
		"dungeon": get_tree().change_scene_to_file("res://game.tscn")
		_: get_tree().change_scene_to_file("res://menu.tscn")

# ------------------------------------------------------------ interface
func _build_ui() -> void:
	hud = CanvasLayer.new(); hud.layer = 5; add_child(hud)
	var vig := TextureRect.new(); vig.texture = UI.tex("res://assets/ui/vignette.png"); vig.size = Vector2(960, 540); vig.expand_mode = TextureRect.EXPAND_IGNORE_SIZE; vig.modulate.a = 0.55; vig.mouse_filter = Control.MOUSE_FILTER_IGNORE; hud.add_child(vig)
	var title := UI.lbl(D.t("town_name"), 35, UI.GOLD, true); title.position = Vector2(0, 100); title.size = Vector2(960, 50)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; title.modulate.a = 0; title.add_theme_constant_override("outline_size", 9); hud.add_child(title)
	var tw := create_tween(); tw.tween_property(title, "modulate:a", 1.0, 1.1); tw.tween_interval(4.2); tw.tween_property(title, "modulate:a", 0.0, 2.2)
	gold_lbl = UI.lbl("", 14, UI.GOLD); gold_lbl.position = Vector2(700, 12); gold_lbl.size = Vector2(246, 20); gold_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT; hud.add_child(gold_lbl)
	_refresh_gold()
	var c := UI.lbl(D.t("town_controls_touch") if Touch.enabled else D.t("town_controls"), 12); c.position = Vector2(14, 514); hud.add_child(c)
	hint = UI.lbl("", 16); hint.position = Vector2(0, 460); hint.size = Vector2(960, 24); hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; hud.add_child(hint)
	Touch.attach(hud, self)

func _refresh_gold() -> void:
	if gold_lbl: gold_lbl.text = "%s · %d de ouro · Nv %d" % [D.VOCATIONS[voc].name, Save.gold(voc), Save.level(voc)]

func touch_action(a: String) -> void:
	match a:
		"interact":
			var z = zone_here()
			if z and not dlg.is_open(): use(z)
		"bag": Bag.open(self, voc, true)
		"map": _toggle_map()

func _toggle_map() -> void:
	if map_box: map_box.queue_free(); map_box = null; return
	if dlg.is_open(): return
	map_box = Control.new(); map_box.size = Vector2(960, 540); hud.add_child(map_box)
	var bg := ColorRect.new(); bg.color = Color(0, 0, 0, 0.72); bg.size = Vector2(960, 540); map_box.add_child(bg)
	bg.gui_input.connect(func(e): if e is InputEventMouseButton and e.pressed: _toggle_map())
	var S := 19.0; var mx := (960 - TOWN_W * S) / 2; var my := 150.0
	var info = JSON.parse_string(FileAccess.get_file_as_string("res://assets/townx/town.json"))
	var img := Image.create(TOWN_W, TOWN_H, false, Image.FORMAT_RGBA8)
	for y in TOWN_H:
		for x in TOWN_W:
			var t: String = info.ground[y][x]
			var col := Color("55524c") if t == "w" else Color("7a746a") if t in ["c", "s"] else Color("6a5236") if t == "d" else Color("2e3a26")
			if t != "w" and solid.has(Vector2i(x, y)): col = Color("6a3a2a")
			img.set_pixel(x, y, col)
	var tr := TextureRect.new(); tr.texture = ImageTexture.create_from_image(img); tr.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE; tr.position = Vector2(mx, my); tr.size = Vector2(TOWN_W * S, TOWN_H * S); map_box.add_child(tr)
	var tl := UI.lbl(D.t("town_name"), 30, UI.GOLD, true); tl.position = Vector2(0, 90); tl.size = Vector2(960, 40); tl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; map_box.add_child(tl)
	var names := {"smith": "smith_title", "inn": "inn_name", "potions": "potions_name", "depot": "depot_name", "lodging": "lodging_title", "hall": "oracle_name", "sewer": "sewer_name", "gate": "gate_name", "waypoint": "wp_title"}
	for z in zones:
		if not names.has(z.kind): continue
		var p := Vector2(mx + (z.x + z.w / 2.0) * S, my + (z.y + z.h / 2.0) * S)
		map_box.add_child(UI.box(Rect2(p - Vector2(4, 4), Vector2(8, 8)), UI.GOLD, UI.GOLD))
		var l := UI.lbl(D.t(names[z.kind]), 11); l.position = p + Vector2(-60, -22 if z.y < 9 else 8); l.size = Vector2(120, 14); l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; map_box.add_child(l)
	map_box.add_child(UI.box(Rect2(Vector2(mx + (hero.x + 0.5) * S - 5, my + (hero.y + 0.5) * S - 5), Vector2(10, 10)), Color("7fe08a"), Color("7fe08a")))
	var cl := UI.lbl(D.t("tab_close"), 11, UI.DIM); cl.position = Vector2(0, my + TOWN_H * S + 14); cl.size = Vector2(960, 14); cl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; map_box.add_child(cl)

# ------------------------------------------------------------ teste automático
func _teste() -> void:
	var dir: String = OS.get_cmdline_user_args()[0]
	await get_tree().create_timer(1.5).timeout; await _shot(dir + "/t1_chegada.png")
	for kind in ["smith", "potions", "depot", "inn"]:
		for z in zones:
			if z.kind == kind:
				hero.x = z.x; hero.y = z.y; var c := _cell(z.x, z.y); hero.px = c.x; hero.py = c.y; use(z); break
		await get_tree().create_timer(0.8).timeout; await _shot(dir + "/t2_%s.png" % kind)
		dlg._send(0); await get_tree().create_timer(0.8).timeout; await _shot(dir + "/t3_%s.png" % kind)
		dlg.close(); await get_tree().create_timer(0.4).timeout
	_toggle_map(); await get_tree().create_timer(0.3).timeout; await _shot(dir + "/t4_mapa.png"); _toggle_map()
	Bag.open(self, voc, true); await get_tree().create_timer(0.5).timeout; await _shot(dir + "/t5_mochila.png"); Bag.close()
	Talents.open(self, voc, false); await get_tree().create_timer(0.5).timeout; await _shot(dir + "/t6_teia.png"); Talents.close()
	print("TESTE CIDADE ok ouro=%d" % Save.gold(voc))
	get_tree().quit()

func _shot(p: String) -> void:
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(p)
