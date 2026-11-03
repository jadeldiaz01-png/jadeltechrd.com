# Runbook interno — Agentic Blueprint US$250

**Uso:** preparación y control de la primera entrega. No es contrato ni autorización para emitir cotización o cobro. El precio, términos, cancelación y elegibilidad del merchant siguen sujetos a aprobación del propietario.

## Elegibilidad antes de aceptar

Aceptar el paquete de entrada solo cuando el cliente pueda describir **un proceso**, un resultado deseado, sus pasos actuales y las herramientas involucradas. La entrega es planificación; no requiere credenciales, acceso de producción, integración o programación. Si hacen falta varias fuentes/sistemas, datos sensibles, desarrollo, estimación financiera de ROI o más de una ronda de revisión, detener la cotización base y preparar un alcance aparte.

No incluir contraseñas, tokens o datos personales en el documento de trabajo. Usar ejemplos ficticios o campos anonimizados. La calificación comercial se registra en el CRM/flujo autorizado, no en GA4.

## Seguimiento de solicitudes antes de cotizar

Procedimiento operativo recomendado para procesar nuevas solicitudes y cualquier backlog. Es una guía interna, no un benchmark de mercado ni una autorización para enviar comunicaciones automáticamente.

1. Revisar la solicitud en la consola autorizada, asociarla a su `project_id` y comprobar duplicados antes de iniciar contacto. No usar el conteo GA4 `generate_lead` como número de personas o solicitudes únicas.
2. Si se inicia una respuesta humana, registrar `working_lead` con el evento administrativo idempotente. Responder dentro de **1 día hábil** cuando sea posible; registrar el tiempo comercial invertido por separado de las 2.5 horas de entrega.
3. Confirmar cuatro puntos con el prospecto: un solo proceso repetitivo, problema/resultado deseado, herramientas actuales y persona que aprueba el trabajo. No pedir contraseñas, datos de clientes finales ni acceso de producción durante esta fase.
4. Marcar `qualify_lead` solo cuando el proceso cabe en el alcance de una oferta y hay un contacto capaz de acordar el siguiente paso. Usar `disqualify_lead` solo después de revisión humana y conservar el motivo en el CRM comercial con acceso limitado, nunca en GA4 ni en el evento analítico.
5. Para un encaje claro, presentar el Blueprint de US$250 con alcance de un proceso, entregables y tope de 150 minutos; dejar la cotización y condiciones al propietario. Si el prospecto solicita implementación, varios sistemas o un plazo/coste que excede la oferta, preparar alcance aparte antes de comprometer precio.
6. Si no responde, hacer como máximo **un seguimiento humano** tras 2 días hábiles. Si continúa sin respuesta, cerrar el intento con motivo de CRM `sin respuesta`; no seguir consumiendo tiempo de venta sin una señal nueva.

El plazo de respuesta y el límite de un seguimiento son guardas operativas iniciales para controlar CAC, no tasas ni SLAs comerciales validados. Medir durante las primeras diez solicitudes procesadas: minutos hasta primera respuesta, minutos de calificación, calificados, cotizados, aceptados y pagos conciliados. Revisar la regla si los prospectos o el proceso real muestran otra necesidad. No completar retroactivamente etapas que no se puedan verificar.

## Presupuesto máximo de 150 minutos

| Fase | Tope | Salida |
| --- | ---: | --- |
| Revisar intake y confirmar un solo proceso | 10 min | Objetivo, límites y herramientas identificados |
| Reunión de descubrimiento | 45 min | Pasos actuales, excepciones y actores confirmados |
| Mapa breve del proceso | 20 min | Flujo actual y punto prioritario |
| Arquitectura, controles y dependencias | 25 min | Diseño de alto nivel, aprobación humana y riesgos |
| Backlog y métricas de línea base | 20 min | Próximos pasos priorizados y medidas sin metas inventadas |
| Revisión de calidad y entrega | 20 min | Documento consistente, legible y sin PII innecesaria |
| Una ronda de aclaración | 10 min | Corrección factual breve; sin rediseño de alcance |
| **Total máximo** | **150 min / 2.5 h** | Si se supera, pausar y cotizar por separado antes de continuar |

## Plantilla del entregable

1. **Resumen:** proceso analizado, resultado deseado y supuestos confirmados.
2. **Flujo actual:** pasos, actores, sistemas y principales excepciones.
3. **Oportunidad prioritaria:** un punto del proceso y la razón de priorizarlo (impacto esperado, coste, viabilidad y controles; sin afirmar ROI medido).
4. **Diseño recomendado:** componentes, entradas/salidas, límites y revisión humana.
5. **Riesgos y dependencias:** calidad de datos, permisos, seguridad, disponibilidad e integración.
6. **Backlog:** pasos siguientes ordenados y condición de aceptación observable.
7. **Línea base a medir antes de construir:** por ejemplo, tasa de duplicados, campos faltantes o tiempo hasta respuesta humana. No proyectar mejoras sin datos.
8. **Exclusiones y siguiente cotización:** implementación, licencias, despliegue, soporte y alcance fuera del proceso confirmado.

## Control de rentabilidad

Modelo directo vigente (3-nov-2026): PayPal publica para vendedores de República Dominicana 5.40% + US$0.30 por transacción internacional recibida en USD. A US$250, son US$13.80 de fee de cobro y US$236.20 antes de retiro. Con 2.5 h × US$35 = US$87.50 de entrega, la contribución es US$148.70 y el **margen sobre lo facturado es 59.48%**; 62.9% sería margen dividido por el neto post-fee, no el margen bruto estándar. Fuente: [tarifas oficiales PayPal DO](https://www.paypal.com/do/business/paypal-business-fees?locale.x=es_AD).

PayPal también lista retiro a cuenta bancaria local de DOP 100 por retiro en DOP o 0.50% con mínimo US$10 por retiro en USD; disponibilidad y conversión dependen de la cuenta y vía de retiro. Si aplica el retiro USD con mínimo US$10, la contribución de un cobro de US$250 baja a US$138.70 y el margen sobre lo facturado a **55.48%**. Con esos mismos supuestos, el precio matemático para margen de 60% es US$282.66 (redondeo operativo: US$285), antes de CAC, impuestos, conversión efectiva, herramientas, tiempo comercial o retrabajo. Mantener US$250 como hipótesis pública hasta medir la ruta real de retiro y disposición a pagar; no presentar US$285 como precio validado.

El margen bruto estándar se calcula sobre el precio facturado: `(precio cobrado − fees de pago/retiro − costes directos de entrega) / precio cobrado`. Si el trabajo entra por marketplace, modelar su comisión real por separado; no trasladar el fee de PayPal ni reutilizar el supuesto anterior de 15% sin verificarlo para ese contrato.

## Registro mínimo por entrega

Registrar fecha, ID interno del proyecto, canal, oferta, estado (calificado/cotizado/ganado/perdido), precio bruto, moneda, fee real, otros costes directos, minutos por fase, motivo de retrabajo en categorías cerradas y pago conciliado. Evitar copiar nombre/email/notas privadas en este registro analítico.

Fórmulas:

- `neto recibido = cobro bruto − fee de pago/retiro − otros costes directos de cobro`
- `coste directo = horas de entrega × coste horario imputado + herramientas/costes directos`
- `contribución = neto recibido − coste directo`
- `margen bruto sobre facturación = contribución / cobro bruto`
- `venta = pago conciliado`, no formulario enviado, cotización creada ni evento manual de lead.

Revisar la primera entrega contra el tope de tiempo y margen antes de repetir el precio. Cambiar una sola variable por iteración; no declarar validado el servicio hasta verificar pago, horas y costes reales.
