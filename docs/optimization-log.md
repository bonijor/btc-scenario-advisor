# BTC Scenario Advisor - Optimization Log

Este archivo mantiene la trazabilidad de las mejoras del dashboard público. Las fases de frontend no modifican el motor Quant congelado, el trial formal de 90 días ni sus guardrails operativos.

## Guardrails permanentes del dashboard

- `SHADOW_MODE=true`
- `SPOT_ONLY=true`
- sin SELL
- sin shorts
- sin ejecución automática
- sin secretos Binance en frontend
- API pública sólo lectura
- sin checkpoints creados desde el dashboard
- modelo V5.9.0 sin modificación por estas fases

---

## Registro 2026-08-17 - Fase 1 PRO

Estado: **PUBLICADO / VALIDADO**

Rama de implementación: `agent/dashboard-pro-phase1`

Baseline público:

- `main` inicial: `ee4253d7a2aac8a1a47809800d45091bcfac9ede`
- dashboard backend: `btc-shadow-dashboard-api-00002-6zb`
- runtime Quant: `btc-shadow-engine-90d-00003-9nq`
- trial: `btc-shadow-90d-20260817T173948Z`

Evidencia:

- PR `#2`
- head validado `c7b00f653f971e133ab50776764422ff7fdef705`
- merge `c9f4c423eedcbad1224380f70b15d478504b11a1`
- CI PR `32066743243`: SUCCESS
- CI main `32067301007`: SUCCESS
- GitHub Pages `32067298693`: SUCCESS

Cambios principales:

1. Frontend modular en `index.html`, `assets/styles.css` y `assets/app.js`.
2. Layout PRO orientado a observabilidad.
3. Gráfico BTC/USDT público sin credenciales.
4. Timeframes 1m, 5m, 15m y 1h.
5. Frescura del runtime y estados fail-closed.
6. Decisiones 5m/15m con calidad, BA, BSS y ECE cuando la API los publica.
7. Analytics e historial.
8. Paper Trading sin inferir trades ni P&L inexistentes.
9. Navegación móvil.
10. Base visual para futuras cuentas, alertas, membresías y agentes.
11. Contrato DOM, safety y guardrails en CI.

---

## Registro 2026-08-17 - Fase 1.1 Responsive Hardening

Estado: **PUBLICADO / VALIDADO**

Rama: `agent/dashboard-responsive-hardening`

Baseline: `dc76d921154288739e0d69a5340ff753fd1c3be1`

Evidencia:

- PR `#4`
- head validado `ce8adb55a6b63451fae4840a94052692e1de56bf`
- merge `c8d14841c6b900856b5fa7329ad0d2a9679894c1`
- CI PR `32069089082`: SUCCESS
- CI main `32069161154`: SUCCESS
- GitHub Pages `32069160419`: SUCCESS

Cambios principales:

1. Espaciados, tipografías y alturas fluidas mediante `clamp()`.
2. Breakpoints para desktop, notebook, tablet, mobile y mobile estrecho.
3. Safe areas para notch y barras del sistema.
4. Grids con `minmax(0,1fr)` y control de overflow.
5. Tablas táctiles con scroll horizontal contenido.
6. Canvas dimensionado por contenedor y DPR, limitado a 3.
7. Densidad de velas dinámica según ancho disponible.
8. Escala adaptativa del gráfico.
9. `ResizeObserver`, `resize`, `orientationchange` y `visualViewport`.
10. Landscape de baja altura y `prefers-reduced-motion`.
11. Responsive Contract obligatorio en CI.

---

## Registro 2026-08-17/18 - Fase 1.2 QA de dispositivos y navegadores

Estado: **PUBLICADO / VALIDADO**

Rama de implementación: `agent/dashboard-qa-phase1-2`

Baseline: `main` en `4cc975a2c16f07ddc6e4f3d9dd855d534e3d6716`

Publicación funcional:

- PR `#6`
- head validado final `71b34ad524d67708340ebbc9ea37c7ae67a6f35f`
- merge a `main` `ab12587b494bdb350b6374c9fff78035c78f1094`
- `main` confirmado apuntando a ese merge después de publicación

### Objetivo

Convertir el responsive de Fase 1.1 en evidencia automática reproducible. Cada cambio de frontend debe demostrar que el dashboard continúa utilizable y contenido en múltiples motores, resoluciones, orientaciones y densidades antes de publicarse.

### Matriz QA final

