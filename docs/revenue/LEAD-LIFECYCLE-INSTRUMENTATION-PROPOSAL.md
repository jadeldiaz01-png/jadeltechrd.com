# Propuesta: registrar calificación de leads

**Estado:** opción A elegida por el agente e implementada en la rama local. No está en `main` ni desplegada.

## Evidencia y problema

El scorecard de D1 registró 16 solicitudes y US$0 en liquidaciones conciliadas en tres cortes consecutivos (2-nov 06:02 UTC, 2-nov 15:53 UTC y 3-nov 00:58 UTC). El conteo `qualified_leads` se basa en `lead_lifecycle_events`, pero en el código del runtime solo hay lecturas de esa tabla; no se encontró una ruta que inserte `working_lead`, `qualify_lead` o `disqualify_lead`. Por eso, cero eventos no demuestra cero leads calificados. No se consultaron filas con información personal.

## Resultado deseado

Medir el avance manual del lead hasta calificación, sin enviar PII a GA4 ni confundir una decisión comercial con una autorización de política, una cotización o un pago. La cifra de clientes convertidos debe provenir de pagos conciliados (`sales_settlements`), no de un botón manual.

## Opciones

| Opción | Método | Ventaja | Riesgo o coste |
| --- | --- | --- | --- |
| **A. Registro manual protegido (recomendado)** | Añadir en la consola administrativa acciones para marcar “en seguimiento”, “calificado” o “no calificado”; API autenticada registra eventos en `lead_lifecycle_events`. | Mide el juicio comercial real y requiere pocos cambios. | Exige que el propietario actualice cada solicitud; no captura actividad omitida. |
| **B. Inferencia por estado de cotización** | Contar leads que reciben una cotización como calificados. | No requiere nueva interfaz. | Confunde “se pudo cotizar” con “cliente calificado”; puede sesgar la métrica. |
| **C. Sin tracking de lead todavía** | Mantener únicamente solicitudes y cobros conciliados. | Sin cambios en el flujo administrativo. | No permite identificar dónde se pierde el embudo ni priorizar seguimientos. |

## Diseño de la opción A

- `POST /api/v1/admin/lead-lifecycle`, protegido con el bearer administrativo existente y CORS ya gobernado.
- Entrada mínima: `project_id`, `stage` permitido (`working_lead`, `qualify_lead`, `disqualify_lead`) y `source_event_id` UUID para idempotencia. No aceptar nombres, email, notas ni motivos libres en el evento analítico.
- Validar UUID, etapa permitida y existencia del `project_id`; resolver repetición por `source='human'` + `source_event_id` y devolver el evento previo sin duplicarlo.
- Guardar timestamp servidor, origen humano y metadatos no sensibles. No enviar mensajes, crear cotizaciones ni cambiar estado de política al registrar la calificación.
- Añadir controles a la consola existente; mostrar resultado y error explícitos. No persistir el token en almacenamiento local del navegador.
- Ampliar el reporte agregado para mostrar conteos deduplicados por etapa y fecha; conversiones e ingresos salen solo de liquidaciones conciliadas. Retener el conteo histórico como “eventos registrados”, no como hechos confirmados antes de instrumentar.

## Criterios de validación antes de cualquier despliegue

1. Sin bearer o con token inválido: 401; con método distinto: 405.
2. Etapa, UUID o proyecto no válidos: rechazo sin escritura.
3. Repetir el mismo `source_event_id`: una sola fila y respuesta idempotente.
4. `qualify_lead` y `disqualify_lead` quedan auditados con `source='human'`; no exponen PII en logs ni GA4.
5. El scorecard distingue eventos registrados de pagos conciliados y calcula tasas solo con cohortes/deduplicación verificables.
6. Revisión estática y pruebas automatizadas locales; sin mutar D1 de producción ni ejecutar pagos.

## Implementación local

- Añadido `POST /api/v1/admin/lead-lifecycle`, autenticado por el bearer administrativo existente. Solo acepta `working_lead`, `qualify_lead` y `disqualify_lead` para proyectos con política `ALLOWED` y estado `POLICY_ALLOWED`.
- `source_event_id` es UUID idempotente; reintentos coincidentes devuelven el evento previo y reutilizar el ID con otro proyecto/etapa responde conflicto. La evidencia guarda solo `source=approval_console` y `actor=admin`; no admite motivos libres, notas ni datos personales.
- La consola muestra controles comerciales solo en la cola de proyectos listos para cotizar. Solicitudes aún pendientes de revisión de política no exponen estos controles. La etapa actual se consulta como último evento y el cliente conserva la misma clave ante reintentos sin guardarla en almacenamiento persistente.
- `converted_customers`, `paid_projects` e ingreso de oferta ahora se derivan de `sales_settlements` conciliadas, vinculadas a `payment_orders`; no de eventos manuales del lead ni solo del ledger. Calificación sigue siendo una cuenta distinta de proyectos con evento `qualify_lead`.
- Pruebas ejecutadas: suite completa de `commercial-runtime/test`, `tests` y `scripts/test-revenue-readiness-scorecard.mjs`: **217 aprobadas, 0 fallidas, 3 omitidas** (tres casos requieren Bash, no disponible en este host). No se ejecutó prueba de navegador ni D1 de producción.
- No se consultaron filas con PII ni se escribió D1 de producción. El despliegue y la creación de PR siguen sujetos a sus gates de aprobación externos.
