extends Node2D
## Fatia de teste do Vitula no Godot: sala do esgoto (andar 1) com o cavaleiro, ratos (LimboAI),
## a Oráculo (Dialogue Manager), itens e mochila (GLoot) e câmera (Phantom Camera).
const T := 64
const W := 16
const H := 11
var heroi: CharacterBody2D
var ents: Node2D
var inv: Inventory
var painel_mochila: PanelContainer
var barra: ProgressBar
var dica: Label
var oraculo_pos := Vector2(8 * T, 2 * T + 40)
var em_dialogo := false
var comecou := false
var aviso: Label

func _ready() -> void:
	_acoes()
	_sala()
	ents = Node2D.new(); ents.y_sort_enabled = true; add_child(ents)
	heroi = load("res://scripts/heroi.gd").new()
	heroi.position = Vector2(8 * T, 8 * T)
	ents.add_child(heroi)
	_oraculo()
	for p in [Vector2(3, 4), Vector2(13, 5), Vector2(12, 8)]:
		var r: CharacterBody2D = load("res://scripts/rato.gd").new()
		r.position = p * T
		r.morreu.connect(func(pos): _soltar_item("ouro", pos); _soltar_item("gema", pos + Vector2(18, 6)))
		ents.add_child(r)
	_soltar_item("maca", Vector2(5 * T, 8 * T))
	_soltar_item("pao", Vector2(10 * T, 9 * T))
	_camera()
	_hud()
	DialogueManager.dialogue_ended.connect(func(_r): em_dialogo = false)
	if "teste" in OS.get_cmdline_user_args(): _teste()

func _acoes() -> void:
	for par in [["atacar", KEY_SPACE], ["interagir", KEY_E], ["mochila", KEY_I]]:
		if not InputMap.has_action(par[0]):
			InputMap.add_action(par[0])
			var ev := InputEventKey.new(); ev.physical_keycode = par[1]
			InputMap.action_add_event(par[0], ev)

# ---------- sala: chão repetido + paredes com colisão ----------
func _sala() -> void:
	var chao := Sprite2D.new()
	chao.texture = load("res://assets/floor.png")
	chao.texture_repeat = CanvasItem.TEXTURE_REPEAT_ENABLED
	chao.region_enabled = true
	chao.region_rect = Rect2(0, 0, W * T, H * T)
	chao.centered = false
	chao.modulate = Color(0.78, 0.8, 0.84)
	add_child(chao)
	var frente: Texture2D = load("res://assets/wall_front_v3.png")
	var topo: Texture2D = load("res://assets/wall_top_v3.png")
	for x in W:
		_parede(Vector2(x * T, 0), frente)          # parede do fundo (vista de frente)
		_parede(Vector2(x * T, (H - 1) * T), topo)  # parede de baixo (vista de cima)
	for y in range(1, H - 1):
		_parede(Vector2(0, y * T), topo)
		_parede(Vector2((W - 1) * T, y * T), topo)
	# luz fraca nas bordas (vinheta) para o clima do esgoto
	var v := ColorRect.new()
	v.size = Vector2(W * T, H * T)
	v.color = Color(0, 0, 0, 0)
	add_child(v)

func _parede(p: Vector2, tex: Texture2D) -> void:
	var s := Sprite2D.new(); s.texture = tex; s.centered = false; s.position = p
	s.scale = Vector2(T / float(tex.get_width()), T / float(tex.get_height()))
	add_child(s)
	var b := StaticBody2D.new(); b.position = p + Vector2(T / 2.0, T / 2.0)
	var c := CollisionShape2D.new(); var r := RectangleShape2D.new(); r.size = Vector2(T, T); c.shape = r
	b.add_child(c); add_child(b)

# ---------- Oráculo (Dialogue Manager) ----------
func _oraculo() -> void:
	var s := Sprite2D.new()
	s.texture = load("res://assets/altar_oraculo.png")
	s.scale = Vector2(0.62, 0.62)
	s.offset = Vector2(0, -70)
	s.position = oraculo_pos
	ents.add_child(s)
	var b := StaticBody2D.new(); b.position = oraculo_pos
	var c := CollisionShape2D.new(); var r := RectangleShape2D.new(); r.size = Vector2(70, 24); c.shape = r
	b.add_child(c); add_child(b)

