---
'@coongro/products': patch
---

Saca `consumeOneAtomic`, `resolveTargets` y `planConsumption` de la superficie
RPC renombrándolos con prefijo `_`.

El auto-wire del runtime registra como acción todo método del prototipo salvo el
constructor y los prefijados con `_`; el `private` de TypeScript se borra al
compilar y no alcanza. `consumeOneAtomic` escribe stock con el `take` que reciba
— la disponibilidad y el FIFO los calcula `consume` antes de llamarlo, así que
invocarlo suelto salteaba esos guardas.
