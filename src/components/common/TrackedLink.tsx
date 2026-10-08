"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { categoriseTarget, track } from "@/lib/analytics/client";
import type { EventName, TargetCategory } from "@/lib/analytics/events";



type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  event: EventName;
  product?: string;
  targetCategory?: TargetCategory;
  children: ReactNode;
};

/**
 * An outbound link that reports where it sent the visitor.
 *
 * The one rule that shapes this component: it must behave exactly like a
 * plain `<a>`. No preventDefault, no await, no "navigate after the beacon
 * resolves". track() hands the event to navigator.sendBeacon, which the
 * browser delivers even after the document is destroyed — so measuring the
 * click costs the visitor nothing, and a failing analytics endpoint can
 * never swallow a navigation.
 *
 * onAuxClick is included because middle-click and cmd-click open a new tab
 * without firing onClick in some browsers; without it, power users would be
 * systematically missing from the outbound numbers, biasing the very metric
 * this exists to report.
 */
export function TrackedLink({
  href,
  event,
  product,
  targetCategory,
  children,
  onClick,
  onAuxClick,
  ...rest
}: Props) {
  const report = () => {
    const outbound = href.startsWith("https://");
    track({
      event,
      product,
      target: outbound ? href : undefined,
      targetCategory: outbound ? (targetCategory ?? categoriseTarget(href)) : undefined,
    });
  };

  return (
    <a
      href={href}
      onClick={(e) => {
        report();
        onClick?.(e);
      }}
      onAuxClick={(e) => {
        if (e.button === 1) report();
        onAuxClick?.(e);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
