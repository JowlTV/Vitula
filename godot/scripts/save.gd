extends Node
## Save por vocação (como Save.voc do Phaser), em user://vitula.json.
var data := {"vocs": {}, "settings": {"auto_attack": false, "speed": 0.75}}
const PATH := "user://vitula.json"

func _ready() -> void:
	if FileAccess.file_exists(PATH):
		var d = JSON.parse_string(FileAccess.get_file_as_string(PATH))
		if d is Dictionary: data.merge(d, true)

func voc(id: String) -> Dictionary:
	if not data.vocs.has(id):
		data.vocs[id] = {"level": 1, "xp": 0.0, "gold": 0, "ml": {"lvl": 5 if id == "archer" else 0, "spent": 0.0},
			"skills": {}, "attr": {}, "trainings": {}, "equip": {}, "gear": [], "charges": [0.0, 0.0], "talents": {}, "potions": {}}
	return data.vocs[id]

func skill(v: String, id: String) -> Dictionary:
	var s: Dictionary = voc(v).skills
	if not s.has(id): s[id] = {"lvl": D.SKILLS[id].start, "tries": 0.0}
	return s[id]

func save() -> void:
	var f := FileAccess.open(PATH, FileAccess.WRITE)
	if f: f.store_string(JSON.stringify(data))
