export function parseId(param: string): number | null {
  const n = parseInt(param, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}
