extends Node2D
## Cena de combate: mundo + câmera (Phantom Camera) + HUD. Recebe a vocação e o nível de teste de Save.data.run.
var world
var hud

func _ready() -> void:
	var run: Dictionary = Save.data.get("run", {"voc": "knight", "level": 1})
	for a in OS.get_cmdline_user_args():   # teste: voc=archer nivel=30
		if a.begins_with("voc="): run = {"voc": a.substr(4), "level": run.level}
		if a.begins_with("nivel="): run.level = int(a.substr(6))
	world = load("res://scripts/world.gd").new()
	add_child(world)
	world.start(run.voc, run.get("level", 1))
	if "bot" in OS.get_cmdline_user_args(): world.bot = true; world.auto_attack = true
	var cam := Camera2D.new(); add_child(cam)
	cam.add_child(PhantomCameraHost.new())
	var pc := PhantomCamera2D.new()
	pc.follow_mode = PhantomCamera2D.FollowMode.SIMPLE
	pc.follow_target = world.hero
	pc.follow_damping = true
	pc.follow_damping_value = Vector2(0.08, 0.08)
	pc.limit_left = 0; pc.limit_top = 0; pc.limit_right = world.MW * 64; pc.limit_bottom = world.MH * 64
	add_child(pc)
	hud = load("res://scripts/hud.gd").new(); add_child(hud); hud.setup(world)
	world.emit_signal("msg", D.t("floor_enter", {"name": D.db.REGIONS.karhyn_sewers.name, "n": 1}))
	if "teste" in OS.get_cmdline_user_args(): _teste()

func _unhandled_input(e: InputEvent) -> void:
	if world == null: return
	if e.is_action_pressed("atacar"): world.hero.atk_queued = 0.35
	if e.is_action_pressed("heal"): world.cast("heal")
	var order: Array = world.spells.keys().filter(func(k): return k != "heal")
	for i in 7:
		if e.is_action_pressed("skill%d" % (i + 1)) and i < order.size(): world.cast(order[i])
	if e.is_action_pressed("alvo"): world.cycle_target()
	if e.is_action_pressed("pocao1"): world.use_potion(0)
	if e.is_action_pressed("pocao2"): world.use_potion(1)
	if e.is_action_pressed("auto"):
		world.auto_attack = not world.auto_attack; Save.data.settings.auto_attack = world.auto_attack; Save.save()
		world.emit_signal("msg", "Ataque automático: " + ("ligado" if world.auto_attack else "desligado"))
	if e is InputEventMouseButton and e.pressed and e.button_index == MOUSE_BUTTON_LEFT:
		var p: Vector2 = get_global_mouse_position()
		for m in world.monsters:
			if not m.dead and Vector2(m.px, m.py - 20).distance_to(p) < 30: world.hero.target = m; return
	if e is InputEventKey and e.pressed and e.physical_keycode == KEY_ESCAPE: get_tree().change_scene_to_file("res://menu.tscn")

# roteiro automático com prints (teste na nuvem)
func _teste() -> void:
	var args := OS.get_cmdline_user_args(); var dir: String = args[0]
	world.bot = true; world.auto_attack = true
	var order: Array = world.spells.keys()
	await get_tree().create_timer(1.0).timeout; await _shot(dir + "/a_inicio.png")
	await get_tree().create_timer(4.0).timeout; await _shot(dir + "/b_combate.png")
	var k := 0
	for id in order:
		if id == "heal": continue
		world.hero.fury = world.fury_max
		world.cast(id); k += 1
		await get_tree().create_timer(0.35).timeout
		await _shot(dir + "/c_%d_%s.png" % [k, id])
		await get_tree().create_timer(1.2).timeout
	world.hero.hp = world.hero.max_hp * 0.5; world.cast("heal")
	await get_tree().create_timer(0.3).timeout; await _shot(dir + "/d_cura.png")
	await get_tree().create_timer(6.0).timeout; await _shot(dir + "/e_final.png")
	print("TESTE voc=%s nivel=%d vida=%d/%d kills=%d monstros=%d ouro=%d" % [world.voc, world.hero.level, world.hero.hp, world.hero.max_hp, world.kills, world.monsters.size(), world.gold_run])
	get_tree().quit()

func _shot(p: String) -> void:
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(p)
