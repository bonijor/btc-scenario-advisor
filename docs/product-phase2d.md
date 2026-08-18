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

## Gate de infraestructura antes de publicar

1. Confirmar si existe Cloud Firestore `(default)` en `linear-poet-426418-k0`.
2. Si no existe, elegir explícitamente la ubicación antes de crearla.
3. Desplegar `firestore.rules` e índices.
4. Validar reglas y realizar un smoke test autenticado.
5. Mantener el PR sin merge hasta que QA e infraestructura sean PASS.
