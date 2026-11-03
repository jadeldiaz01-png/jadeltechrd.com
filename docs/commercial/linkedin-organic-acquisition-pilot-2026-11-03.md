# Piloto de adquisición orgánica en LinkedIn

**Estado:** borrador listo para aprobación del propietario; no publicado.
**Corte de evidencia:** 3-nov-2026, 16:03 UTC.

## Hipótesis

Un mensaje concreto sobre el seguimiento de consultas por WhatsApp puede atraer a dueños de agencias y empresas de servicios hispanohablantes mejor que una promoción genérica de automatización con IA. Se dirige a gente que ya recibe leads y pierde tiempo al organizarlos; no presupone que necesiten un bot ni afirma que Jadel haya desplegado integraciones en WhatsApp o GoHighLevel.

## Razón para probarlo

- El sitio ya centra su CTA en el Blueprint de un proceso, desde US$250, limitado a 2.5 horas.
- GA4 reportó 43 sesiones y 3 usuarios activos durante 4-oct–2-nov; ese corte precede la demo y no permite saber si hubo tráfico elegible.
- Una publicación de Workana para una agencia de seguros hispana en California pide un flujo de WhatsApp→CRM en español. El cliente tiene pagos previos, pero el anuncio de implementación recibió 62 propuestas y 76 interesados; no demuestra demanda por el diagnóstico de Jadel.
- El JavaScript público acepta `utm_source=linkedin`, `utm_medium=social`, `utm_campaign=automation_blueprint` y conserva la atribución de sesión al pasar por la demo hacia el intake. Esto permite medir sesiones que acepten analítica y atribuir solicitudes; no elimina el sesgo del consentimiento.

## Publicación propuesta — español

¿Te llegan consultas por WhatsApp, pero el seguimiento termina repartido entre chats, notas y hojas de cálculo?

Antes de construir un bot, conviene definir el flujo: qué información llega, cómo se registra, quién responde, cuándo se da seguimiento y cuándo debe intervenir una persona.

Jadel Tech RD ofrece un Blueprint para mapear **un proceso**, recomendar una arquitectura y priorizar los siguientes pasos. Desde US$250, con un máximo de 2.5 horas. Es planificación: no incluye desarrollo ni promete aumentar ventas.

Puedes explorar una simulación con datos sintéticos aquí:
https://jadeltechrd.com/demo-seguimiento-leads.html?utm_source=linkedin&utm_medium=social&utm_campaign=automation_blueprint

## Diseño de medición

1. Publicar una sola vez desde el perfil corporativo de LinkedIn y observar 14 días, sin anuncios pagados.
2. Registrar impresiones y clics que muestre LinkedIn; en GA4 medir sesiones, landing page y CTA solo cuando exista consentimiento.
3. En D1, contar solicitudes únicas por `utm_source=linkedin` y `utm_campaign=automation_blueprint`; después verificar calificación humana, cotización, pago `MATCHED`, horas de entrega y fees.
4. No dividir eventos entre sesiones para declarar conversión. Un piloto con una publicación sirve para comprobar atribución y generar señales iniciales, no para afirmar eficacia estadística.

## Criterios de decisión

- **Sin impresiones:** problema de distribución del perfil; revisar audiencia y formato.
- **Impresiones sin clics:** revisar problema descrito, prueba visible y CTA.
- **Sesiones sin solicitud:** revisar ajuste entre post, demo, alcance, precio y formulario.
- **Solicitudes sin pago:** revisar elegibilidad, ajuste, cotización y objeciones; conservar causa de pérdida.
- **Venta:** entregar dentro de 2.5 horas y calcular margen con costes reales antes de repetir o aumentar inversión.

No publicar sin aprobación explícita. No usar testimonios, resultados, referencias a clientes ni experiencia técnica que Jadel no pueda demostrar.
