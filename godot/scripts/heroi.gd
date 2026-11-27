extends CharacterBody2D
## Cavaleiro: anda com setas/WASD, ataca com espaço, fala/pega com E.
signal vida_mudou(v: int, max: int)
const VEL := 190.0
var vida := 150
var vida_max := 150
var dir := "down"
var atacando := 0.0
var spr: AnimatedSprite2D

func _ready() -> void:
	add_to_group("heroi")
	spr = AnimatedSprite2D.new()
	spr.sprite_frames = _frames()
	spr.scale = Vector2(0.52, 0.52)
	spr.offset = Vector2(0, -70)
	add_child(spr)
	spr.play("idle_down")
	var c := CollisionShape2D.new()
	var r := RectangleShape2D.new(); r.size = Vector2(26, 16)
	c.shape = r
	add_child(c)

func _frames() -> SpriteFrames:
	var f := SpriteFrames.new()
	f.remove_animation("default")
	for a in ["idle", "walk", "attack"]:
		for d in ["down", "up", "side"]:
			var tex: Texture2D = load("res://assets/kn_%s_%s.png" % [a, d])
			var nome := "%s_%s" % [a, d]
			f.add_animation(nome)
			f.set_animation_speed(nome, 16.0 if a == "attack" else 10.0)
			f.set_animation_loop(nome, a != "attack")
			for i in 8:
				var at := AtlasTexture.new(); at.atlas = tex; at.region = Rect2(i * 192, 0, 192, 192)
				f.add_frame(nome, at)
	return f

func _physics_process(dt: float) -> void:
	atacando = max(0.0, atacando - dt)
	var v := Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
	if Input.is_action_just_pressed("atacar") and atacando <= 0.0: _atacar()
	if atacando > 0.0: v = Vector2.ZERO
	velocity = v * VEL
	move_and_slide()
	if v.length() > 0.1:
		if abs(v.x) > abs(v.y): dir = "side"; spr.flip_h = v.x < 0
		else: dir = "down" if v.y > 0 else "up"
	if atacando <= 0.0: spr.play(("walk_" if v.length() > 0.1 else "idle_") + dir)

func _atacar() -> void:
	atacando = 0.45
	# mira automática no rato mais próximo (como no Vitula): vira para ele antes do golpe
	var alvo: Node2D = null
	for r in get_tree().get_nodes_in_group("ratos"):
		if global_position.distance_to(r.global_position) < 110 and (alvo == null or global_position.distance_to(r.global_position) < global_position.distance_to(alvo.global_position)): alvo = r
	if alvo:
		var d := alvo.global_position - global_position
		if abs(d.x) > abs(d.y): dir = "side"; spr.flip_h = d.x < 0
		else: dir = "down" if d.y > 0 else "up"
	spr.play("attack_" + dir)
	var frente := Vector2(-1 if spr.flip_h else 1, 0) if dir == "side" else Vector2(0, 1 if dir == "down" else -1)
	for r in get_tree().get_nodes_in_group("ratos"):
		var d: Vector2 = r.global_position - (global_position + frente * 40)
		if d.length() < 70: r.levar_dano(48)

func levar_dano(n: int) -> void:
	vida = max(0, vida - n)
	vida_mudou.emit(vida, vida_max)
	spr.modulate = Color(1, 0.6, 0.6)
	create_tween().tween_property(spr, "modulate", Color.WHITE, 0.25)
