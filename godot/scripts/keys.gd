extends Node
## Teclas do Vitula (as mesmas de save.js ACTIONS), criadas no InputMap ao iniciar.
const MAP := {
	"andar_cima": [KEY_W, KEY_UP], "andar_baixo": [KEY_S, KEY_DOWN], "andar_esq": [KEY_A, KEY_LEFT], "andar_dir": [KEY_D, KEY_RIGHT],
	"heal": [KEY_G, KEY_KP_PERIOD], "skill1": [KEY_1, KEY_KP_1], "skill2": [KEY_2, KEY_KP_2], "skill3": [KEY_3, KEY_KP_3],
	"skill4": [KEY_4, KEY_KP_4], "skill5": [KEY_5, KEY_KP_5], "skill6": [KEY_6, KEY_KP_6], "skill7": [KEY_7, KEY_KP_7],
	"alvo": [KEY_TAB], "pocao1": [KEY_Z], "pocao2": [KEY_C], "atacar": [KEY_SPACE, KEY_F], "auto": [KEY_Q],
}
func _ready() -> void:
	for a in MAP:
		if InputMap.has_action(a): continue
		InputMap.add_action(a)
		for k in MAP[a]:
			var ev := InputEventKey.new(); ev.physical_keycode = k; InputMap.action_add_event(a, ev)
