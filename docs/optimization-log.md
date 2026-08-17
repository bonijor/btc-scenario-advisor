# BTC Scenario Advisor - Optimization Log

## Registro 2026-08-17 - Fase 1 PRO

Estado: **EN DESARROLLO / NO PUBLICADO**

Rama: `agent/dashboard-pro-phase1`

Baseline público congelado para esta fase:

- `main`: `ee4253d7a2aac8a1a47809800d45091bcfac9ede`
- dashboard backend: `btc-shadow-dashboard-api-00002-6zb`
- runtime Quant: `btc-shadow-engine-90d-00003-9nq`
- trial: `btc-shadow-90d-20260817T173948Z`

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

## Criterio de publicación

La Fase 1 no se mergea a `main` hasta cumplir simultáneamente:

- JavaScript syntax PASS
- safety assertions PASS
- PR revisable y mergeable
- API read-only continúa operativa
- no aparecen endpoints de escritura ni secretos
- autorización explícita para publicación

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
