/** Fit the region into the unobscured part of the map, below search/context. */
export function cameraPadding(
  width: number,
  height: number,
  contextBottom: number,
) {
  const mobile = width < 900;
  return {
    top: Math.min(
      Math.max(mobile ? 180 : 150, contextBottom + 28),
      height * 0.55,
    ),
    bottom: Math.min(mobile ? 60 : 70, height * 0.15),
    left: mobile ? 24 : 60,
    right: mobile ? 64 : 70,
  };
}
