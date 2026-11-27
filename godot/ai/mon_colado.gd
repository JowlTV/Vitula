@tool
extends BTCondition
## O herói está numa das 8 casas em volta?
func _generate_name() -> String: return "Colado no herói?"
func _tick(_dt: float) -> Status:
	var h = agent.world.hero
	return SUCCESS if not h.dead and max(abs(h.x - agent.x), abs(h.y - agent.y)) <= 1 else FAILURE
