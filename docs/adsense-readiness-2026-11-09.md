# Preparación AdSense — Jadel Tech RD

**Fecha:** 2026-11-09  
**Rama:** `feat/adsense-readiness-content-20261109`  
**SHA base de main observado:** `1cab14b787e4cc9b99b671427fb11609e92243ba`  
**Estado:** PREPARE_ONLY — contenido propuesto, sin merge ni publicación; NO consta una cuenta AdSense aprobada.

## Objetivo y alcance
Monetización publicitaria **complementaria** de contenido educativo original, sin perjudicar la captación comercial, la privacidad, los flujos de cotización ni el funcionamiento de PayPal. No se introducen anuncios, scripts de AdSense, IDs inventados, datos de pago ni herramientas de generación de visitas.

## Evidencias de solo lectura (2026-11-09)
- En `main` existen `index.html`, `robots.txt`, `sitemap.xml`, `analytics-consent.js`, `ga4-loader.js`, política ES integrada y `en/privacy.html`.
- `robots.txt` permite rastreo general y apunta al sitemap. Esto es **código de repositorio**, no prueba HTTP 200 pública.
- `sitemap.xml` ya contiene landing pages de servicios y se amplía en esta rama con tres páginas educativas.
- `analytics-consent.js` recoge consentimiento de **analítica**, con un mensaje explícito de que **publicidad sigue desactivada**. `ga4-loader.js` establece `ad_storage`, `ad_user_data` y `ad_personalization` como denegados. No equivale a consentimiento válido para anuncios.
- La política de privacidad actual declara que los usos publicitarios están desactivados. NO cambiar esa afirmación antes de introducir publicidad.
- El listado de la raíz de `main` no contenía `ads.txt`. No concluir el HTTP público sin solicitar y verificar la respuesta real.
- **No se verificó** cuenta AdSense, `pub-...`, aprobación, dirección de pago, métricas reales de tráfico, conectividad de URLs públicas de páginas individuales, ni configuración de una CMP.

## Cambios de esta rama
1. `guias.html`: centro de lectura original gratuito y política editorial.
2. `guia-automatizacion-leads.html`: explicación operativa con métricas, idempotencia, consentimiento, pruebas y límites.
3. `guia-chatbot-soporte.html`: base documental, derivación humana, privacidad, amenazas y evaluación.
4. `index.html`: enlaces en navegación y pie a las guías.
5. `sitemap.xml`: URLs canónicas nuevas.
6. Este expediente con puertas de verificación.

## Puertas antes de solicitar aprobación a Google
| Gate | Evidencia necesaria | Estado |
| --- | --- | --- |
| Calidad editorial | Revisión humana de exactitud, lectura móvil, enlaces, autoría, originalidad, utilidad | PENDIENTE |
| Disponibilidad pública | GET 200 HTML/XML de todas las rutas, TLS, canonical, robots, sitemap, sin errores | PENDIENTE |
| Dominio y titular | Confirmar que el solicitante controla dominio y HTML | PENDIENTE |
| Política editorial y legal | Política de privacidad vigente, contacto, cookies y mecanismos de elección | PENDIENTE |
| Cuenta AdSense | Cuenta legítima del titular; si no existe, registrarla desde https://adsense.google.com/start/ | PENDIENTE |
| Conexión AdSense | Usar **solo** el publisher ID real, el código recomendado y las opciones oficiales | PENDIENTE |
| CMP si audiencia EEE/Reino Unido/Suiza | CMP certificada Google e integrada con IAB TCF conforme a la política aplicable; validar rechazo y retirada | PENDIENTE |
| ads.txt | Crear únicamente con el snippet **real de la cuenta**, verificar HTTP 200 y estado autorizado | PENDIENTE |
| Revisión y aceptación | Solicitud en panel de Google; estado **Ready** emitido por Google | PENDIENTE |

## Diseño de monetización propuesto (solo tras aprobación)
- Preferir bloques de anuncios en páginas editoriales educativas; mantener sin anuncios los flujos de contacto, cotización, pago, privacidad y contenidos críticos.
- Respetar los formatos y las políticas de ubicaciones; evitar anuncios engañosos, popups invasivos y proximidad a botones de compra.
- No habilitar anuncios sin CMP/configuración adecuada, revisión de privacidad ES/EN, configuración de CSP y pruebas de Consent Mode. La bandeja actual solo controla **Analytics**.
- Habilitar anuncios mediante cambio separado y aprobado con una bandera de función `ads_enabled=false` por defecto. El valor no se modifica en este PR.
- Evitar tráfico comprado o artificial, autoclics e incentivos a hacer clic.

## Pruebas propuestas
1. Verificar rutas de guía, robots, sitemap, y enlaces HTML internos con `curl -I` desde origen público.
2. Visualizar desde Android y ordenador: menú, tipografía, accesibilidad, scroll y enlaces.
3. Validar respuesta de `/ads.txt` **después** de tener ID real; no publicar `pub-0000000000000000` de ejemplo.
4. Comprobar que al rechazar consentimiento no se cargan etiquetas publicitarias ni se emiten solicitudes indebidas; aplicar CMP certificada donde corresponda.
5. Tras integración, confirmar IDs consistentes, política de privacidad actualizada, CSP probada y ausencia de errores en navegador.
6. Registrar evidencia de la aprobación en la cuenta; el estado Ready no puede inferirse del CI.

## Referencias oficiales
- Elegibilidad: https://support.google.com/adsense/answer/9724?hl=es
- Conectar sitio y revisión: https://support.google.com/adsense/answer/7584263?hl=en
- Privacidad obligatoria: https://support.google.com/adsense/answer/1348695?hl=en
- CMP y regiones: https://support.google.com/adsense/answer/13554116?hl=en
- ads.txt: https://support.google.com/adsense/answer/12171612?hl=es-ES

**Dictamen:** `PREPARE_ONLY`. Este PR puede mejorar contenidos y descubrimiento; **no** acredita aprobación, ingresos, impresiones, implementación publicitaria o despliegue.
