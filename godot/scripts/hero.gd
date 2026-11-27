extends Node2D
## Estado do herói (porte de `this.hero` do Phaser). A lógica fica em world.gd, como na DungeonScene.
var voc := "knight"
var x := 0
var y := 0
var px := 0.0
var py := 0.0
var from_x := 0.0
var from_y := 0.0
var move_t := 0.0
var move_len := 1.0
var carry := 0.0
var facing := Vector2i(0, 1)
var look_left := false
var level := 1
var xp := 0.0
var hp := 100.0
var max_hp := 100.0
var fury := 0.0
var fury_idle := 0.0
var regen := 0.0
var p_reg := 0.0
var atk_t := 0.0
var atk_queued := 0.0
var attack_t := 0.0
var atk_dir := "down"
var atk_left := false
var walk_hold := 0.0
var pose := ""
var pose_t := 0.0
var flash := 0.0
var dead := false
var target = null
var cds := {}
var pot_cd := {}
var buffs := {}
# temporizadores das habilidades
var aura_t := 0.0
var aura_tick := 0.0
var guard_t := 0.0
var flee_t := 0.0
var frenzy_t := 0.0
var eagle_t := 0.0
var kber_t := 0.0
var far_t := 0.0
var poison_t := 0.0
var poison_dps := 0.0
var poison_tick := 0.0

var spr: AnimatedSprite2D
var shadow: Sprite2D
var aura_spr: AnimatedSprite2D
var guard_spr: Sprite2D
var light: PointLight2D
var glow: Sprite2D

func setup(v: String, scale_k: float) -> void:
	voc = v
	shadow = Sprite2D.new(); shadow.texture = A.shadow_tex; shadow.scale = Vector2(0.75, 0.3)
	add_child(shadow)
	glow = Sprite2D.new(); glow.texture = A.light_tex; glow.scale = Vector2(0.32, 0.42); glow.position = Vector2(0, -34)
	glow.modulate = Color(1, 1, 1, 0); var cm := CanvasItemMaterial.new(); cm.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD; glow.material = cm
	add_child(glow)
	spr = AnimatedSprite2D.new()
	spr.sprite_frames = A.hero(D.anim_prefix(v))
	spr.centered = true
	spr.offset = Vector2(0, -96)    # origem nos pés (quadro de 192–200 px)
	spr.scale = Vector2(scale_k, scale_k)
	add_child(spr)
	spr.play("idle_down")
	light = PointLight2D.new(); light.texture = A.light_tex; light.texture_scale = 5.2; light.energy = 1.15
	light.color = Color(1.0, 0.86, 0.66); light.position = Vector2(0, -30)
	add_child(light)
