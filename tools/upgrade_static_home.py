from pathlib import Path
import re

path = Path('index.html')
text = path.read_text(encoding='utf-8')

start = text.find('    <section class="hero" data-view="home">')
end = text.find('    <article class="legal" data-view="privacy" hidden>')
if start < 0 or end < 0 or end <= start:
    raise SystemExit('Legacy home block markers not found; refusing to modify index.html')

home = '''    <section class="commercial-home static-commercial-fallback" data-view="home">
      <section class="hero-v2" id="inicio">
        <div class="hero-copy reveal">
          <div class="eyebrow"><span class="live-dot"></span> Jadel Tech RD · Agentic Systems Studio</div>
          <h1>Agentes de IA que <span>convierten procesos en sistemas.</span></h1>
          <p class="lead">
            Diseñamos e integramos agentes, automatización, video premium, inteligencia social,
            dashboards, Meta/Facebook, revenue intelligence y sistemas cuantitativos supervisados,
            con seguridad, trazabilidad y aprobación humana donde importa.
          </p>
          <div class="actions">
            <a class="button primary" href="#servicios">Explorar servicios <span aria-hidden="true">↘</span></a>
            <a class="button secondary" href="#precios">Ver precios</a>
          </div>
          <div class="hero-trust" aria-label="Principios de operación">
            <span>✓ Human-in-the-loop</span>
            <span>✓ Fail-closed</span>
            <span>✓ Integraciones oficiales</span>
            <span>✓ Evidencia auditable</span>
          </div>
        </div>

        <div class="agent-console reveal" aria-label="Jadel Agent Control Plane">
          <div class="console-bar">
            <span class="console-dot"></span><span class="console-dot"></span><span class="console-dot"></span>
            <span class="console-title">Jadel Agent Control Plane</span>
            <span class="console-state">READY</span>
          </div>
          <div class="agent-core">
            <div class="core-orbit orbit-a"><span>Media</span><span>Data</span><span>Sales</span></div>
            <div class="core-orbit orbit-b"><span>Risk</span><span>Policy</span><span>Ops</span></div>
            <div class="core-node"><strong>JT</strong><small>ORCHESTRATOR</small></div>
          </div>
          <div class="console-events">
            <div><span class="event-ok">PASS</span><b>Policy gate</b><small>acciones sensibles controladas</small></div>
            <div><span class="event-ok">PASS</span><b>Evidence ledger</b><small>trazabilidad de decisiones</small></div>
            <div><span class="event-wait">HITL</span><b>Human approval</b><small>supervisión cuando corresponde</small></div>
          </div>
        </div>
      </section>

      <section class="signal-strip reveal" aria-label="Propuesta de valor">
        <div><strong>11+</strong><span>servicios agentic y de automatización</span></div>
        <div><strong>3</strong><span>niveles claros de madurez técnica</span></div>
        <div><strong>0</strong><span>promesas falsas de autonomía o rentabilidad</span></div>
        <div><strong>1</strong><span>arquitectura integrada de ingeniería y gobierno</span></div>
      </section>

      <section class="section-block" id="servicios">
        <div class="section-heading reveal">
          <div>
            <div class="eyebrow">Servicios destacados</div>
            <h2>Una sola firma. Múltiples capacidades de IA aplicadas.</h2>
          </div>
          <p>La experiencia interactiva completa se activa con JavaScript; esta versión base mantiene el catálogo comercial visible incluso si el navegador limita scripts.</p>
        </div>
        <div class="services-grid static-service-grid">
          <article class="service-card reveal"><div class="service-topline"><span class="service-icon">⌘</span><span class="status-badge status-available">Servicio de ingeniería</span></div><h3>Arquitectura Agentic & Automatización</h3><p>Agentes, workflows, APIs, MCP, RAG, memoria, routing, guardrails y handoffs para procesos reales.</p><ul class="service-deliverables"><li>Arquitectura objetivo</li><li>Mapa de procesos</li><li>Plan de integración</li><li>Backlog priorizado</li></ul><div class="service-footer"><div><span class="price-caption">Precio de lanzamiento</span><strong>Desde US$250</strong></div></div></article>
          <article class="service-card reveal"><div class="service-topline"><span class="service-icon">▶</span><span class="status-badge status-pilot">Piloto supervisado</span></div><h3>CineForge · Video Premium</h3><p>Dirección creativa, reels, QC, captions, thumbnails, inteligencia de tendencias y conectores sociales con aprobación humana.</p><ul class="service-deliverables"><li>Creative direction</li><li>Video QC</li><li>Social intelligence</li><li>Publisher connectors</li></ul><div class="service-footer"><div><span class="price-caption">Precio de lanzamiento</span><strong>Desde US$180/reel</strong></div></div></article>
          <article class="service-card reveal"><div class="service-topline"><span class="service-icon">◎</span><span class="status-badge status-available">Implementable</span></div><h3>Agente de Soporte & Tickets</h3><p>Chat, clasificación, knowledge base, tickets, escalación humana y dashboards para atención más rápida y medible.</p><ul class="service-deliverables"><li>Chat de soporte</li><li>Gestión de tickets</li><li>Escalación humana</li><li>Dashboard</li></ul><div class="service-footer"><div><span class="price-caption">Precio de lanzamiento</span><strong>US$900 + US$149/mes</strong></div></div></article>
          <article class="service-card reveal"><div class="service-topline"><span class="service-icon">∞</span><span class="status-badge status-available">Servicio de ingeniería</span></div><h3>Meta/Facebook Integration</h3><p>OAuth, Facebook Pages, permisos, App Review, cumplimiento y flujos seguros de publicación.</p><ul class="service-deliverables"><li>OAuth</li><li>Pages API</li><li>Review readiness</li><li>Compliance URLs</li></ul><div class="service-footer"><div><span class="price-caption">Precio de lanzamiento</span><strong>Desde US$850</strong></div></div></article>
          <article class="service-card reveal"><div class="service-topline"><span class="service-icon">◇</span><span class="status-badge status-available">Servicio de ingeniería</span></div><h3>AI Governance & Production Readiness</h3><p>Políticas fail-closed, secretos, supply chain, SLOs, observabilidad, evaluaciones adversariales y evidencia de readiness.</p><ul class="service-deliverables"><li>Threat model</li><li>Policy gates</li><li>CI/CD controls</li><li>Readiness report</li></ul><div class="service-footer"><div><span class="price-caption">Precio de lanzamiento</span><strong>Desde US$2,500</strong></div></div></article>
          <article class="service-card reveal"><div class="service-topline"><span class="service-icon">∑</span><span class="status-badge status-research">Research-only</span></div><h3>Quant Research & Trading Risk</h3><p>Backtesting, walk-forward, risk engine y arquitectura de ejecución supervisada sin promesas de rentabilidad ni capital autónomo.</p><ul class="service-deliverables"><li>Research pipeline</li><li>Backtest design</li><li>Risk controls</li><li>Production gates</li></ul><div class="service-footer"><div><span class="price-caption">Proyecto</span><strong>Desde US$2,000</strong></div></div></article>
        </div>
      </section>

      <section class="section-block pricing-section" id="precios">
        <div class="section-heading reveal">
          <div><div class="eyebrow">Paquetes</div><h2>Empieza pequeño. Escala cuando la evidencia lo justifique.</h2></div>
          <p>Los precios son referencias de lanzamiento. Integraciones, volumen, proveedores externos, seguridad y cumplimiento pueden modificar el alcance final.</p>
        </div>
        <div class="pricing-grid">
          <article class="pricing-card reveal"><span class="plan-label">Discover</span><h3>Agentic Blueprint</h3><div class="plan-price"><strong>US$250</strong><span>desde</span></div><p>Diagnóstico, arquitectura y roadmap.</p></article>
          <article class="pricing-card featured reveal"><div class="popular-pill">Más adaptable</div><span class="plan-label">Build</span><h3>Business Agent</h3><div class="plan-price"><strong>US$1.5k</strong><span>setup desde</span></div><p>Un agente integrado a un flujo real con supervisión.</p></article>
          <article class="pricing-card reveal"><span class="plan-label">Scale</span><h3>Agentic System</h3><div class="plan-price"><strong>US$4.5k</strong><span>setup desde</span></div><p>Orquestación multi-agente y workflows durables.</p></article>
          <article class="pricing-card reveal"><span class="plan-label">Enterprise</span><h3>Managed Agent Platform</h3><div class="plan-price"><strong>Custom</strong><span>desde US$10k</span></div><p>Arquitectura, seguridad, integraciones y operación gestionada.</p></article>
        </div>
      </section>

      <section class="final-cta reveal">
        <div><div class="eyebrow">Jadel Tech RD</div><h2>De una idea de IA a un sistema que tu negocio pueda controlar.</h2><p>Explora servicios, configura el alcance y conserva siempre visibilidad sobre permisos, costes y decisiones críticas.</p></div>
        <div class="actions"><a class="button primary" href="#servicios">Explorar capacidades</a><a class="button secondary" href="/?view=privacy">Privacidad y datos</a></div>
      </section>
    </section>

'''

