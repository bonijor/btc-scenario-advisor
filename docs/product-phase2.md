# BTC Scenario Advisor · Fase 2 Producto

Estado: FASE 2A EN DESARROLLO · NO PUBLICADO

## Objetivo

Convertir el dashboard público en una base de producto con identidad de usuario, perfil, preferencias, membresías y alertas, sin introducir autoridad operativa sobre el motor Quant ni contaminar el trial formal de 90 días.

## Fase 2A · Account shell

Alcance:
- nueva vista Cuenta;
- UX de ingreso y registro;
- perfil de usuario en modo preview;
- preferencias 5m/15m y canales web/email/WhatsApp;
- umbral personal de notificación separado del umbral del modelo;
- vista de planes Free / Pro / Premium;
- contrato de seguridad que impide simular autenticación real;
- QA de producto sobre desktop, tablet y mobile.

Regla de seguridad: mientras `authEnabled=false`, los formularios de acceso no autentican, las contraseñas no se persisten y el estado de cuenta se presenta explícitamente como pendiente. Las preferencias de Fase 2A son únicamente preview local no sensible y no modifican el modelo Quant.

## Proveedor de identidad propuesto

Firebase Authentication sobre el ecosistema Google Cloud existente. La integración real se reserva para Fase 2B, después de registrar una aplicación web y obtener su configuración pública oficial. No se inventarán valores de configuración ni se incorporarán secretos al repositorio.

## Fase 2B · Identidad real

Gate de entrada:
1. proyecto Firebase asociado al proyecto Google Cloud elegido;
2. aplicación web registrada;
3. Authentication habilitado con proveedores aprobados;
4. dominios autorizados restringidos;
5. adaptador Firebase modular integrado;
6. sesión observable con `onAuthStateChanged`;
7. tests contra emulador o entorno controlado antes de producción.

## Fase 2C · Perfil persistente y preferencias

- perfil por `uid`;
- preferencias sincronizadas servidor-side;
- consentimiento por canal;
- teléfono verificado antes de WhatsApp;
- auditoría de cambios de preferencias;
- separación estricta entre preferencias del usuario y parámetros del modelo congelado.

## Fase 2D · Membresías y cuotas

- Free / Pro / Premium;
- autorización server-side por plan;
- cuotas/rate limits;
- billing separado del runtime Quant;
- ninguna membresía concede capacidad de ejecutar órdenes.

## Fase 2E · Alertas

- web push;
- email;
- WhatsApp;
- deduplicación y cooldown;
- consentimiento revocable;
- alertas probabilísticas, nunca órdenes de compra/venta.

## Guardrails invariantes

- SHADOW;
- SPOT_ONLY;
- sin SELL;
- sin shorts;
- sin ejecución automática;
- API Quant pública sólo lectura;
- ningún dato de usuario modifica V5.9.0 durante el trial;
- ningún secreto de identidad o mensajería en GitHub Pages.

## Publicación

Fase 2A sólo puede fusionarse a `main` cuando:
- CI estático pasa;
- Playwright cross-browser pasa con `retries: 0`;
- Lighthouse permanece dentro de los gates vigentes;
- no hay almacenamiento de contraseñas/tokens;
- el runtime Quant y el trial no cambian.
