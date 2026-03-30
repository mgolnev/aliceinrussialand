import { Forward } from "lucide-react";
import type { LucideProps } from "lucide-react";

/**
 * Единая иконка «поделиться» (как в Telegram): Lucide {@link https://lucide.dev/icons/forward Forward}.
 */
export function ShareForwardIcon({
  size = 20,
  strokeWidth = 2.25,
  ...rest
}: LucideProps) {
  return (
    <Forward size={size} strokeWidth={strokeWidth} aria-hidden {...rest} />
  );
}
