extends Node
## Teclas do Vitula (as mesmas de save.js ACTIONS). Cada ação aceita até 2 teclas; o jogador troca nas Configurações
## (Save.data.settings.keys guarda as escolhidas). Autoload "Keys".
const MAP := {
	"andar_cima": [KEY_W, KEY_UP], "andar_baixo": [KEY_S, KEY_DOWN], "andar_esq": [KEY_A, KEY_LEFT], "andar_dir": [KEY_D, KEY_RIGHT],
	"atacar": [KEY_SPACE, KEY_F], "auto": [KEY_Q, KEY_R], "heal": [KEY_G, KEY_KP_PERIOD],
	"skill1": [KEY_1, KEY_KP_1], "skill2": [KEY_2, KEY_KP_2], "skill3": [KEY_3, KEY_KP_3], "skill4": [KEY_4, KEY_KP_4],
	"skill5": [KEY_5, KEY_KP_5], "skill6": [KEY_6, KEY_KP_6], "skill7": [KEY_7, KEY_KP_7],
	"pocao1": [KEY_Z], "pocao2": [KEY_C], "alvo": [KEY_TAB], "interagir": [KEY_E, KEY_ENTER],
	"mochila": [KEY_I, KEY_B], "teia": [KEY_U], "bestiario": [KEY_N], "mapa": [KEY_M], "voltar": [KEY_H], "flecha": [KEY_X],
}
const NAMES := {
	"andar_cima": "bind_up", "andar_baixo": "bind_down", "andar_esq": "bind_left", "andar_dir": "bind_right",
	"atacar": "bind_attack", "auto": "bind_autoAttack", "heal": "Exura (cura)", "skill1": "Habilidade 1", "skill2": "Habilidade 2",
	"skill3": "Habilidade 3", "skill4": "Habilidade 4", "skill5": "Habilidade 5", "skill6": "Habilidade 6", "skill7": "Habilidade 7",
	"pocao1": "bind_potion1", "pocao2": "bind_potion2", "alvo": "Trocar de alvo", "interagir": "bind_interact", "mochila": "bind_bag",
	"teia": "Teia de talentos", "bestiario": "Bestiário", "mapa": "bind_map", "voltar": "Voltar à cidade", "flecha": "Trocar de flecha (Arqueiro)",
}

func _ready() -> void: apply()

func keys_of(a: String) -> Array:
	var s: Dictionary = Save.data.settings.get("keys", {})
	return s[a] if s.has(a) else MAP[a]

func apply() -> void:
	for a in MAP:
		if InputMap.has_action(a): InputMap.action_erase_events(a)
		else: InputMap.add_action(a)
		for k in keys_of(a):
			var ev := InputEventKey.new(); ev.physical_keycode = int(k); InputMap.action_add_event(a, ev)

func set_key(a: String, slot: int, code: int) -> void:
	if not Save.data.settings.has("keys"): Save.data.settings.keys = {}
	var cur: Array = keys_of(a).duplicate()
	# a tecla sai de quem já usava
	for b in MAP:
		var ks: Array = keys_of(b).duplicate()
		if b != a and code in ks: ks.erase(code); Save.data.settings.keys[b] = ks
	while cur.size() <= slot: cur.append(0)
	cur[slot] = code
	Save.data.settings.keys[a] = cur.filter(func(k): return int(k) != 0)
	Save.save(); apply()

func reset() -> void:
	Save.data.settings.keys = {}; Save.save(); apply()

func label(a: String) -> String:
	var n: String = NAMES[a]
	return D.t(n) if n.begins_with("bind_") else n
func key_name(code: int) -> String:
	if code == 0: return "—"
	var s := OS.get_keycode_string(code)
	return {"Space": "Espaço", "Up": "↑", "Down": "↓", "Left": "←", "Right": "→", "Enter": "Enter", "Tab": "Tab"}.get(s, s)
