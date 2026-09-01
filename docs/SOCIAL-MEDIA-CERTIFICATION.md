# Social-media platform certification controls

Each social platform is certified independently. A shared publisher abstraction does not transfer production readiness from one provider to another.

Minimum evidence for publication includes: official API path/version, app/account identity, approved scopes/features, credential provenance, target page/channel/account identity, upload/publish contract, media constraints, rate-limit behavior, idempotency/retry semantics, remote publication ID, reconciliation/read-back, delete/cancel behavior where supported, policy/terms review date, rights/consent evidence for content, observability and human approval record.

Trend intelligence and content generation remain separate from publication authority. High view potential or a model recommendation never authorizes publishing. Originality, rights, disclosure requirements and platform policy are checked before the publication gate.

Spam, deceptive engagement, impersonation, fabricated endorsements, automated account abuse, evasion of platform enforcement and unauthorized scraping are blocked regardless of model recommendation.

Publication promotion sequence: research -> offline creative/QC -> sandbox/test account where available -> supervised single-post canary -> reconciliation -> observation window -> platform-specific `verified_runtime` -> controlled production with HITL for critical changes.