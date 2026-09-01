package jadel.controlplane

import rego.v1

full_gates := {
	"AUTHORIZED":     true,
	"POLICY_ALLOWED": true,
	"TOS_ALLOWED":    true,
	"GEO_ALLOWED":    true,
	"RISK_ALLOWED":   true,
	"IDENTITY_ALLOWED": true,
	"AUDITABLE":        true,
	"IDEMPOTENT":       true,
	"RECONCILABLE":     true,
}

test_fail_closed_when_execution_disabled if {
	not allow with input as {
		"action":               "project_intake",
		"execution_enabled":    false,
		"external_side_effect": false,
		"gates":                full_gates,
	}
}

test_fail_closed_when_gate_missing if {
	not allow with input as {
		"action":               "project_intake",
		"execution_enabled":    true,
		"external_side_effect": false,
		"gates":                object.remove(full_gates, ["AUDITABLE"]),
	}
}

test_critical_action_requires_human if {
	not allow with input as {
		"action":               "external_publication",
		"execution_enabled":    true,
		"external_side_effect": true,
		"platform_status":      "verified_runtime",
		"human_approval":       false,
		"gates":                full_gates,
	}
}

test_verified_platform_and_human_can_allow if {
	allow with input as {
		"action":               "external_publication",
		"execution_enabled":    true,
		"external_side_effect": true,
		"platform_status":      "verified_runtime",
		"human_approval":       true,
		"gates":                full_gates,
	}
}

test_blocked_platform_denied if {
	not allow with input as {
		"action":               "external_publication",
		"execution_enabled":    true,
		"external_side_effect": true,
		"platform_status":      "blocked",
		"human_approval":       true,
		"gates":                full_gates,
	}
}
