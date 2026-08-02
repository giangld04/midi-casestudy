/**
 * Konva Layer: renders the marquee (rubber-band) selection rectangle while
 * the user is dragging in "select" mode.
 *
 * Draws a semi-transparent green fill + stroke to indicate the selection area.
 * Non-interactive (listening=false) so it doesn't interfere with hit-testing.
 */

import { Layer, Rect } from "react-konva";
import { ACCENT_GREEN, ACCENT_GREEN_SOFT } from "@/lib/theme-constants";

interface MarqueeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface MarqueeLayerProps {
  /** The current drag rectangle in stage coordinates. Null when not dragging. */
  rect: MarqueeRect | null;
}

export default function MarqueeLayer({ rect }: MarqueeLayerProps) {
  if (!rect) return <Layer />;

  return (
    <Layer listening={false}>
      <Rect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        fill={ACCENT_GREEN_SOFT}
        stroke={ACCENT_GREEN}
        strokeWidth={1.5}
        dash={[4, 3]}
      />
    </Layer>
  );
}
