export type LabelCandidate = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  availableWidth: number;
  availableHeight: number;
};
/** Greedy screen-space packing; only placed labels reserve space. */
export function layoutLabels(
  candidates: LabelCandidate[],
  viewportWidth: number,
  viewportHeight: number,
) {
  const cells = new Map<string, number[][]>(),
    accepted: LabelCandidate[] = [];
  for (const c of candidates) {
    if (c.availableWidth < c.width || c.availableHeight < c.height) continue;
    const box = [
      c.x - c.width / 2 - 4,
      c.y - c.height / 2 - 3,
      c.x + c.width / 2 + 4,
      c.y + c.height / 2 + 3,
    ];
    if (
      box[0] < 0 ||
      box[1] < 0 ||
      box[2] > viewportWidth ||
      box[3] > viewportHeight
    )
      continue;
    const keys: string[] = [];
    for (let x = Math.floor(box[0] / 128); x <= Math.floor(box[2] / 128); x++)
      for (let y = Math.floor(box[1] / 128); y <= Math.floor(box[3] / 128); y++)
        keys.push(`${x}:${y}`);
    if (
      keys.some((k) =>
        (cells.get(k) || []).some(
          (b) =>
            box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1],
        ),
      )
    )
      continue;
    accepted.push(c);
    for (const k of keys) {
      if (!cells.has(k)) cells.set(k, []);
      cells.get(k)!.push(box);
    }
  }
  return accepted;
}