new_text = text[:start] + home + text[end:]

# Make the source navigation useful before JavaScript enhancement.
new_text = new_text.replace(
    '''      <nav class="nav" aria-label="Navegación principal">\n        <a href="/" data-nav="home">Inicio</a>\n        <a href="/?view=privacy" data-nav="privacy">Privacidad</a>\n        <a href="/?view=terms" data-nav="terms">Condiciones</a>\n      </nav>''',
    '''      <nav class="nav" aria-label="Navegación principal">\n        <a href="/" data-nav="home">Inicio</a>\n        <a href="/#servicios">Servicios</a>\n        <a href="/#precios">Precios</a>\n        <a href="/?view=privacy" data-nav="privacy">Privacidad</a>\n        <a href="/?view=terms" data-nav="terms">Condiciones</a>\n        <a href="/?view=data-deletion" data-nav="data-deletion">Eliminar datos</a>\n      </nav>'''
)

# Improve source footer so legal links remain discoverable without JS.
new_text = new_text.replace(
    '''      <nav aria-label="Enlaces legales">\n        <a href="/?view=privacy">Política de Privacidad</a>\n        <a href="/?view=terms">Condiciones del Servicio</a>\n      </nav>''',
    '''      <nav aria-label="Enlaces legales">\n        <a href="/#servicios">Servicios</a>\n        <a href="/#precios">Precios</a>\n        <a href="/?view=privacy">Política de Privacidad</a>\n        <a href="/?view=terms">Condiciones del Servicio</a>\n        <a href="/?view=data-deletion">Eliminación de datos</a>\n      </nav>'''
)

if 'static-commercial-fallback' not in new_text:
    raise SystemExit('Static commercial home was not inserted')
if 'data-view="privacy" hidden' not in new_text or 'data-view="terms" hidden' not in new_text:
    raise SystemExit('Legal views were not preserved')

path.write_text(new_text, encoding='utf-8')
print('STATIC_COMMERCIAL_HOME=PASS')
