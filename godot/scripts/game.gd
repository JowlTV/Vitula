extends Node2D
## Esgoto de Karhyn: mundo + câmera (Phantom Camera) + HUD + conversa/painéis.
## Vocação e andar vêm de Save.reg (a cidade preenche); argumentos de teste: voc=archer nivel=30 andar=5 teste bot
var world
var hud
var dlg
var pc
var fade_rect: ColorRect

func _ready() -> void:
	var lvl := 1
	for a in OS.get_cmdline_user_args():
		if a.begins_with("voc="): Save.reg.vocation = a.substr(4)
		if a.begins_with("nivel="): lvl = int(a.substr(6))
		if a.begins_with("andar="): Save.reg.startFloor = int(a.substr(6))
	world = load("res://scripts/world.gd").new()
	add_child(world)
	dlg = load("res://scripts/dialog.gd").new(); add_child(dlg)
	dlg.closed.connect(func(): if world and not world.finished: world.paused = Bag.is_open() or Talents.is_open())
	world.dlg = dlg
	var cam := Camera2D.new(); add_child(cam)
	cam.add_child(PhantomCameraHost.new())
	pc = PhantomCamera2D.new()
	pc.follow_mode = PhantomCamera2D.FollowMode.SIMPLE
	pc.follow_damping = true
	pc.follow_damping_value = Vector2(0.08, 0.08)
	add_child(pc)
	world.floor_built.connect(_on_floor)
	world.start(Save.reg.get("vocation", "knight"), lvl)
	pc.follow_target = world.hero
	if "bot" in OS.get_cmdline_user_args(): world.bot = true; world.auto_attack = true
	hud = load("res://scripts/hud.gd").new(); add_child(hud); hud.setup(world)
	var fl := CanvasLayer.new(); fl.layer = 30; add_child(fl)
	fade_rect = ColorRect.new(); fade_rect.color = Color(0, 0, 0, 1); fade_rect.size = Vector2(960, 540); fade_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE; fl.add_child(fade_rect)
	fade_rect.color.a = 0.0
	if Wipe.carry: Wipe.open_if_carried()
	else: fade_rect.color.a = 1.0; create_tween().tween_property(fade_rect, "color:a", 0.0, 0.5)
	world.fade.connect(func(out: bool, _dur: float): (Wipe.cover() if out else Wipe.reveal()))
	world.emit_signal("msg", D.t("floor_enter", {"name": world.region.name, "n": world.floor_n}))
	if "teste" in OS.get_cmdline_user_args(): _teste()

func _on_floor() -> void:
	pc.limit_left = 0; pc.limit_top = 0; pc.limit_right = world.gen.w * 64; pc.limit_bottom = world.gen.h * 64
	pc.global_position = world.hero.global_position
	if hud: hud.on_floor()

func _unhandled_input(e: InputEvent) -> void:
	if world == null or dlg.is_open() or Bag.is_open() or Talents.is_open() or Best.is_open(): return
	if e.is_action_pressed("atacar"): world.hero.atk_queued = 0.35; world.tut.emit("attack")
	if e.is_action_pressed("heal"): world.cast("heal"); world.tut.emit("heal")
	var order: Array = world.spells.keys().filter(func(k): return k != "heal")
	for i in 7:
		if e.is_action_pressed("skill%d" % (i + 1)) and i < order.size(): world.cast(order[i])
	if e.is_action_pressed("alvo"): world.cycle_target()
	if e.is_action_pressed("pocao1"): world.use_potion(0); world.tut.emit("heal")
	if e.is_action_pressed("pocao2"): world.use_potion(1)
	if e.is_action_pressed("auto"):
		world.auto_attack = not world.auto_attack; Save.data.settings.auto_attack = world.auto_attack; Save.save()
		world.emit_signal("msg", D.t("auto_attack_on") if world.auto_attack else D.t("auto_attack_off"))
	if e.is_action_pressed("interagir"): world.interact()
	if e.is_action_pressed("mochila"): Bag.open(self, world.voc); world.tut.emit("bag")
	if e.is_action_pressed("teia"): Talents.open(self, world.voc, false)
	if e.is_action_pressed("voltar"): world.try_recall()
	if e.is_action_pressed("flecha"): world.cycle_arrow() if world.has_method("cycle_arrow") else null
	if e.is_action_pressed("mapa") and hud: hud.toggle_map()
	if e.is_action_pressed("bestiario"): Best.open(self)
	if e is InputEventMouseButton and e.pressed and e.button_index == MOUSE_BUTTON_LEFT:
		var p: Vector2 = get_global_mouse_position()
		for m in world.monsters:
			if not m.dead and Vector2(m.px, m.py - 20).distance_to(p) < 30: world.hero.target = m; return
	if e is InputEventKey and e.pressed and not e.echo and e.keycode in [KEY_ESCAPE, KEY_P]: pause_menu()

func pause_menu() -> void:
	world.paused = true
	dlg.say(D.t("pause_title") if D.t("pause_title") != "pause_title" else "Pausa", D.t("what_to_do"), [
		[D.t("continue_label"), func(): dlg.close()],
		[D.t("back_to_city"), func(): dlg.close(); world.leave_to_town("sewer")],
		[D.t("back_to_menu"), func(): dlg.close(); Wipe.change_scene("res://menu.tscn")]])

