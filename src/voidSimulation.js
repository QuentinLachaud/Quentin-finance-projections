// Session-only modelling overlay. Never write simulated income into portfolio state,
// rental agreements, or Supabase records.
export function applySimulatedVoids(properties, voidPropertyIds = new Set()) {
  const ids = voidPropertyIds instanceof Set ? voidPropertyIds : new Set(voidPropertyIds)
  return (Array.isArray(properties) ? properties : []).map((property) => ({
    ...property,
    simulatedVoid: ids.has(String(property.id)),
  }))
}
