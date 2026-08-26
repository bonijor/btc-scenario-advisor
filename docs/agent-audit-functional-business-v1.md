# Agent Audit Sprint v1 · Funcionalidad + UX + Negocio

Fecha: 2026-08-26

Alcance: frontend público, BI Trading v1, contrato read-only 2.1, identidad Firebase, producto Free/Pro/Premium y guardrails SHADOW.

## Resultado ejecutivo

Estado general: AMARILLO → VERDE CON FIXES EN CANDIDATO.

No se encontraron fallas que habiliten trading real, SELL, shorts, online learning o escritura al motor Quant. Los hallazgos críticos fueron de integridad de presentación, fail-closed visual y consistencia del acceso a BI Trading.

## Hallazgos por agente

### A1 Functional QA

1. **P1 · Trial null representado como cero**
   - Riesgo: `Number(null)` podía convertir `completedDays=null` en `0`, mostrando `0/90` cuando la API había decidido no publicar el contador.
   - Fix: el contador sólo se considera válido si el campo está explícitamente presente y es numérico.

2. **P2 · Error state NONE marcado con tono de error**
   - Riesgo: `NONE` es truthy en JavaScript y podía pintarse como error.
   - Fix: `NONE`, `OK` y `NO_ERROR` se tratan explícitamente como estados sanos.

### A2 UX / First Visitor

3. **P2 · Inconsistencia BTC/USD vs BTC/USDT**
   - Riesgo: el BI consumía BTCUSDT pero rotulaba una tarjeta como BTC/USD y formateaba el valor como USD.
   - Fix: UI y formato pasan a BTC/USDT + sufijo USDT.

4. **P2 · “Qué falta para actuar” demasiado cercano a ejecución real**
   - Riesgo: podía interpretarse como instrucción operativa.
   - Fix: texto cambiado a “Qué falta para elegibilidad Paper”.

### A3 Product Strategist

5. **P1 · “Confianza global” no era una métrica publicada**
   - Riesgo: el BI promediaba probabilidad dominante 5m/15m y la presentaba como confianza global, mezclando probabilidad con confianza/calibración.
   - Fix: se presenta como “Prob. dominante media 5m/15m”. No se inventa una confianza nueva.

### A4 Business Model

6. **P1 · Packaging definido pero propuesta de valor todavía no validada**
   - Estado: existen Free / Pro / Premium como arquitectura de producto, pero no hay evidencia todavía para fijar pricing, willingness-to-pay o límites definitivos.
   - Recomendación: no activar cobros todavía. Validar primero qué función genera retorno recurrente.

Hipótesis de packaging para validar:
- **Free**: lectura base, trial 90D, estado del sistema y BI resumido.
- **Pro**: alertas configurables, historial ampliado, analytics personales y explicaciones de cambios.
- **Premium**: research avanzado, Agent Consensus, benchmark de modelos/agentes y reportes profundos.

Métrica de activación sugerida: usuario que vuelve al menos 3 veces en 7 días y consulta 5m/15m + BI/Paper.

Métricas de negocio a instrumentar antes de pricing:
- activación;
- retención D7 / D30;
- frecuencia de consulta BI;
- uso de alertas;
- consultas de historial;
- conversión Free→Pro en experimento sin cobro o waitlist;
- churn de intención / pérdida de interés.

No incorporar analytics invasivos sin consentimiento y política de privacidad clara.

### A5 Growth & Analytics

7. **P2 · Falta funnel de producto explícito**
   - Propuesta: visita → cuenta verificada → primer BI → segunda sesión → preferencia guardada → alerta activada → intención Pro.
   - No implementar tracking externo hasta definir consentimiento y minimización de datos.

### A6 Quant Explainability

8. **P1 · Diferenciar probabilidad, confianza y calibración**
   - Regla propuesta: Probabilidad = salida del escenario; Calidad/Confianza = etiqueta publicada por motor; BA/Brier/ECE = evidencia de calibración.
   - El frontend no debe derivar una métrica nueva y darle nombre de métrica oficial.

### A7 Risk / Compliance

9. **P1 · Safety visual debía fallar cerrado**
   - Riesgo: si faltaban campos Paper, comparaciones `!== true` podían mostrar PASS aun sin evidencia explícita.
   - Fix: PASS sólo si `rehearsalOnly=true`, `formalTrialMutation=false`, `realOrderCreated=false` y `exchangeOrderRequestMade=false` están publicados explícitamente.

### A8 Security

10. **P1 · BI Trading directo no exigía email verificado**
    - Riesgo: una sesión Firebase existente pero no verificada podía intentar consultar BI directamente, saltando la política UX del gate principal.
    - Fix: BI exige `emailVerified === true` antes de solicitar token y datos.

11. **P1 · main sin protección de rama**
    - Evidencia GitHub: `main` figura sin branch protection activa.
    - Estado: no corregido en este PR porque requiere política del repositorio, no código de aplicación.
    - Recomendación: requerir PR + CI verde para cambios a `main`, y bloquear pushes directos si el plan/repositorio lo permite.

## Guardrails preservados

- SHADOW_MODE=true
- SPOT_ONLY=true
- sin SELL
- sin shorts
- sin ejecución automática
- sin órdenes reales
- ENABLE_ONLINE_LEARNING=false
- API Quant read-only
- sin credenciales de exchange
- sin escritura del BI al Sheet o runtime

## Próximo sprint recomendado

1. Cerrar este hardening con CI verde.
2. Auditar copia comercial y onboarding del primer visitante.
3. Diseñar Agent Ledger de hallazgos de UX/negocio.
4. Instrumentar métricas de producto sólo después de definir consentimiento y eventos mínimos.
5. Validar packaging Free/Pro/Premium con evidencia de uso antes de precios.
