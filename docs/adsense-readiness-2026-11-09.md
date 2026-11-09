# Preparación AdSense — Jadel Tech RD

**Fecha:** 2026-11-09  
**Rama:** `feat/adsense-readiness-content-20261109`  
**SHA base de main observado:** `1cab14b787e4cc9b99b671427fb11609e92243ba`  
**Estado:** PREPARE_ONLY — contenido propuesto, sin merge ni publicación; NO consta una cuenta AdSense aprobada.

## Objetivo y alcance
Monetización publicitaria **complementaria** de contenido educativo original, sin perjudicar la captación comercial, la privacidad, los flujos de cotización ni el funcionamiento de PayPal. Se prepara verificación no ejecutable con el ID de editor suministrado por el usuario. No se introducen anuncios, scripts de AdSense ejecutables, datos de pago ni herramientas de generación de visitas.

## Evidencias de solo lectura (2026-11-09)
- En `main` existen `index.html`, `robots.txt`, `sitemap.xml`, `analytics-consent.js`, `ga4-loader.js`, política ES integrada y `en/privacy.html`.
- `robots.txt` permite rastreo general y apunta al sitemap. Esto es **código de repositorio**, no prueba HTTP 200 pública.
- `sitemap.xml` ya contiene landing pages de servicios y se amplía en esta rama con tres páginas educativas.
- `analytics-consent.js` recoge consentimiento de **analítica**, con un mensaje explícito de que **publicidad sigue desactivada**. `ga4-loader.js` establece `ad_storage`, `ad_user_data` y `ad_personalization` como denegados. No equivale a consentimiento válido para anuncios.
- La política de privacidad actual declara que los usos publicitarios están desactivados. NO cambiar esa afirmación antes de introducir publicidad.
- El listado de la raíz de `main` no contenía `ads.txt`; esta rama crea el registro oficial con el identificador suministrado. No concluir el HTTP público sin solicitar y verificar la respuesta real.
- **No se verificó** cuenta AdSense, `pub-...`, aprobación, dirección de pago, métricas reales de tráfico, conectividad de URLs públicas de páginas individuales, ni configuración de una CMP.

## Cambios de esta rama
1. `guias.html`: centro de lectura original gratuito y política editorial.
2. `guia-automatizacion-leads.html`: explicación operativa con métricas, idempotencia, consentimiento, pruebas y límites.
3. `guia-chatbot-soporte.html`: base documental, derivación humana, privacidad, amenazas y evaluación.
4. `index.html`: enlaces en navegación y pie a las guías, y metaetiqueta oficial de verificación de editor.
5. `sitemap.xml`: URLs canónicas nuevas.
6. `ads.txt`: registro de vendedor autorizado de Google con el ID comunicado por el titular.
7. Metaetiqueta de editor en portada e índice/dos guías, sin ejecutar librerías publicitarias.
8. Este expediente con puertas de verificación.

## Puertas antes de solicitar aprobación a Google
| Gate | Evidencia necesaria | Estado |
| --- | --- | --- |
| Calidad editorial | Revisión humana de exactitud, lectura móvil, enlaces, autoría, originalidad, utilidad | PENDIENTE |
| Disponibilidad pública | GET 200 HTML/XML de todas las rutas, TLS, canonical, robots, sitemap, sin errores | PENDIENTE |
| Dominio y titular | Confirmar que el solicitante controla dominio y HTML | PENDIENTE |
| Política editorial y legal | Política de privacidad vigente, contacto, cookies y mecanismos de elección | PENDIENTE |
| Cuenta AdSense | Cuenta legítima del titular; si no existe, registrarla desde https://adsense.google.com/start/ | PENDIENTE |
| Conexión AdSense | Metaetiqueta basada en ID comunicado; comprobarla en Google AdSense, elegir **Meta tag** en el panel, desplegar con aprobación y solicitar verificación | PREPARADO EN RAMA / CONEXIÓN PENDIENTE |
| CMP si audiencia EEE/Reino Unido/Suiza | CMP certificada Google e integrada con IAB TCF conforme a la política aplicable; validar rechazo y retirada | PENDIENTE |
| ads.txt | Registro formateado desde ID comunicado; verificar que coincida con **el snippet real de la cuenta**, HTTP 200 y estado autorizado | PREPARADO EN RAMA / PUBLICACIÓN PENDIENTE |
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

## Identificador proporcionado el 2026-11-09

**Publisher ID comunicado en la conversación:** `ca-pub-4830696678723029` (no es una credencial de acceso; falta corroborar el estado de la cuenta).

**Metaetiqueta preparada en portada y guías:**

```html
<meta name="google-adsense-account" content="ca-pub-4830696678723029">
```

**ads.txt preparado en esta rama:**

```text
google.com, pub-4830696678723029, DIRECT, f08c47fec0942fa0
```

**Script original suministrado (NO activo ni añadido a HTML):**

```html
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4830696678723029" crossorigin="anonymous"></script>
```

**Motivo de la decisión:** Google permite oficialmente la alternativa de metaetiqueta como método de verificación del sitio sin el script ejecutable. El sitio tiene una CSP que actualmente no autoriza `pagead2.googlesyndication.com`; agregar el script ahora exigiría ajustes CSP y una decisión sobre publicidad/consentimiento. La política vigente y el aviso actual anuncian que los usos publicitarios siguen desactivados. Este PR no debe introducir solicitudes de anuncios antes de revisar consentimiento y habilitar una CMP certificada cuando corresponda.

**Paso en el panel del titular:** En `Sitios → jadeltechrd.com → Conectar/Verificar`, seleccionar **Meta tag** (etiqueta meta), no el fragmento de script, y solo marcar `Verify` después de que el cambio esté publicado y sea comprobable desde fuera. Después de verificar y completar las políticas, `Request review`. La aceptación no puede ser garantizada.

**Antes de permitir ads.txt o scripts en producción:** verificar titularidad del identificador, revisión de privacidad ES/EN, filtros de dominios/plataformas, modelo de consentimiento, pruebas de CSP y aceptación explícita de los cambios. Mantener la separación entre conectar el dominio y mostrar anuncios reales.
