# Gate: matriz de dos ingresos
Fecha base: 2026-10-24. Superficie pública, estática y sin API: matriz-oportunidades.html, css y JSON.
El catálogo es PREPARE_ONLY: no presupone acceso autenticado, publicación, propuesta, comisión, liquidación ni ingreso.
Prueba: node --test tests/opportunity-matrix.test.mjs; además validar HTML en móvil, navegación y enlaces oficiales.
Publicación: PR → CI y aprobación humana exact-SHA → merge protegido → despliegue Pages con expected_sha/DEPLOY_PUBLIC_SITE → smoke GET HTML/JSON → revisar CSP/SEO.
Nunca activar PayPal LIVE, D1 writes, envío automático, credenciales o pagos con este PR.
Rollback mediante último SHA autorizado y workflow gobernado.
Próximos gates: verificar registro/enlace personal systeme.io, elegibilidad RD, términos y divulgación; confirmar conectividad y publicación de otras plataformas con permisos explícitos.
