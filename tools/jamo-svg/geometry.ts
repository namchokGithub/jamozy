const onCurvePoints = (subpath: string) =>
  subpath.split(/(?=[LQCZ])/).flatMap((part) => {
    const values = (part.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
    return values.length >= 2 ? [[values.at(-2)!, values.at(-1)!] as const] : []
  })

/** Even-odd containment over each subpath's on-curve points; enough for ownership probes. */
export function pathContains(d: string, x: number, y: number) {
  return d
    .split('M')
    .filter(Boolean)
    .reduce((inside, subpath) => {
      const points = onCurvePoints(subpath)
      let crossings = 0
      points.forEach(([px, py], index) => {
        const [qx, qy] = points[(index + points.length - 1) % points.length]
        if (py > y !== qy > y && x < ((qx - px) * (y - py)) / (qy - py) + px)
          crossings += 1
      })
      return crossings % 2 === 1 ? !inside : inside
    }, false)
}
