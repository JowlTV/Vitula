extends Node
## Save por vocação (porte de save.js), em user://vitula.json. Mesmo formato do Phaser.
var data := {"vocs": {}, "runs": 0, "cleared": {}, "bestiary": {}, "diffMax": {},
	"settings": {"auto_attack": false, "speed": 0.75, "zoom": 1.0, "music": 0.6, "sfx": 0.8, "lang": "pt"}}
const PATH := "user://vitula.json"
## estado da viagem entre cenas (como o registry do Phaser): vocação, região, andar, de onde volta à cidade...
var reg := {"vocation": "knight", "region": "karhyn_sewers", "townSpawn": "gate"}

func _ready() -> void:
	if FileAccess.file_exists(PATH):
		var d = JSON.parse_string(FileAccess.get_file_as_string(PATH))
		if d is Dictionary:
			for k in d:
				if k == "settings": data.settings.merge(d.settings, true)
				else: data[k] = d[k]
	D.lang = data.settings.get("lang", "pt")

func voc(id: String) -> Dictionary:
	if not data.vocs.has(id): data.vocs[id] = {"gold": 0, "trainings": {}, "smith": {}}
	var d: Dictionary = data.vocs[id]
	if not d.has("skills"): d.skills = {}
	for s in D.SKILLS:
		if not d.skills.has(s): d.skills[s] = {"lvl": D.SKILLS[s].start, "tries": 0.0}
	if not d.has("ml"): d.ml = {"lvl": 5 if id == "archer" else 0, "spent": 0.0}
	if not d.has("potions"): d.potions = {"health": 3}
	if not d.has("potionSlots"): d.potionSlots = ["health", "fury"]
	if not d.has("xpTotal"): d.xpTotal = 0.0
	if not d.has("promoted"): d.promoted = false
	for k in ["attr", "equip", "talents", "arrows", "depot"]:
		if not d.has(k): d[k] = {}
	if not d.depot.has("potions"): d.depot.potions = {}
	if not d.has("gear"): d.gear = []
	if not d.has("charges"): d.charges = [0.0, 0.0]
	if not d.has("essence"): d.essence = 0
	return d

## nível e experiência dentro do nível, a partir da experiência total
func level_info(total: float) -> Dictionary:
	var L := 1; var rest := total
	while rest >= 8 * pow(L, 1.35): rest -= 8 * pow(L, 1.35); L += 1
	return {"level": L, "xp": rest}
func level(v: String) -> int: return level_info(voc(v).xpTotal).level
func xp_for_level(L: int) -> float:
	var s := 0.0
	for i in range(1, L): s += 8 * pow(i, 1.35)
	return s

func skill(v: String, id: String) -> Dictionary: return voc(v).skills[id]
func gold(v: String) -> int: return int(voc(v).gold)
func add_gold(v: String, n: int) -> void: voc(v).gold += n
func add_kills(k: Dictionary) -> void:
	for id in k: data.bestiary[id] = data.bestiary.get(id, 0) + k[id]

func save() -> void:
	var f := FileAccess.open(PATH, FileAccess.WRITE)
	if f: f.store_string(JSON.stringify(data))
