import { CornerUpRight } from "lucide-react";
import type { LucideProps } from "lucide-react";

/**
 * Единая иконка «поделиться»: визуально как SF Symbol `arrow.turn.up.right`;
 * в Lucide — {@link https://lucide.dev/icons/corner-up-right corner-up-right}.
 */
export function ShareForwardIcon({
  size = 20,
  strokeWidth = 2.25,
  ...rest
}: LucideProps) {
  return (
    <CornerUpRight
      size={size}
      strokeWidth={strokeWidth}
      aria-hidden
      {...rest}
    />
  );
}
