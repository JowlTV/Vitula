@tool
extends BTAction
## Fica parado farejando quando não vê o herói.
func _generate_name() -> String: return "Vagar"
func _tick(_dt: float) -> Status:
	agent.parar()
	return RUNNING