## o HUD pede para abrir telas (botões de toque)
func touch_action(a: String) -> void:
	match a:
		"interact": world.interact()
		"bag": Bag.open(self, world.voc)
		"talents": Talents.open(self, world.voc, false)
		"pause": pause_menu()

# ponte para a mochila/teia: pausar o mundo enquanto estão abertas
func set_paused(v: bool) -> void:
	if world: world.paused = v
func on_talents_closed() -> void: pass

# roteiro automático com prints (teste na nuvem)
func _teste() -> void:
	var args := OS.get_cmdline_user_args(); var dir: String = args[0]
	world.bot = true; world.auto_attack = true
	await get_tree().create_timer(1.2).timeout; await _shot(dir + "/a_andar%d.png" % world.floor_n)
	await get_tree().create_timer(5.0).timeout; await _shot(dir + "/b_combate.png")
	var order: Array = world.spells.keys()
	var k := 0
	for id in order:
		if id == "heal": continue
		world.hero.fury = world.fury_max
		world.cast(id); k += 1
		await get_tree().create_timer(0.35).timeout
		if k <= 3: await _shot(dir + "/c_%d_%s.png" % [k, id])
		await get_tree().create_timer(0.8).timeout
	if "mapa" in args: hud.toggle_map(); await get_tree().create_timer(0.3).timeout; await _shot(dir + "/d_mapa.png"); hud.toggle_map()
	# desce até o último andar pela escada
	if "descer" in args:
		while world.floor_n < world.floors and not world.hero.dead:
			if world.stairs == null: break
			world.place_hero_at(world.stairs + Vector2i(1, 0) if world.walkable(world.stairs.x + 1, world.stairs.y) else world.stairs + Vector2i(0, 1))
			world.try_move(signi(world.stairs.x - world.hero.x), signi(world.stairs.y - world.hero.y))
			await get_tree().create_timer(1.6).timeout
			await _shot(dir + "/e_andar%d.png" % world.floor_n)
		# chefe: teleporta para perto e deixa o bot lutar
		for m in world.monsters:
			if m.elite:
				world.hero.hp = world.hero.max_hp; world.hero.level = 40
				for dd in D.DIRS8:
					if world.walkable(m.x + dd.x * 2, m.y + dd.y * 2) and not world.occ.has(Vector2i(m.x + dd.x * 2, m.y + dd.y * 2)): world.place_hero_at(Vector2i(m.x + dd.x * 2, m.y + dd.y * 2)); break
				world.update_flow(); world.reveal()
				await get_tree().create_timer(1.0).timeout; await _shot(dir + "/f_chefe.png")
				for i in 40:
					if m.dead: break
					world.damage_monster(m, m.max_hp * 0.25); world.hero.hp = world.hero.max_hp
					await get_tree().create_timer(0.4).timeout
				await get_tree().create_timer(2.0).timeout; await _shot(dir + "/g_portal.png")
				break
	if "flechas" in args:
		var d := Save.voc(world.voc); d.arrows.explosive = 3; d.arrowSel = "explosive"; d.potions.hunter = 1
		world.drink_buff("hunter"); world.hero.target = null
		await get_tree().create_timer(3.0).timeout; await _shot(dir + "/j_flechas.png")
		print("TESTE FLECHAS restam=", d.arrows.explosive, " buff=", world.hero.buffs)
	if "mochila" in args:
		var ev := InputEventKey.new(); ev.keycode = KEY_I; ev.physical_keycode = KEY_I; ev.pressed = true
		Input.parse_input_event(ev); await get_tree().create_timer(0.4).timeout
		print("TESTE MOCHILA aberta=", Bag.is_open()); await _shot(dir + "/h_mochila.png")
		Save.voc(world.voc).gear.append(Equip.gear_new("chain_armor", 1)); Bag._build(); await get_tree().create_timer(0.2).timeout
		var b: Button = null
		for c in Bag.box.get_children():
			if c is Button and c.icon == Equip.icon("chain_armor"): b = c
		if b: b.pressed.emit()
		await get_tree().create_timer(0.3).timeout
		Save.voc(world.voc).gear.append(Equip.gear_new("plate_armor", 2)); Bag._build()
		get_viewport().warp_mouse(Vector2(700, 230)); Card.show_card(Save.voc(world.voc).gear[-1], world.voc, {"hint": D.t("card_hint_equip"), "sell": true})
		await get_tree().create_timer(0.3).timeout; await _shot(dir + "/k_cartao.png")
		print("TESTE VESTIU armor=", Save.voc(world.voc).equip.get("armor")); await _shot(dir + "/i_vestiu.png")
	print("TESTE voc=%s nivel=%d andar=%d vida=%d/%d kills=%d monstros=%d ouro=%d gear=%d" % [world.voc, world.hero.level, world.floor_n, world.hero.hp, world.hero.max_hp, world.kills, world.monsters.size(), world.gold_run, Save.voc(world.voc).gear.size()])
	get_tree().quit()

func _shot(p: String) -> void:
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(p)