func _comecar() -> void:
	comecou = true
	if aviso: aviso.queue_free()
	for r in get_tree().get_nodes_in_group("ratos"): r.ia.active = true

func _unhandled_input(e: InputEvent) -> void:
	if not comecou and (e is InputEventKey or e is InputEventAction or e is InputEventMouseButton or e is InputEventScreenTouch) and e.is_pressed():
		_comecar()
	if e.is_action_pressed("interagir") and not em_dialogo and heroi.global_position.distance_to(oraculo_pos) < 110:
		_falar()
	if e.is_action_pressed("mochila"):
		painel_mochila.visible = not painel_mochila.visible

func _falar() -> void:
	em_dialogo = true
	DialogueManager.show_dialogue_balloon_scene("res://dialogue/balao.tscn", load("res://dialogue/oraculo.dialogue"), "start")

# ---------- itens e mochila (GLoot) ----------
func _soltar_item(id: String, pos: Vector2) -> void:
	var a := Area2D.new(); a.position = pos
	var s := Sprite2D.new(); s.texture = inv_imagem(id); s.scale = Vector2(2, 2); s.offset = Vector2(0, -6)
	a.add_child(s)
	var c := CollisionShape2D.new(); var r := CircleShape2D.new(); r.radius = 20; c.shape = r; a.add_child(c)
	a.body_entered.connect(func(b):
		if b == heroi and inv:
			var it := inv.create_item(id)
			if inv.add_item_automerge(it): a.queue_free())   # empilha moedas e gemas iguais
	ents.add_child.call_deferred(a)

func inv_imagem(id: String) -> Texture2D:
	return load({"maca": "res://assets/i_apple.png", "pao": "res://assets/i_bread.png", "ouro": "res://assets/i_gold_coin.png", "gema": "res://assets/i_blue_gem.png"}[id])

# ---------- câmera (Phantom Camera) ----------
func _camera() -> void:
	var cam := Camera2D.new()
	cam.zoom = Vector2(1.15, 1.15)
	add_child(cam)
	cam.add_child(PhantomCameraHost.new())
	var pc := PhantomCamera2D.new()
	pc.follow_mode = PhantomCamera2D.FollowMode.SIMPLE
	pc.follow_target = heroi
	pc.follow_damping = true
	pc.zoom = Vector2(1.15, 1.15)
	pc.limit_left = 0; pc.limit_top = -40; pc.limit_right = W * T; pc.limit_bottom = H * T
	add_child(pc)

