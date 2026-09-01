package jadel.controlplane

import rego.v1

# No critical or external action is allowed unless every institutional gate is true.
default allow := false

gate_names := [
	"AUTHORIZED",
	"POLICY_ALLOWED",
	"TOS_ALLOWED",
	"GEO_ALLOWED",
	"RISK_ALLOWED",
	"IDENTITY_ALLOWED",
	"AUDITABLE",
	"IDEMPOTENT",
	"RECONCILABLE",
]

critical_actions := {
	"financial_side_effect",
	"external_publication",
	"contract_acceptance",
	"credential_change",
	"production_deployment",
	"live_market_action",
	"destructive_action",
}

all_gates_pass if {
	every gate in gate_names {
		object.get(input.gates, gate, false) == true
	}
}

human_gate_satisfied if {
	not input.action in critical_actions
}

human_gate_satisfied if {
	input.action in critical_actions
	object.get(input, "human_approval", false) == true
}

platform_is_eligible if {
	object.get(input, "platform_status", "UNVERIFIED") in {"verified_runtime", "integration_ready"}
}

platform_certified if {
	platform_is_eligible
}

platform_certified if {
	object.get(input, "external_side_effect", false) == false
}

allow if {
	object.get(input, "execution_enabled", false) == true
	all_gates_pass
	human_gate_satisfied
	platform_certified
}

deny contains reason if {
	some gate in gate_names
	object.get(input.gates, gate, false) != true
	reason := sprintf("gate_failed:%s", [gate])
}

deny contains "execution_disabled" if {
	object.get(input, "execution_enabled", false) != true
}

deny contains "human_approval_required" if {
	input.action in critical_actions
	object.get(input, "human_approval", false) != true
}

deny contains "platform_not_certified" if {
	object.get(input, "external_side_effect", false) == true
	not platform_is_eligible
}

decision := {
	"allow": allow,
	"deny":  sort([reason | deny[reason]]),
}
