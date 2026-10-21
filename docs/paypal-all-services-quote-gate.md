# PayPal para los 11 servicios — modelo de cobro por cotización (PREPARE_ONLY)

## Objetivo y estado real

La web Jadel Tech RD ofrece **11 servicios**. El catálogo central ya permite emitir una cotización por servicio autorizado y generar una orden PayPal a partir de una **cotización aceptada** usando la ruta administrativa protegida. Este cambio documenta y prueba esa cobertura para todos los servicios en dos superficies públicas (HTML estático y versión JS), sin modificar el sistema de pagos LIVE.

**Cobertura**: `architecture`, `support`, `sales`, `social`, `cineforge`, `meta`, `analytics`, `revenue`, `quant`, `governance`, `multiagent`. Todos los importes son USD; `exact` designa la cantidad de catálogo, y `minimum` significa "desde" y requiere alcance/importe final aceptados.

## Flujo comercial permitido

1. El cliente selecciona uno o varios servicios y solicita proyecto con Turnstile/idempotencia.
2. Operador autorizado y política institucional verifican el alcance y los términos; el cliente obtiene una cotización individual por el precio real, impuestos, entregables, garantía, cancelaciones y reembolsos aplicables.
3. Se registra evidencia de **aceptación del cliente** vinculada al `quote_id`.
4. Bajo un gate de ambiente autorizado, el backend crea una sola `payment_order_id` por `quote_id`, con `provider_order_id` de PayPal, URL alojada por el proveedor y cantidad exacta de la base de datos, no del navegador.
5. Tras autorización de captura separada, webhook firmado + conciliación humana y ledger coherentes son los únicos caminos válidos para marcar `PAID`.

Se excluye publicar enlaces genéricos PayPal, `paypal.me`, botones directos sin cotización y promesas de activación automática. El precio mostrado en el catálogo **no garantiza** que una cotización comercial haya sido emitida o aceptada.

## Mensualidades

Los componentes `monthly` y `monthly_pack` siguen siendo partidas de cotización. **No representan suscripciones PayPal automáticas**, ni permiten renovación/cobro recurrente sin una integración PayPal Subscriptions API, acuerdos de servicio y consentimiento separados. Un pago único no implica autorización para pagos futuros.

## Evidencias y pruebas sin efectos externos

- `tests/site-payment-readiness-copy.test.mjs`: mapeo de los 11 CTA estáticos y dinámicos, catálogo público sincronizado, precios, no enlaces genéricos ni falsas afirmaciones LIVE.
- `commercial-runtime/test/paypal-all-services.test.mjs`: 11 cotizaciones desde catálogo, 11 órdenes internas sin proveedor, 11 simulaciones de creación en Sandbox con `fetchImpl` sintético, 11 rechazos de cotización no aceptada y reglas para mensualidades.
- `scripts/validate-agent-commerce-discovery.mjs`: precio/catálogo central y rutas públicas.
- CI requerido: `security-baseline`, `commercial-runtime`, tests de calidad de landing.

**No** se han configurado secretos ni validado capacidad real del merchant; ninguna solicitud a PayPal se envía desde los tests. No hay integración de SDK JS pública ni nueva ruta de checkout. El checkout es **elegible después de cotización y gates**, no una opción live activada en esta fase.

## Gates pendientes y autorizaciones separadas

1. Certificación comercial y legal del operador: identidad de la cuenta mercantil PayPal, elegibilidad para recibir USD, tarifas e impuestos, política de cancelación/reembolsos y alcance correcto por servicio.
2. Revisión humana independiente y CI exitoso para HEAD exacto de este PR.
3. Aprobación específica de **merge**, nueva aprobación de despliegue **Pages**, y aprobación diferente de **Worker/D1** si se cambia runtime.
4. PayPal LIVE: ejecutar únicamente la comprobación read-only `.github/workflows/paypal-live-readiness.yml` con SHA autorizado y revisar evidencias de credenciales, OAuth y webhook.
5. Activación LIVE de generación de órdenes exclusivamente mediante `.github/workflows/paypal-live-activate.yml` con autorización adicional; cada captura requiere su propio gate.
6. Verificar una compra real y un pago confirmado sin reconocer ingresos o entregar trabajo antes de la evidencia firmada y conciliación humana. No ejecutar transacciones sintéticas en LIVE.

**NO live financial execution**: `FINANCIAL_EXECUTION_AUTHORIZED=false` y `MAX_AUTONOMOUS_CAPITAL_USD=0`. Ninguna mutación de producción, secretos, workflows LIVE o base de datos forma parte de este PR.
