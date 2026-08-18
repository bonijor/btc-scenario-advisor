# BTC Scenario Advisor · Fase 2 Producto

Estado: FASE 2B EN VALIDACIÓN / NO PUBLICADA

## Objetivo

Convertir el dashboard público en una base de producto con identidad de usuario, perfil, preferencias, membresías y alertas, sin introducir autoridad operativa sobre el motor Quant ni contaminar el trial formal de 90 días.

## Fase 2A · Account shell

Publicación funcional:
- PR #9;
- head validado `11f37abcc3501a89940e48d903fcbfe27cabfa60`;
- merge a `main`: `c311ab88ba3d0d0d7dfd55b51a8a7833549f8f3c`;
- CI candidato: run `32095106148` · SUCCESS.

Alcance publicado:
- nueva vista Cuenta;
- UX de ingreso y registro;
- perfil de usuario en modo preview;
- preferencias 5m/15m y canales web/email/WhatsApp;
- umbral personal de notificación separado del umbral del modelo;
- vista de planes Free / Pro / Premium;
- contrato de seguridad que impide simular autenticación real;
- QA de producto sobre desktop, tablet y mobile.

Regla de seguridad de 2A: mientras `authEnabled=false`, los formularios de acceso no autentican, las contraseñas no se persisten y el estado de cuenta se presenta explícitamente como pendiente. Las preferencias de Fase 2A son únicamente preview local no sensible y no modifican el modelo Quant.

## Evidencia Fase 2A

Primer candidato: Lighthouse bloqueó correctamente la publicación con TBT `266.5ms`, por encima del gate `250ms`. No se relajó el umbral. La inicialización de la capa Cuenta se cambió a lazy-init para no cargar trabajo de producto mientras el usuario permanece en Overview.

Candidato final:
- Lighthouse: Performance 95 / Accessibility 100 / Best Practices 96 / SEO 100;
- FCP `1056.4397ms`;
- LCP `1739.4397ms`;
- CLS `0.0005374625723252444`;
- TBT `244.5ms`;
- Playwright: 77 tests, 55 PASS, 22 SKIP intencionales, 0 FAIL, `retries=0`;
- Browser QA artifact `9309693760`, SHA-256 `40029049478c883abea5287f0e3d9b7506974da01a041760ea1fd8a41dd7946d`;
- Lighthouse artifact `9309664898`, SHA-256 `e3d7220270d1b1c036d943786940963cb139266c0efe230cbf9752a5e49654bc`.

El QA verifica además que las credenciales de los formularios no se persistan y que el preview de preferencias no cambie parámetros del modelo.

## Fase 2B · Identidad real

Proveedor gestionado: Firebase Authentication sobre el proyecto Google Cloud existente `linear-poet-426418-k0`.

Gate de infraestructura completado:
- FirebaseProject `ACTIVE` sobre el mismo project ID y project number;
- Web App `BTC Scenario Advisor Web` registrada y `ACTIVE`;
- App ID `1:531376347818:web:fc733e0485165b4c158ed3`;
- dominio de autenticación `linear-poet-426418-k0.firebaseapp.com`;
- Email/Password habilitado;
- Google habilitado;
- `bonijor.github.io` incluido en dominios autorizados;
- secreto OAuth rotado después del diagnóstico y nunca incorporado al repositorio.

Candidato de frontend en rama `agent/product-phase2b-firebase-auth`:
- configuración pública oficial de Firebase, sin credenciales privadas;
- adaptador modular Firebase JS SDK cargado sólo al abrir Cuenta;
- registro real con Email/Password;
- actualización de display name y envío de verificación de email;
- ingreso con Email/Password;
- Google Sign-In mediante popup;
- persistencia de sesión gestionada por Firebase;
- observación de sesión con `onAuthStateChanged`;
- logout real;
- errores de autenticación traducidos a mensajes de producto sin exponer detalles internos;
- fail-closed si el SDK/proveedor no puede inicializarse;
- ningún password o token se persiste manualmente por el dashboard.

El QA de 2B utiliza un adaptador determinístico inyectado por Playwright. Ese adaptador sólo existe dentro del proceso de prueba y evita depender de cuentas reales o de red externa para validar login, registro, Google, sesión, logout y responsive. La implementación pública no activa mocks mediante query strings ni simula usuarios cuando Firebase falla.

La capa de identidad se carga de forma lazy. Overview, Analytics, Paper y Trial no incorporan Firebase al camino crítico inicial. El presupuesto estático incluye el adaptador de Auth como asset diferido y Lighthouse conserva los gates existentes.

## Fase 2C · Perfil persistente y preferencias

- perfil por `uid`;
- preferencias sincronizadas server-side;
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
- ninguna identidad concede autoridad sobre el runtime Quant o exchanges;
- ningún secreto de identidad o mensajería en GitHub Pages.

## Gate de publicación Fase 2B

Fase 2B permanece fuera de `main` hasta completar:
- CI estático PASS;
- Playwright cross-browser PASS con `retries: 0`;
- Lighthouse dentro de los gates vigentes;
- verificación de no persistencia manual de contraseñas/tokens;
- escaneo de material sensible PASS;
- runtime Quant y trial sin cambios;
- aprobación explícita del gate de publicación.
