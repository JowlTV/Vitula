extends CanvasLayer
## Transição "Wipe" (porte de transitions.js): cortina escura inclinada, com borda dourada, que varre a tela
## da esquerda para a direita. Fecha numa cena e abre na próxima (carry). Autoload "Wipe".
const MS := 0.34
var poly: Node2D
var carry := false
var tw: Tween

func _init() -> void: layer = 60; process_mode = Node.PROCESS_MODE_ALWAYS

func _ready() -> void:
	poly = Node2D.new(); add_child(poly)
	var W := 960.0; var H := 540.0; var S := 90.0
	var p := Polygon2D.new(); p.polygon = PackedVector2Array([Vector2(0, 0), Vector2(W + S, 0), Vector2(W, H), Vector2(-S, H)]); p.color = Color("07060a"); poly.add_child(p)
	var gold := Line2D.new(); gold.points = PackedVector2Array([Vector2(W + S, 0), Vector2(W, H)]); gold.width = 3; gold.default_color = Color(0.78, 0.63, 0.31, 0.9); poly.add_child(gold)
	var back := Line2D.new(); back.points = PackedVector2Array([Vector2(-S, H), Vector2(0, 0)]); back.width = 1; back.default_color = Color(0.42, 0.29, 0.13, 0.8); poly.add_child(back)
	poly.position.x = -1200; poly.visible = false

## fecha a cortina (cobre a tela); chama fn quando cobriu
func cover(fn := Callable(), dur := MS) -> void:
	if tw: tw.kill()
	poly.visible = true; poly.position.x = -1100
	tw = create_tween(); tw.tween_property(poly, "position:x", 0.0, dur).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN_OUT)
	if fn.is_valid(): tw.tween_callback(fn)

## abre a cortina (sai pela direita)
func reveal(dur := MS) -> void:
	if tw: tw.kill()
	poly.visible = true; poly.position.x = 0
	tw = create_tween(); tw.tween_interval(0.05); tw.tween_property(poly, "position:x", 1150.0, dur).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN_OUT)
	tw.tween_callback(func(): poly.visible = false)

## troca de cena atrás da cortina
func change_scene(path: String) -> void:
	cover(func(): carry = true; get_tree().change_scene_to_file(path))

## a próxima cena chama no _ready: abre a cortina que ficou fechada
func open_if_carried() -> void:
	if carry: carry = false; reveal()
