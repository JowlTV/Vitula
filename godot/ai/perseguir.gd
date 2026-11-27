@tool
extends BTAction
## Anda em direção ao herói enquanto ele estiver no campo de visão.
@export var visao := 520.0
func _generate_name() -> String: return "Perseguir (visão %d)" % visao
func _tick(dt: float) -> Status:
	var h: Node2D = agent.get_tree().get_first_node_in_group("heroi")
	if not h or agent.global_position.distance_to(h.global_position) > visao: return FAILURE
	agent.andar_para(h.global_position, dt)
	return RUNNING
