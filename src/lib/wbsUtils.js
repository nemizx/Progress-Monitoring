export function compareWbsIds(a, b) {
  const partsA = String(a).split('.').map(Number);
  const partsB = String(b).split('.').map(Number);
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const na = partsA[i] ?? 0;
    const nb = partsB[i] ?? 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

export function getNextChildWbsId(parentWbsId, siblings) {
  const prefix = `${parentWbsId}.`;
  const childNumbers = siblings
    .filter((s) => s.startsWith(prefix))
    .map((s) => parseInt(s.slice(prefix.length), 10))
    .filter((n) => !Number.isNaN(n));
  const next = childNumbers.length > 0 ? Math.max(...childNumbers) + 1 : 1;
  return `${parentWbsId}.${next}`;
}

export function getNextL1WbsId(items) {
  const l1Numbers = items
    .filter((i) => i.level === 1)
    .map((i) => parseInt(i.wbs_id, 10))
    .filter((n) => !Number.isNaN(n));
  const next = l1Numbers.length > 0 ? Math.max(...l1Numbers) + 1 : 1;
  return String(next);
}
