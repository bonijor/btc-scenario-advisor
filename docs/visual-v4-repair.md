# Visual V4: reparacion funcional acotada

Fecha: 2026-09-06. PR #41. Revision de partida: `a27817c93a0eeacbfb9a0e8c84a555be3f59a848`.
Base funcional: `42bb9b4fcaf3530c8c872ced4ee6498716d05168`.

## Reparacion

Se restauran por blob exacto de la base `index.html`, `assets/app.js` y `assets/responsive-bootstrap.js`. Esto recupera Cuenta/perfil/preferencias, navegacion movil, acceso a BI Trading, Data Pulse, redimensionado del grafico y el bootstrap dentro de sus presupuestos originales. No se sustituyen identificadores ausentes por excepciones de pruebas.

Se retira del diff neto el panel y renderer de Adaptive Grid, que requieren otro cambio con su propio contrato de datos faltantes y antiguedad. No se agrega aqui esa funcion ni se toca su productor. No se modifica Quant ni el contrato de la API.

Readiness conserva su informacion fechada de Visual V3, pero crea su panel y carga su CSS solo al abrirlo. El JavaScript de control se sigue cargando desde el bootstrap original; no se afirma una descarga diferida de todo el modulo. Hay controles en el menu lateral y en Sistema para acceso movil. La primera activacion carga y abre, soporta teclado/hash/historial, evita duplicados y permite reintentar tras error o timeout de CSS. Una carga tardia no debe devolver al usuario a una vista abandonada.

Los estados DATA / ECONOMICS / FORMAL 90D / RISK / EXECUTION y los valores del snapshot fechado `2026-09-03T09:17:13.501Z` se conservan. No representan una auditoria actual, dias nuevos ni aprobacion de operabilidad. `LIVE_READY = FALSE`, SHADOW y SPOT_ONLY permanecen intactos.

## Pruebas

- Se preservan los workflows, thresholds, presupuestos y pruebas existentes.
- `qa:budget` conserva la comprobacion estatica original y luego ejecuta 9 pruebas unitarias nuevas del modulo real con DOM controlado.
- Se agregan 6 casos E2E a la matriz Playwright existente: estructura restaurada, primera apertura, teclado/revisitas, error/reintento, solicitudes repetidas/cambio de vista y enlace directo/historial. Los datos/auth QA son locales y sinteticos; no equivalen a validacion de Firebase, Cloud Run ni evidencia del ensayo.
- Las 9 pruebas unitarias pasaron localmente con Node 22.16.0. La conectividad del entorno local no permitio clonar/instalar dependencias ni ejecutar Playwright/Lighthouse completos. La evidencia remota debe registrarse con SHA/run/resultados en el PR; no se anticipa un PASS.

## Alcance y salida

Sin cambios en Firebase, permisos, seguridad de acceso, backend, GCP, motor, parametros, ensayo, ledger o PR #78 del repositorio core. Sin operaciones ni despliegue. El PR permanece Draft hasta Validate, Browser QA y Lighthouse aprobados para la revision final y revision humana. No reducir controles para obtener verde.

Rollback: este seguimiento permanece aislado en la rama del PR, sin estado productivo nuevo. Antes de integrar, retirar la propuesta no requiere alterar servicios ni evidencia. Ante una futura regresion, restaurar una revision verificada y su suite coherente, sin habilitar ejecucion real ni editar contadores.
