/**
 * Lets the page scroll when the pointer is over the chart (no wheel zoom / time pan).
 */
export const lightweightChartNoWheelCapture = {
  handleScroll: { mouseWheel: false },
  handleScale: { mouseWheel: false },
} as const