- Chromium desktop `1920x1080`
- Firefox notebook `1366x768`
- WebKit tablet `1024x768`, DPR 2 y touch
- Chromium mobile `390x844`, DPR 3 y touch
- WebKit mobile `390x844`, DPR 3 y touch
- WebKit mobile landscape `844x390`
- Chromium narrow `320x568`

Los proyectos usan motores Chromium, Firefox y WebKit de Playwright. Los perfiles mobile/tablet emulan viewport, DPR, touch y modo mobile; no se presentan como una granja de dispositivos físicos.

### Contratos automáticos

1. Sin overflow horizontal global.
2. Canvas BTC con dimensiones utilizables.
3. Backing buffer del canvas coherente con tamaño CSS y DPR actual.
4. Navegación Overview, Analytics y Paper Trading funcional.
5. Tablas anchas contenidas dentro de `.tableWrap`.
6. Resize vivo de desktop a mobile con redibujado del canvas.
7. Fixtures determinísticos de API y mercado exclusivamente dentro del runner QA.
8. Screenshots de Overview y Analytics por proyecto.
9. Trace, screenshot y video conservados ante fallos.
10. Artifact de Playwright retenido 14 días.
11. `retries: 0`: un caso flaky bloquea la publicación.
12. `workers=1` en CI para priorizar estabilidad y reproducibilidad.
13. QA ejecutado en imagen Playwright `v1.62.1-noble` con browsers preinstalados.
14. Servidor estático QA portable implementado en Node.

### Hallazgos y correcciones de QA

La fase produjo defectos útiles antes de publicar:

- CI `32088526753`: detectó una carrera de inicialización del backing buffer del canvas en WebKit tablet/mobile/landscape. La publicación fue bloqueada.
- CI `32088868316`: el workflow quedó verde por retry, pero WebKit tablet registró un caso flaky. Ese resultado fue rechazado como gate de publicación.
- Se endureció la espera de estabilización del canvas sin relajar la tolerancia final.
- Se añadió `assets/responsive-bootstrap.js`, que fuerza reconciliación responsive después de `load`, `pageshow` y resolución de fuentes.
- Se fijó `retries: 0` para impedir que un retry convierta un comportamiento intermitente en falso PASS.
- Un intento estricto posterior quedó cancelado antes de ejecutar tests porque la instalación de dependencias de browsers consumió la ventana del job. No se interpretó como fallo funcional.
- Se migró el job a la imagen oficial de Playwright, se eliminó la instalación pesada por corrida y se redujo CI a un worker.

### Gate final limpio

CI final PR: `32090551348`.

Resultado:

- 28 tests registrados
- 22 PASS
- 6 SKIP intencionales porque el test de live-resize corre sólo una vez en Chromium desktop
- 0 FAIL
- 0 flaky
- 0 retry
- Chromium PASS
- Firefox PASS
- WebKit tablet PASS
- Chromium mobile PASS
- WebKit mobile PASS
- WebKit landscape PASS
- Chromium 320px PASS

Artifact final:

- nombre `dashboard-browser-qa-32090551348`
- artifact ID `9308196545`
- tamaño aproximado 9.4 MB
- SHA-256 `222e17c3842432a0198f6529355fae0485b48238dbb44e0d77673a6dbfea4c11`

El mismo gate incluye syntax, DOM contract, responsive contract, browser QA contract, safety y guardrails antes del job cross-browser.

### Alcance de seguridad

- no modifica runtime Quant
- no modifica API read-only
- no modifica trial 90d
- no modifica Bucket Lock
- no crea checkpoints
- no añade credenciales
- no usa endpoints de escritura
- los fixtures QA no forman parte del flujo productivo
- conserva SHADOW, SPOT_ONLY, sin SELL y sin shorts

---

## Próximas fases propuestas

### Fase 1.3 - Performance y accesibilidad

- Lighthouse / Core Web Vitals como gate
- budgets de performance
- accesibilidad automática y teclado
- contraste y ARIA
- reducción de carga y requests
- revisión de caché y assets

### Fase 2 - Producto autenticado

- identidad de usuario
- preferencias
- dashboard privado
- separación landing/app

### Fase 3 - Alertas

- web push
- email
- WhatsApp
- consentimiento y rate limits
- preferencias por horizonte

### Fase 4 - Data platform

- eventos desacoplados
- warehouse analítico
- dashboards de cohortes y performance histórica

### Fase 5 - Agentes supervisores

- Runtime Auditor
- Trial Evidence Auditor
- Quant Research Assistant
- Repo Guardian
- Dashboard Explainer

Los agentes continúan fuera de la ruta de ejecución y sin autoridad de trading.
