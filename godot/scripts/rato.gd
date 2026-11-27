extends CharacterBody2D
## Rato do esgoto. A IA vem de uma árvore de comportamento do LimboAI (BTPlayer).
signal morreu(pos: Vector2)
var vida := 148          # números do Vitula (data.js: rato hp 148, dano 9, ataque a cada 2,2 s)
var cooldown := 0.0
var spr: AnimatedSprite2D
var morto := false
var ia: BTPlayer

func _ready() -> void:
	add_to_group("ratos")
	spr = AnimatedSprite2D.new()
	spr.sprite_frames = _frames()
	spr.scale = Vector2(0.95, 0.95)
	spr.offset = Vector2(0, -24)
	add_child(spr)
	spr.play("andar")
	var c := CollisionShape2D.new(); var r := CircleShape2D.new(); r.radius = 12; c.shape = r
	add_child(c)
	# árvore: Seletor[ Sequência[herói perto? → morder], perseguir, vagar ]
	var bt := BehaviorTree.new()
	var raiz := BTDynamicSelector.new()   # reavalia do topo a cada quadro: para de perseguir quando chega perto
	var ataque := BTSequence.new()
	var perto = load("res://ai/alvo_perto.gd").new(); perto.alcance = 56.0
	ataque.add_child(perto); ataque.add_child(load("res://ai/morder.gd").new())
	raiz.add_child(ataque)
	raiz.add_child(load("res://ai/perseguir.gd").new())
	raiz.add_child(load("res://ai/vagar.gd").new())
	bt.root_task = raiz
	var p := BTPlayer.new()
	p.active = false   # só acorda quando o jogador começa (main.gd)
	ia = p
	p.behavior_tree = bt
	p.set_scene_root_hint(self)   # criado por código: sem isso o BTPlayer não acha a cena
	add_child(p)

func _frames() -> SpriteFrames:
	var f := SpriteFrames.new(); f.remove_animation("default")
	for par in [["andar", "am_rat_walk_v2", true], ["morder", "am_rat_attack", false], ["morrer", "am_rat_death", false]]:
		var tex: Texture2D = load("res://assets/%s.png" % par[1])
		f.add_animation(par[0]); f.set_animation_speed(par[0], 12.0); f.set_animation_loop(par[0], par[2])
		for i in 8:
			var at := AtlasTexture.new(); at.atlas = tex; at.region = Rect2(i * 70, 0, 70, 70)
			f.add_frame(par[0], at)
	return f

func _physics_process(dt: float) -> void:
	cooldown = max(0.0, cooldown - dt)

func andar_para(alvo: Vector2, _dt: float) -> void:
	if morto: return
	var d := (alvo - global_position).normalized()
	velocity = d * 95.0
	spr.flip_h = d.x < 0
	if spr.animation != "morder" or not spr.is_playing(): spr.play("andar")
	move_and_slide()

func parar() -> void:
	velocity = Vector2.ZERO
	if not morto and spr.animation == "andar": spr.pause()

func morder() -> bool:
	if morto: return true
	if cooldown > 0.0: return false
	cooldown = 2.2
	spr.play("morder")
	var h = get_tree().get_first_node_in_group("heroi")
	if h: h.levar_dano(9)
	return true

func levar_dano(n: int) -> void:
	if morto: return
	vida -= n
	spr.modulate = Color(2, 2, 2)
	create_tween().tween_property(spr, "modulate", Color.WHITE, 0.15)
	if vida <= 0:
		morto = true
		remove_from_group("ratos")
		for c in get_children(): if c is BTPlayer: c.queue_free()
		spr.play("morrer")
		morreu.emit(global_position)
		await spr.animation_finished
		create_tween().tween_property(self, "modulate:a", 0.0, 0.6).finished.connect(queue_free)
