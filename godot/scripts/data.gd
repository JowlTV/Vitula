extends Node
## Dados do jogo, convertidos de src/data.js e src/equip.js do Phaser (data/data.json) + textos (data/i18n.json).
## Acesso: D.MONSTERS["rat"], D.spells("knight"), D.t("level_up_float", {"n": 3}).

const T := 64
const DIRS4 := [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]
const DIRS8 := [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1), Vector2i(1, 1), Vector2i(-1, 1), Vector2i(1, -1), Vector2i(-1, -1)]

var db: Dictionary = {}
var i18n: Dictionary = {}
var lang := "pt"

func _ready() -> void:
	db = JSON.parse_string(FileAccess.get_file_as_string("res://data/data.json"))
	i18n = JSON.parse_string(FileAccess.get_file_as_string("res://data/i18n.json"))

func g(k: String): return db[k]
var MONSTERS: Dictionary:
	get: return db.MONSTERS
var MON_ANIM: Dictionary:
	get: return db.MON_ANIM
var VOCATIONS: Dictionary:
	get: return db.VOCATIONS
var SKILLS: Dictionary:
	get: return db.SKILLS
var ITEMS: Dictionary:
	get: return db.ITEMS
var COLORS: Dictionary:
	get: return db.COLORS

func spells(voc: String) -> Dictionary: return db.ARCHER_SPELLS if voc == "archer" else db.SPELLS
func anim_prefix(voc: String) -> String: return db.VOCATIONS[voc].get("anim", "kn_")
func voc_scale(voc: String) -> float: return float(db.VOCATIONS[voc].get("scale", 0.42)) * db.WORLD_SCALE * 1.12 * 1.05
func is_mana(voc: String) -> bool: return db.VOCATIONS[voc].get("mana", false)

## texto traduzido com {parâmetros}
func t(key: String, p: Dictionary = {}) -> String:
	var s: String = i18n.get(lang, {}).get(key, i18n.pt.get(key, key))
	for k in p: s = s.replace("{" + k + "}", str(p[k]))
	return s

## sorteio por peso: [["rat", 70], ["bat", 30]]
func weighted(table: Array) -> String:
	var total := 0.0
	for e in table: total += e[1]
	var r := randf() * total
	for e in table:
		r -= e[1]
		if r < 0: return e[0]
	return table[0][0]

func skill_tries_needed(id: String, lvl: int) -> int:
	var s: Dictionary = db.SKILLS[id]
	return roundi(s.base * pow(s.growth, lvl - s.start))

func ml_needed(voc: String, lvl: int) -> int:
	if voc == "archer" and lvl < 10: return 80 + 40 * max(0, lvl - 5)
	return roundi(db.ML_BASE * pow(db.ML_MULT.get(voc, 3.0), lvl))

func color(hex: String) -> Color: return Color(hex)
