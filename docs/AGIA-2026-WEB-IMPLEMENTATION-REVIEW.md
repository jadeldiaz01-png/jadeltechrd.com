# AGIA 2026 — Auditoría e integración supervisada para Jadel Tech RD

**Fecha:** 2026-10-15. **Alcance:** únicamente `jadeldiaz01-png/jadeltechrd.com`. **Estado:** Draft, NO_GO. **Autorizado:** auditoría read-only, rama aislada y PR Draft. **No autorizado:** merge, deploy, mutación Cloudflare/D1, secretos, pagos, campañas o publicaciones.

## Evidencia consultada y límites

- Main observado en GitHub: `b76563a7f5e9c5f4d721e08b02985f746fc856d5`, `protected=true` (revalidar antes de cualquier merge).
- `config/site-production-readiness-2026.json` (blob `9a826de0ab216b6085236324576e0d2ff93be5ad`) es el manifiesto de sitio. `SLO_ERROR_BUDGET_ALERTING=NOT_YET_CERTIFIED`; `PRODUCTION_DOMAIN_GATE=FAIL`. Sus PASS de septiembre son **históricos**, no certificaciones frescas de octubre.
- `config/institutional-production-manifest-2026.json` (blob `89d7e8217e2a425a6b46bbdc0fefe5fd419c79bd`) es la autoridad institucional canónica. Institucional production=false.
- `config/slo-policy.json`: ventana de 30 días UTC completos, muestreo de 10 minutos, 4320 intervalos, 95% cobertura mínima (=4104), intervalo ciego máximo de 30 minutos, objetivos disponibilidad sitio 99.9%, health intake 99.5%, alertas y error budget.
- `.github/workflows/pages.yml`, `deploy-commercial-runtime.yml` y `agent-fleet-deploy.yml`: `workflow_dispatch` y comprobación humana/exact SHA. **Este PR no toca estos workflows ni los activa.**
- Fuente del nuevo catálogo: paquete local `AGIA Institutional Production Readiness 2026 v1.0.0`; se incorporan los 34 identificadores como *catálogo de investigación*, no como evidencia ni certificación.

## Comparación y decisiones

| Dominio | Sistema de registro vigente | Complemento AGIA | Decisión |
|---|---|---|---|
| Institucional, IAM, DevSecOps, agentes, QA, finops | `config/institutional-production-manifest-2026.json` | C01–C17 | No sustituir autoridad ni dar PASS automático |
| Sitio DNS/TLS, frontend, intake, SEO, ingresos | `config/site-production-readiness-2026.json` | W01–W05, W07 | Mantener evidencias históricas y exigir revalidación |
| Fiabilidad 30 días y alert delivery | `config/slo-policy.json` y workflows existentes | C09–C11, W06 | Mantener exactamente 4320 / 4104 / gap 30m y certificación externa |
| Trading | Repositorio de trading independiente | T01–T08 solo catálogo | FUERA DE ALCANCE, sin habilitar ejecución |
| Redes sociales externas | Políticas específicas por canal | S01–S02 solo catálogo | FUERA DE ALCANCE, sin publicación |

De los **34 controles**: **24 se rastrean como pendientes** para este sitio (17 core + 7 web); **10 son solo referencia** (8 trading + 2 social). `NOT_YET_CERTIFIED` indica que **este overlay no contiene pruebas autenticadas**, no que los sistemas hayan fallado ni que sus evidencias previas sean inválidas.

## Implementación del Draft

- `config/agia-2026-web-overlay.json`: inventario con decisión immutable **NO_GO**, baseline sha histórico y claves originales como sistema de registro.
- `scripts/validate-agia-2026-web-overlay.mjs`: validador determinista read-only; rechaza los PASS sin verificación, alteraciones de gates humanos, producción, gastos o relajación de SLO. **No emite certificados ni aprueba producción.**
- `tests/agia-web-overlay.test.mjs`: casos negativos de manipulación, privilegio, evidencias y SLO.
- `.github/workflows/agia-web-overlay.yml`: CI sobre PR que toca únicamente estos archivos; `contents: read`, checkout SHA inmutable, Node incluido en runner, sin despliegue, sin secretos, sin artefactos masivos. Consume minutos normales de Actions; requiere verificar límites de cuota.

## Validación y próximos gates

Comandos reproducibles localmente:

```bash
node scripts/validate-agia-2026-web-overlay.mjs
node --test tests/agia-web-overlay.test.mjs
```

Un PASS de estas pruebas significa **consistencia estructural**, nunca SLO o infraestructura certificados. Para aspirar a promoción futura: 30 días de mediciones legítimas, entrega real de alertas, verificación de hashes/identidades y vigencia de evidencias, evaluación independiente con SHA exacto, protección efectiva de main, checks obligatorios, revisión de posibles cambios concurrentes y **autorización humana específica** para merge y otra para despliegue. No solicitar autorización de pagos ni uso de capital.

## Riesgos abiertos

1. Ventana SLO de 30 días sin certificación actual confirmada.
2. Evidencia histórica de septiembre: requiere revalidación por control de freshness y SHA.
3. No se verificaron en esta fase todos los rulesets o la entrega de cada alerta en producción.
4. 18 PR abiertos en el momento de la auditoría; vigilar deriva de main y conflictos.
5. El validador intencionalmente no ofrece un botón GO y no atribuye resultados económicos a capturas promocionales.
