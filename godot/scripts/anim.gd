extends Node
## Folhas de animação do Vitula (mesmos tamanhos de quadro e ritmos do Phaser: src/scenes.js).
## A.frames("kn_") → SpriteFrames do herói; A.monster("rat"); A.fx("heal") etc. Tudo em cache.
var _cache := {}
var light_tex: Texture2D
var shadow_tex: Texture2D

func _ready() -> void:
	# luz e sombra (no Phaser eram geradas em código)
	var gl := GradientTexture2D.new()
	gl.fill = GradientTexture2D.FILL_RADIAL; gl.fill_from = Vector2(0.5, 0.5); gl.fill_to = Vector2(1, 0.5)
	gl.width = 128; gl.height = 128
	var gr := Gradient.new(); gr.set_color(0, Color(1, 1, 1, 1)); gr.set_color(1, Color(1, 1, 1, 0)); gl.gradient = gr
	light_tex = gl
	var gs := GradientTexture2D.new()
	gs.fill = GradientTexture2D.FILL_RADIAL; gs.fill_from = Vector2(0.5, 0.5); gs.fill_to = Vector2(1, 0.5)
	gs.width = 64; gs.height = 64
	var g2 := Gradient.new(); g2.set_color(0, Color(0, 0, 0, 0.55)); g2.set_color(1, Color(0, 0, 0, 0)); gs.gradient = g2
	shadow_tex = gs

func tex(path: String) -> Texture2D:
	if not _cache.has(path): _cache[path] = load(path)
	return _cache[path]

## adiciona uma animação de uma folha em linha (ou grade cols×rows) a SpriteFrames
func add_sheet(sf: SpriteFrames, name: String, path: String, fw: int, fh: int, fps: float, loop: bool, pick: Array = [], cols := 0) -> void:
	var t := tex(path)
	if t == null: return
	sf.add_animation(name); sf.set_animation_speed(name, fps); sf.set_animation_loop(name, loop)
	var c := cols if cols > 0 else t.get_width() / fw
	var n := c * (t.get_height() / fh)
	var idx := pick if pick.size() else range(n)
	for i in idx:
		var at := AtlasTexture.new(); at.atlas = t
		at.region = Rect2((i % c) * fw, (i / c) * fh, fw, fh)
		sf.add_frame(name, at)

func hero(prefix: String) -> SpriteFrames:
	var key := "hero_" + prefix
	if _cache.has(key): return _cache[key]
	var sf := SpriteFrames.new(); sf.remove_animation("default")
	var archer := prefix == "ar_"
	for d in ["down", "up", "side"]:
		var f := (198 if d == "up" else 200) if archer else 192
		var p := "res://assets/art/%s%%s_%s.png" % [prefix, d]
		add_sheet(sf, "idle_" + d, p % "idle", f, f, 6, true)
		if not archer and d == "side": add_sheet(sf, "walk_" + d, p % "walk", f, f, 9, true, [0, 1, 4, 5, 6, 7])
		else: add_sheet(sf, "walk_" + d, p % "walk", f, f, 12, true)
		add_sheet(sf, "attack_" + d, p % "attack", f, f, 16 if archer else 19, false)
	for n in ["hurt", "cast"]: add_sheet(sf, n, "res://assets/art/%s%s.png" % [prefix, n], 200, 200, 18, false)
	var dw := 200 if archer else 192
	add_sheet(sf, "death", "res://assets/art/%sdeath.png" % prefix, dw, dw, 9, false)
	_cache[key] = sf
	return sf

func monster(kind: String) -> SpriteFrames:
	var key := "mon_" + kind
	if _cache.has(key): return _cache[key]
	var ma: Array = D.MON_ANIM[kind]
	var fw: int = ma[0]
	var sf := SpriteFrames.new(); sf.remove_animation("default")
	add_sheet(sf, "walk", "res://assets/art/%s.png" % ma[1], fw, fw, 12 if kind == "bat" else 10, true)
	add_sheet(sf, "attack", "res://assets/art/%s.png" % ma[2], fw, fw, 16, false)
	add_sheet(sf, "death", "res://assets/art/%s.png" % ma[3], fw, fw, 11, false)
	_cache[key] = sf
	return sf

## efeitos: [arquivo, quadro w, quadro h, fps, colunas, laço, pivô(0..1)]
const FX := {
	"slash": ["res://assets/fx/slash.png", 96, 96, 18, 0, false],
	"heal": ["res://assets/fx/heal.png", 96, 96, 18, 0, false],
	"explosion": ["res://assets/fx/explosion.png", 96, 96, 18, 0, false],
	"aura": ["res://assets/fx/aura.png", 144, 144, 12, 0, true],
	"basic_slash": ["res://assets/art/fx_basic_slash.png", 72, 72, 18, 0, false],
	"ring_wave": ["res://assets/art/fx_ring_wave.png", 214, 214, 14, 0, false],
	"front_cut": ["res://assets/art/fx_front_cut.png", 230, 230, 18, 0, false],
	"holy_arrow": ["res://assets/art/fx_holy_arrow.png", 80, 91, 14, 4, false],
	"volley": ["res://assets/art/fx_volley.png", 124, 139, 12, 4, false],
	"slasher": ["res://assets/art/fx_slasher.png", 96, 192, 14, 4, false],
	"missile": ["res://assets/art/fx_missile.png", 96, 192, 14, 4, false],
	"pfx_xcut": ["res://assets/fx/pfx_xcut.png", 164, 108, 30, 0, false, Vector2(44, 92)],
	"pfx_hit": ["res://assets/fx/pfx_hit.png", 136, 80, 30, 0, false, Vector2(44, 64)],
	"pfx_crit": ["res://assets/fx/pfx_crit.png", 216, 136, 30, 0, false, Vector2(84, 106)],
	"pfx_portal": ["res://assets/fx/pfx_portal.png", 152, 116, 30, 0, true, Vector2(76, 106)],
	"pfx_arrow": ["res://assets/fx/pfx_arrow.png", 112, 32, 30, 0, true, Vector2(92, 16)],
}
func fx(name: String) -> SpriteFrames:
	var key := "fx_" + name
	if _cache.has(key): return _cache[key]
	var f: Array = FX[name]
	var sf := SpriteFrames.new(); sf.remove_animation("default")
	add_sheet(sf, "play", f[0], f[1], f[2], f[3], f[5], [], f[4])
	# as folhas antigas (slash/heal/explosion) têm 1 quadro vazio no fim, como no Phaser
	if name in ["slash", "heal", "explosion"] and sf.get_frame_count("play") > 1: sf.remove_frame("play", sf.get_frame_count("play") - 1)
	_cache[key] = sf
	return sf
