# BTC Scenario Advisor PRO · Shadow Lab

Dashboard estático de observación para el trial SHADOW de BTC Scenario Advisor.

## Funciones incluidas

- Precio y velas públicas BTC/USDT desde Binance REST.
- Estado del motor y decisiones oficiales desde una API sanitizada de sólo lectura.
- Data Pulse con procedencia, frescura y separación entre mercado público y lectura Quant.
- Horizontes 1m, 5m, 15m, 45m y 1d; únicamente 5m/15m son elegibles para el motor formal.
- Velas cerradas; 45m se agrega de tres cierres consecutivos de 15m.
- Métricas de calidad, activación, invalidación y motivo de bloqueo del motor formal.
- Trial de 90 días, Auto-Paper y funnel sustentados únicamente por evidencia publicada.
- Cuenta, preferencias e historial aislados de la capa Quant.
- Estado fail-closed cuando una fuente no responde; no se inventan precios, señales ni progreso.

## Publicación

El sitio está preparado para GitHub Pages desde la raíz de la rama `main`.

## Aviso

Es un producto informativo en `SHADOW_MODE` y `SPOT_ONLY`. No ejecuta operaciones, no habilita SELL/shorts y no reemplaza asesoramiento financiero profesional.