# ---------- HUD ----------
func _hud() -> void:
	var ui := CanvasLayer.new(); add_child(ui)
	barra = ProgressBar.new()
	barra.position = Vector2(16, 14); barra.size = Vector2(220, 18)
	barra.max_value = heroi.vida_max; barra.value = heroi.vida
	barra.show_percentage = false
	var fill := StyleBoxFlat.new(); fill.bg_color = Color("a8202c"); barra.add_theme_stylebox_override("fill", fill)
	var bg := StyleBoxFlat.new(); bg.bg_color = Color("1a1416"); bg.border_color = Color("6a5a40"); bg.set_border_width_all(2)
	barra.add_theme_stylebox_override("background", bg)
	ui.add_child(barra)
	heroi.vida_mudou.connect(func(v, _m):
		barra.value = v
		if v <= 0: get_tree().create_timer(1.5).timeout.connect(get_tree().reload_current_scene))
	aviso = Label.new()
	aviso.text = "Aperte qualquer tecla para começar"
	aviso.position = Vector2(330, 240)
	aviso.add_theme_font_size_override("font_size", 22)
	aviso.add_theme_color_override("font_color", Color("e0b050"))
	aviso.add_theme_color_override("font_outline_color", Color.BLACK)
	aviso.add_theme_constant_override("outline_size", 6)
	ui.add_child(aviso)
	dica = Label.new()
	dica.text = "Setas: andar · Espaço: atacar · E: falar · I: mochila"
	dica.position = Vector2(16, 506)
	dica.add_theme_color_override("font_color", Color("d8c8a0"))
	ui.add_child(dica)
	# mochila: Inventory + GridConstraint (lógica) e CtrlInventoryGrid (tela)
	inv = Inventory.new()
	inv.protoset = load("res://data/itens.json")
	var grade := GridConstraint.new(); grade.size = Vector2i(6, 4)
	inv.add_child(grade)
	add_child(inv)
	painel_mochila = PanelContainer.new()
	var ps := StyleBoxFlat.new(); ps.bg_color = Color(0.08, 0.07, 0.08, 0.94); ps.border_color = Color("8a6a3a"); ps.set_border_width_all(2)
	ps.set_content_margin_all(10)
	painel_mochila.add_theme_stylebox_override("panel", ps)
	painel_mochila.position = Vector2(620, 40)
	var vb := VBoxContainer.new(); painel_mochila.add_child(vb)
	var t := Label.new(); t.text = "Mochila"; t.add_theme_color_override("font_color", Color("e0b050")); vb.add_child(t)
	var cg := CtrlInventoryGrid.new()
	cg.inventory = inv
	cg.field_dimensions = Vector2(40, 40)
	cg.custom_minimum_size = Vector2(6 * 40 + 5 * 2, 4 * 40 + 3 * 2)
	vb.add_child(cg)
	painel_mochila.visible = false
	ui.add_child(painel_mochila)

# ---------- teste automático: roteiro de teclas + prints ----------
func _teste() -> void:
	var pasta := OS.get_cmdline_user_args()[0] if OS.get_cmdline_user_args().size() > 1 else "/tmp"
	_comecar()
	await _esperar(1.0); await _print(pasta + "/1_inicio.png")
	await _segurar("ui_left", 0.9)                          # anda até a maçã
	await _segurar("ui_down", 0.2)
	await _esperar(1.2); await _print(pasta + "/2_ratos_chegando.png")
	for i in 10: await _apertar("atacar", 0.5)               # luta com os ratos
	await _print(pasta + "/3_combate.png")
	for i in 14: await _apertar("atacar", 0.5)
	await _esperar(1.5)
	await _segurar("ui_right", 1.4); await _segurar("ui_down", 0.5)
	await _print(pasta + "/4_pos_combate.png")
	heroi.global_position = oraculo_pos + Vector2(0, 80)    # vai até a Oráculo
	await _esperar(0.5); await _apertar("interagir", 0.8)
	await _print(pasta + "/5_dialogo.png")
	for i in 3: await _apertar_ui(0.7)
	await _print(pasta + "/6_escolha.png")
	for i in 6: await _apertar_ui(0.6)
	await _esperar(0.8)
	em_dialogo = false
	painel_mochila.visible = true
	await _esperar(0.3)
	await _print(pasta + "/7_mochila.png")
	print("TESTE itens=", inv.get_item_count(), " vida=", heroi.vida, " ratos_vivos=", get_tree().get_nodes_in_group("ratos").size())
	get_tree().quit()

func _esperar(s: float) -> void: await get_tree().create_timer(s).timeout
func _print(p: String) -> void:
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(p)
func _segurar(a: String, s: float) -> void:
	Input.action_press(a); await _esperar(s); Input.action_release(a)
func _apertar(a: String, s: float) -> void:
	var ev := InputEventAction.new(); ev.action = a; ev.pressed = true
	Input.parse_input_event(ev); Input.action_press(a)
	await get_tree().physics_frame; await get_tree().physics_frame
	Input.action_release(a); await _esperar(s)
func _apertar_ui(s: float) -> void:
	var ev := InputEventAction.new(); ev.action = "ui_accept"; ev.pressed = true
	Input.parse_input_event(ev)
	await get_tree().process_frame
	var ev2 := InputEventAction.new(); ev2.action = "ui_accept"; ev2.pressed = false
	Input.parse_input_event(ev2); await _esperar(s)
