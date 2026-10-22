# Jadel Tech RD — recuperación verificable del SLO de 30 días (2026-10-15)

Estado: **INVESTIGACIÓN Y DIAGNÓSTICO — NO ES CERTIFICACIÓN**. Repositorio: `jadeldiaz01-png/jadeltechrd.com`. Referencia de la revisión: `main=b76563a7f5e9c5f4d721e08b02985f746fc856d5`.

## Decisión ejecutiva

No hay evidencia suficiente para declarar `SLO_ERROR_BUDGET_ALERTING=PASS`. El monitor externo ya produce cobertura reciente alta; las observaciones históricas ausentes siguen impidiendo cumplir el límite de 30 minutos de ceguera dentro de una ventana móvil de 30 días. No intentar importar métricas de terceros para representar retrospectivamente comprobaciones de este sitio ni modificar umbrales, timestamps o denominadores.

**Primera fecha candidata condicional**: ventana del **6 de octubre al 4 de noviembre de 2026** (30 días UTC completos); primera ejecución ordinaria elegible del certificador el **5 de noviembre de 2026**, siempre que **todos** los intervalos y controles sean válidos, incluidos los cruces entre días. Es una proyección; el certificador real es la autoridad de la decisión.

## Fuentes de verdad

1. Política vinculante: [config/slo-policy.json](../../config/slo-policy.json).
2. Generador de muestras: [site-slo-evidence.yml](../../.github/workflows/site-slo-evidence.yml).
3. Despacho y verificación externa: [ops/site-slo-external-watchdog.sh](../../ops/site-slo-external-watchdog.sh) y [timers systemd](../../ops/systemd).
4. Agregación: [site-slo-daily-rollup.yml](../../.github/workflows/site-slo-daily-rollup.yml) y [build-site-slo-daily-rollup.mjs](../../scripts/build-site-slo-daily-rollup.mjs).
5. Certificación: [site-slo-certifier.yml](../../.github/workflows/site-slo-certifier.yml) y [certify-site-slo.mjs](../../scripts/certify-site-slo.mjs).
6. Evidencia del certificador [GitHub Actions run 38698209183](https://github.com/jadeldiaz01-png/jadeltechrd.com/actions/runs/38698209183), ejecutado el 15-oct, para una ventana terminada el 14-oct.
7. Rollup del día 14-oct [GitHub Actions run 38689126053](https://github.com/jadeldiaz01-png/jadeltechrd.com/actions/runs/38689126053).
8. Investigación externa: [GitHub Docs — scheduled event](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule); [Google SRE — SLO alerting](https://sre.google/workbook/alerting-on-slos/); [GitHub Docs — Actions artifacts API](https://docs.github.com/en/rest/actions/artifacts).

## Estado medido (no inferido)

Certificador del 15-oct para 30 días completos terminados el 14-oct:

| Control | Medición real | Criterio |
| --- | ---: | --- |
| Muestras elegibles | 1,871 de 4,320 | mínimo 4,104 |
| Cobertura | 43.3102 % | >=95 % |
| Máximo intervalo sin observaciones | 7,759.867 min | <=30 min |
| Disponibilidad sintética pública (muestras presentes) | 100 % | >=99.9 % |
| Disponibilidad de health del intake (muestras presentes) | 100 % | >=99.5 % |
| p95 página pública | 441 ms | <=1,500 ms |
| p95 health intake | 297 ms | <=1,500 ms |
| Entrega de alertas | PASS | PASS |
| Verificación de atestación | PASS | PASS |
| Veredicto | NOT_YET_CERTIFIED | PASS requerido |

La disponibilidad del 100 % se calcula **solo sobre observaciones capturadas** y no significa disponibilidad del 100 % durante los huecos de monitoreo. La evaluación de la página e intake /health tampoco certifica por sí sola el SLO de aceptación durable de solicitudes del negocio.

## Historial de muestras auténticas

Números extraídos de los logs de las ejecuciones del workflow `Site SLO daily rollup` que procesaron el día UTC indicado. El criterio final verifica el **intervalo máximo de toda la ventana**, incluidos cruces de medianoche.

| Día UTC medido | Muestras / 144 | Mayor hueco diario (min) | Evidencia: ejecución de rollup |
| --- | ---: | ---: | --- |
| 20-sep | 6 | 559.867 | [35567792365](https://github.com/jadeldiaz01-png/jadeltechrd.com/actions/runs/35567792365) |
| 24-sep | 6 | 342.617 | [36101567788](https://github.com/jadeldiaz01-png/jadeltechrd.com/actions/runs/36101567788) |
| 28-sep | 4 | 485.933 | [36533354712](https://github.com/jadeldiaz01-png/jadeltechrd.com/actions/runs/36533354712) |
| 30-sep | 5 | 409.333 | [36828737815](https://github.com/jadeldiaz01-png/jadeltechrd.com/actions/runs/36828737815) |
| 02-oct | 86 | 355.733 | [37103153877](https://github.com/jadeldiaz01-png/jadeltechrd.com/actions/runs/37103153877) |
| 05-oct | 138 | 45.883 | [37430145911](https://github.com/jadeldiaz01-png/jadeltechrd.com/actions/runs/37430145911) |
| 06-oct | 144 | 11.433 | [37585830754](https://github.com/jadeldiaz01-png/jadeltechrd.com/actions/runs/37585830754) |
| 07-oct | 143 | 20.017 | [37742752377](https://github.com/jadeldiaz01-png/jadeltechrd.com/actions/runs/37742752377) |
| 08-oct | 143 | 19.817 | [37898471759](https://github.com/jadeldiaz01-png/jadeltechrd.com/actions/runs/37898471759) |
| 09-oct | 144 | 10.583 | [38032981224](https://github.com/jadeldiaz01-png/jadeltechrd.com/actions/runs/38032981224) |
| 10-oct | 144 | 12.033 | [38120363967](https://github.com/jadeldiaz01-png/jadeltechrd.com/actions/runs/38120363967) |
| 11-oct | 144 | 12.000 | [38217031403](https://github.com/jadeldiaz01-png/jadeltechrd.com/actions/runs/38217031403) |
| 12-oct | 144 | 11.950 | [38364153264](https://github.com/jadeldiaz01-png/jadeltechrd.com/actions/runs/38364153264) |
| 13-oct | 144 | 10.367 | [38520259304](https://github.com/jadeldiaz01-png/jadeltechrd.com/actions/runs/38520259304) |
| 14-oct | 144 | 11.467 | [38689126053](https://github.com/jadeldiaz01-png/jadeltechrd.com/actions/runs/38689126053) |

La cobertura elevada observada desde 6-oct es alentadora; **no se ha demostrado por este documento la continuidad entre medianoches**, ni se anticipa evidencia del 15-oct en adelante.

## Ruta de recuperación sin gasto, con prioridad

### P0 — Preservar las mediciones existentes

- Mantener activos los systemd timers `jadel-site-slo-dispatch.timer` y `jadel-site-slo-watchdog.timer`. Su existencia en el repo no demuestra por sí sola estado del sistema; validarlo localmente en el VPS.
- Corroborar el temporizador de despacho cada 10 minutos, la frescura del último `external_watchdog` y la salida del watchdog. Si se interrumpe, primero diagnosticar causa; cualquier reparación de credenciales, sistema o despliegue exige autorización humana separada.
- No borrar los artefactos de prueba originales ni los rollups mientras sean requeridos. Los pipelines actuales definen retención de 35 días para muestras crudas y 45 días para rollups/certificador. Vigilar cuotas de Actions sin aumentar frecuencia ni activar workflows adicionales.

### P1 — Revisar diariamente la cadena de evidencia

- Verificar a diario el run `site-slo-daily-rollup.yml` correspondiente al día UTC anterior: muestras >= 95 % como señal operativa, idealmente 144/144, brecha <=30 minutos, artefacto disponible y contenido válido. **El 95 % por día es una meta operativa, no reemplaza el umbral oficial del 95 % agregado a 30 días.**
- Conservar los indicadores de `site-slo-certifier.yml`: `SLO_30D_OBSERVED_SLOTS`, `SLO_30D_COVERAGE_RATIO`, `SLO_30D_MAX_GAP_MINUTES`, disponibilidad, latencias, alertas y atestación.
- Confirmar que el rollup solo cuenta proveedores/eventos autorizados: `schedule/github_actions` o `workflow_dispatch/external_watchdog`; un diagnóstico manual no incrementa cobertura. Desduplicación estricta por intervalos UTC y peor muestra de un intervalo; ninguna prueba fallida se oculta con reintentos.
- Si se observa un hueco real >30 minutos, la fecha candidata de 5-nov puede desplazarse hacia adelante; recalcular con el último intervalo infractor verdadero.

### P2 — Gate de certificación

- Evaluar los 30 días UTC completos del 06-oct al 04-nov como **candidato**, no como ventana arbitrariamente aprobada.
- Exigir `SLO_30D_STATUS=PASS` y `certification_ready=true`, sin alertas activas de burn-rate, con comprobación de latencia, invariantes semánticas, integridad y frescura de la prueba de alerta, atestación verificada y artefactos rastreables.
- Solo después, revisión independiente de evidencias y del SHA exacto, junto con el resto de dependencias `PRODUCTION_DOMAIN_GATE`, y autorización humana específica. No autopromocionar los manifiestos.

## Diagnóstico de solo lectura para el operador

En el VPS Ubuntu, con permisos ordinarios y acceso de lectura a journald:

```bash
systemctl is-active jadel-site-slo-dispatch.timer
systemctl is-active jadel-site-slo-watchdog.timer
systemctl list-timers --all | grep jadel-site-slo
journalctl -u jadel-site-slo-dispatch.service --since "24 hours ago" --no-pager | tail -60
journalctl -u jadel-site-slo-watchdog.service --since "24 hours ago" --no-pager | tail -60
```

Desde un entorno con `gh` autenticado para lectura del repositorio:

```bash
gh run list -R jadeldiaz01-png/jadeltechrd.com --workflow site-slo-daily-rollup.yml --limit 10
gh run list -R jadeldiaz01-png/jadeltechrd.com --workflow site-slo-certifier.yml --limit 10
gh run list -R jadeldiaz01-png/jadeltechrd.com --workflow site-slo-evidence.yml --limit 10
```

Ninguno de estos comandos modifica sistemas. No divulgar tokens, URLs privadas de artefactos temporales, secretos o información de clientes en comentarios y logs.

## Evaluación de proveedores externos e Internet

- **GitHub Actions**: según documentación oficial, el evento programado puede llegar tarde o perderse. Por tanto el watchdog externo en VPS es una redundancia legítima. No es una licencia para interpolar eventos que no ocurrieron.
- **Google SRE**: las alertas multi-ventana y los budgets deben conservarse; el SLO no es una simple verificación de HTTP 200 aislada.
- **Cloudflare y herramientas externas de uptime**: son útiles para análisis causal independiente (DNS, TLS, Workers, D1, etc.) y mitigación futura, pero no sustituyen observaciones firmadas de los proveedores admitidos por el contrato. No introducir un nuevo proveedor de medición sin diseñar y revisar primero identidad, origen, cadencia, deduplicación y política de aceptación.
- **GitHub artifacts API**: la cadena histórica debe comprobar ID, SHA/digest, vigencia, timestamps UTC, workflow y SHA de procedencia. Los artefactos expirados no pueden reconstruirse con supuestos.
- **Costo**: no habilitar proveedores comerciales, nuevos disparos, runners, secretos, ajustes de privilegio, publicación ni pagos en este paquete.

## Límites y seguridad

Este documento es **solo investigación, evidencias y procedimientos de lectura**. No muta `config/slo-policy.json`, no toca los workflows ni activa nuevos servicios. `production_authorized=false`, `execution_enabled_by_default=false`, `financial_execution_authorized=false` y `max_autonomous_capital_usd=0` siguen vigentes.

**Gate humano:** validar continuidad de mediciones y cuotas cada día; no modificar operaciones productivas sin autorización específica. El SLO público es solo un gate de dominio y nunca autoriza por sí solo pagos, campañas, trading, agentes autónomos o cambios en producción.
