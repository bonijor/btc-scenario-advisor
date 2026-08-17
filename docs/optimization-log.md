# BTC Scenario Advisor - Optimization Log

## Registro 2026-08-17 - Fase 1 PRO

Estado: **PUBLICADO / VALIDADO**

Rama de implementación: `agent/dashboard-pro-phase1`

Baseline público congelado para esta fase:

- `main` inicial: `ee4253d7a2aac8a1a47809800d45091bcfac9ede`
- dashboard backend: `btc-shadow-dashboard-api-00002-6zb`
- runtime Quant: `btc-shadow-engine-90d-00003-9nq`
- trial: `btc-shadow-90d-20260817T173948Z`

Publicación Fase 1 PRO:

- PR: `#2`
- head validado: `c7b00f653f971e133ab50776764422ff7fdef705`
- merge commit: `c9f4c423eedcbad1224380f70b15d478504b11a1`
- CI PR run `#5` / `32066743243`: `SUCCESS`
- CI main run `#6` / `32067301007`: `SUCCESS`
- GitHub Pages run `#4` / `32067298693`: `SUCCESS`
- URL pública: `https://bonijor.github.io/btc-scenario-advisor/`

## Objetivo

Convertir el dashboard público actual en una interfaz preparada para escalar a producto sin modificar el motor Quant, el manifiesto del trial ni los guardrails operativos.

## Cambios de Fase 1

1. Separación del frontend en `index.html`, `assets/styles.css` y `assets/app.js`.
2. Nuevo layout PRO con jerarquía visual orientada a operación y observabilidad.
3. Gráfico de velas BTC/USDT desde Binance pública, sin librerías externas y sin credenciales.
4. Selector visual de timeframe `1m`, `5m`, `15m`, `1h`.
5. Indicador de frescura del último ciclo del runtime.
6. Estado visible de API read-only, mercado y evidencia del trial.
7. Decisiones 5m/15m con calidad, Balanced Accuracy, BSS y ECE cuando la API los publica.
8. Vista Analytics con historial del motor y métricas verificables.
9. Paper Trading conserva política fail-closed: no infiere operaciones ni P&L desde señales.
10. Navegación móvil dedicada.
11. Sección de arquitectura preparada para cuenta, alertas, membresías y agentes, todavía deshabilitadas.
12. Refuerzo de CI para frontend modular y controles de seguridad.
13. Validación de contrato DOM: sin IDs duplicados, referencias JS faltantes ni vistas huérfanas.

## Guardrails que NO cambian

- `SHADOW_MODE=true`
- `SPOT_ONLY=true`
- sin SELL
- sin shorts
- sin ejecución automática
- sin secretos Binance en frontend
- API pública sólo lectura
- no se modifica el modelo V5.9.0 durante esta fase
- no se modifica el trial 90d
- no se crean checkpoints desde el dashboard

## Evidencia de publicación

La Fase 1 fue publicada únicamente después de cumplir:

- JavaScript syntax PASS
- DOM contract PASS
- safety assertions PASS
- guardrail assertions PASS
- PR mergeable
- API read-only operativa
- ausencia de endpoints de escritura y secretos
- autorización explícita para publicación
- CI de `main` SUCCESS
- GitHub Pages deployment SUCCESS

## Registro 2026-08-17 - Fase 1.1 Responsive Hardening

Estado: **PUBLICADO / VALIDADO**

Rama: `agent/dashboard-responsive-hardening`

Baseline: `main` en `dc76d921154288739e0d69a5340ff753fd1c3be1`.

Publicación Fase 1.1:

- PR: `#4`
- head validado: `ce8adb55a6b63451fae4840a94052692e1de56bf`
- merge commit: `c8d14841c6b900856b5fa7329ad0d2a9679894c1`
- CI PR run `#9` / `32069089082`: `SUCCESS`
- CI main run `#10` / `32069161154`: `SUCCESS`
- GitHub Pages run `#6` / `32069160419`: `SUCCESS`
- URL pública: `https://bonijor.github.io/btc-scenario-advisor/`

### Objetivo

Garantizar que todo el dashboard, especialmente los gráficos y paneles analíticos, se adapte a distintos navegadores, tamaños, densidades de píxel y orientaciones sin desbordar el viewport ni comprimir ilegiblemente la información.

### Cambios responsive

1. Espaciados, tipografías, alturas y padding fluidos mediante `clamp()`.
2. Breakpoints progresivos para desktop ancho, notebook, tablet, mobile y mobile estrecho.
3. Navegación inferior activada también para tablets y viewport angosto.
4. Safe areas con `env(safe-area-inset-*)` para dispositivos con notch y barras del sistema.
5. Grids definidos con `minmax(0,1fr)` y `min-width:0` para evitar overflow de cards y textos largos.
6. Tablas con scroll táctil horizontal contenido, sin expandir el viewport global.
7. Canvas BTC dimensionado por tamaño real del contenedor y densidad de píxel, limitado a DPR 3.
8. Densidad dinámica de velas: aproximadamente 42 en pantallas muy estrechas, 54/68 en móviles, 90 en tablet, 120 en notebook y hasta 140 en desktop ancho.
9. Escala del gráfico adaptativa para padding, tipografía y cantidad de líneas horizontales.
10. `ResizeObserver` sobre el contenedor del gráfico para redibujar ante cambios reales de layout.
11. Redibujado ante `resize`, `orientationchange` y cambios de `visualViewport`.
12. Tratamiento especial para dispositivos en landscape de baja altura.
13. Soporte `prefers-reduced-motion` y targets táctiles más grandes.
14. El gráfico vuelve a recalcularse al regresar a Overview y al volver la pestaña a primer plano.

### Seguridad y alcance

- cambio sólo de frontend;
- no modifica API;
- no modifica motor Quant;
- no modifica trial 90d;
- no modifica Bucket Lock;
- no añade métodos de escritura;
- no añade secretos ni credenciales;
- conserva SHADOW, SPOT_ONLY, sin SELL y sin shorts.

### Evidencia de validación Fase 1.1

- JavaScript syntax PASS;
- DOM contract PASS;
- responsive contract PASS;
- safety assertions PASS;
- guardrail assertions PASS;
- PR mergeable;
- CI de `main` SUCCESS;
- GitHub Pages deployment SUCCESS.

## Próximas fases propuestas

### Fase 2 - Producto autenticado

- identidad de usuario
- preferencias
- dashboard privado
- separación landing/app

### Fase 3 - Alertas

- web push
- email
- WhatsApp
- consentimiento, rate limits y preferencias por horizonte

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
