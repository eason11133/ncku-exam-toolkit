export function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  // An imported item replaces the item with the same ID without changing its position.
  return [...new Map([...current, ...incoming].map(item => [item.id, item])).values()]
}
