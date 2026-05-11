// Availability — team-builder visibility tag carried on every ability,
// item, and command set in the catalog. Per session 25 / ADR-0049:
//
//   - `'available'`: shown in the team-builder picker and considered in
//     AI team generation.
//   - `'hidden'`:    not surfaced to the team builder or AI generation,
//     but fully functional when authored onto a unit's loadout (test
//     fixtures, system-emitted abilities like `discharge_strike`, or
//     future progression-unlock content).
//
// Engine semantics are unchanged by the field; it is purely a
// presentation-layer concern. Catalog construction (`createCatalog`)
// enforces presence on every ability, item, and command set —
// authoring a definition without the field fails loud at startup so
// the team-builder integration cannot encounter a half-tagged catalog.
export type Availability = 'available' | 'hidden';
