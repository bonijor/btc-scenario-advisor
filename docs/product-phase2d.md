# Product Phase 2D · Private account workspace

Estado: CANDIDATO EN RAMA / NO PUBLICADO

## Objetivo

Convertir la cuenta autenticada en un espacio privado persistente sin ampliar permisos sobre el motor Quant, el trial de 90 días ni ningún exchange.

## Arquitectura

- Identidad: Firebase Authentication.
- Perfil persistente: Cloud Firestore en `users/{uid}`.
- Preferencias: Cloud Firestore en `users/{uid}/settings/preferences`.
- Entitlements futuros: `entitlements/{uid}` sólo lectura para el propio usuario. El navegador no puede escribir esos documentos.
- Caché local: sólo preferencias no sensibles para resiliencia.

## Seguridad

`firestore.rules` aplica default-deny, exige que `request.auth.uid` coincida con el UID del documento y valida tipos y rangos. No se permiten listados globales de usuarios. Los entitlements son lectura por propietario y escritura denegada desde clientes.

## UX

Sin sesión se mantiene una única tarjeta de acceso. Con sesión se revela el espacio privado con estado de sincronización, editor de nombre visible, preferencias persistentes y estado de plan informativo.

Si Cloud Firestore no está disponible, la cuenta permanece autenticada y la interfaz degrada a caché local no sensible. Nunca se muestra una sincronización como exitosa si no ocurrió.

## Membresías

Fase 2D prepara lectura de entitlements, pero no activa pagos ni checkout. Ninguna autorización premium debe confiar en un plan calculado por el navegador. La autoridad futura deberá venir de backend.

## Guardrails inmutables

SHADOW · SPOT_ONLY · sin SELL · sin shorts · sin ejecución automática · API Quant read-only · V5.9.0 congelado durante el trial.

- ningún dato de usuario modifica V5.9.0.
- ningún entitlement puede habilitar órdenes de mercado.

## Evidencia de infraestructura

Gate 1: PASS.

- proyecto: `linear-poet-426418-k0`
- database: `(default)`
- location: `southamerica-east1`
- edition: `STANDARD`
- type: `FIRESTORE_NATIVE`
- delete protection: `DELETE_PROTECTION_ENABLED`
- free tier: `true`
- App Engine: no configurado
- creado: `2026-08-18T06:55:35.069045Z`

Gate 2: PASS.

- Firebase CLI: `15.27.0`
- candidate commit desplegado: `3ef2614aba181e0dc7873f95ff9e8268204b5c53`
- target: proyecto `linear-poet-426418-k0`, database `(default)`
- alcance del deploy: `firestore:rules` solamente
- compilación: PASS
- publicación: `firestore.rules` liberadas correctamente a Cloud Firestore
- Hosting, Quant runtime, trial y exchange gateway: no modificados por este deploy

La base y las reglas ya están publicadas, pero el frontend de Fase 2D permanece sin merge hasta completar validación efectiva de reglas y smoke test autenticado.

## Gate de infraestructura antes de publicar

1. ✅ Crear/verificar Cloud Firestore `(default)` en `linear-poet-426418-k0` y fijar ubicación `southamerica-east1`.
2. ✅ Desplegar `firestore.rules` de Fase 2D.
3. ⏳ Validar reglas: anónimo denegado, propietario permitido, UID ajeno denegado, entitlements sin escritura cliente.
4. ⏳ Realizar smoke test autenticado de perfil/preferencias.
5. ⏳ Mantener el PR sin merge hasta que QA e infraestructura sean PASS.
