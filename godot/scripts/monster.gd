extends Node2D
## Monstro (porte do objeto `m` de monsters.js). A IA é uma árvore de comportamento do LimboAI:
##   Seletor dinâmico[ Sequência[acordado? → colado no herói? → morder], Sequência[acordado? → dar um passo] ]
## Os números (vida, dano, armadura, ritmo) vêm de D.MONSTERS, com o mesmo crescimento por andar do Phaser.
var world
var kind := "rat"
var data: Dictionary
var x := 0
var y := 0
var px := 0.0
var py := 0.0
var from_x := 0.0
var from_y := 0.0
var move_t := 0.0
var move_len := 1.0
var hp := 1.0
var max_hp := 1.0
var dmg := 1.0
var awake := false
var dead := false
var step_t := 0.0
var atk_t := 0.0
var flash := 0.0
var bob := 0.0
var fly := false
var elite := false
var champion := false
var lunge := Vector2.ZERO
var stuck := 0
var slow_t := 0.0
var holy_slow := false
var quake_dot = null
var bleed = null
var bleed_t := 0.0
var bleed_tick := 0.0
var marks := 0
var mark_hp0 := 0.0
var poison_t := 0.0
var poison_dps := 0.0
var poison_tick := 0.0
var body_h := 40.0

var spr: AnimatedSprite2D
var shadow: Sprite2D
var bar: Node2D
var ia: BTPlayer

func setup(w, k: String, cx: int, cy: int, floor_n: int) -> void:
	world = w; kind = k; data = D.MONSTERS[k]; x = cx; y = cy
	var mult := 1.0 + 0.17 * (floor_n - 1)
	hp = data.hp * mult; max_hp = hp
	dmg = data.dmg * (1.0 + 0.12 * (floor_n - 1))
	fly = data.get("fly", false); elite = data.get("elite", false)
	step_t = randf() * data.step; bob = randf() * 10
	var p: Vector2 = world.cell_pos(x, y)
	px = p.x; py = p.y; from_x = px; from_y = py
	shadow = Sprite2D.new(); shadow.texture = A.shadow_tex; add_child(shadow)
	spr = AnimatedSprite2D.new()
	spr.sprite_frames = A.monster(k)
	var fw: float = D.MON_ANIM[k][0]
	spr.offset = Vector2(0, -fw / 2.0)
	var sc: float = D.MON_ANIM[k][4] * D.db.WORLD_SCALE
	spr.scale = Vector2(sc, sc)
	if data.has("tint"): spr.self_modulate = Color.hex(int(data.tint) << 8 | 0xff)
	add_child(spr)
	spr.play("walk"); spr.frame = randi() % 6
	if elite:   # chefes: 2,4 casas de tamanho (BOSS_SIZE)
		var k2 := 2.4 * D.T / fw / sc
		spr.scale *= k2
	body_h = fw * spr.scale.y
	shadow.scale = Vector2(fw * spr.scale.x * 0.9 / 64.0, fw * spr.scale.x * 0.3 / 64.0)
	shadow.position = Vector2(0, 8 if fly else -2)
	bar = Node2D.new(); bar.z_index = 50; add_child(bar)
	bar.draw.connect(_draw_bar)
	_make_ai()

func _make_ai() -> void:
	var bt := BehaviorTree.new()
	var root := BTDynamicSelector.new()
	var atk := BTSequence.new()
	atk.add_child(load("res://ai/mon_acordado.gd").new())
	atk.add_child(load("res://ai/mon_colado.gd").new())
	atk.add_child(load("res://ai/mon_morder.gd").new())
	var mv := BTSequence.new()
	mv.add_child(load("res://ai/mon_acordado.gd").new())
	mv.add_child(load("res://ai/mon_passo.gd").new())
	root.add_child(atk); root.add_child(mv)
	bt.root_task = root
	ia = BTPlayer.new()
	ia.behavior_tree = bt
	ia.update_mode = BTPlayer.UpdateMode.MANUAL   # o mundo roda a IA no passo dele (respeita pausa e ritmo)
	ia.set_scene_root_hint(self)
	add_child(ia)

func _draw_bar() -> void:
	if dead: return
	var w := 48.0 if elite else 26.0
	var f := clampf(hp / max_hp, 0, 1)
	var bx := -w / 2.0
	var by := -body_h - (22.0 if fly else 6.0)
	var col := Color("3fae3a") if f > 0.6 else Color("d6b23a") if f > 0.3 else Color("c2452f") if f > 0.1 else Color("6e1414")
	bar.draw_rect(Rect2(bx - 1, by - 1, w + 2, 5), Color(0, 0, 0, 0.85))
	bar.draw_rect(Rect2(bx, by, max(1.0, w * f), 3), col)
