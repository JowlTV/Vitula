@tool
extends BTCondition
## Sucesso se o herói está a até `alcance` pixels do rato.
@export var alcance := 60.0
func _generate_name() -> String: return "Herói a %d px?" % alcance
func _tick(_dt: float) -> Status:
	var h: Node2D = agent.get_tree().get_first_node_in_group("heroi")
	return SUCCESS if h and agent.global_position.distance_to(h.global_position) <= alcance else FAILURE
