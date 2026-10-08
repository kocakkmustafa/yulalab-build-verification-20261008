type Props = { size?: number; className?: string };

/**
 * YULA Lab monogram mark — small dark-on-dark glyph used in the Header / Footer.
 * The real `yulalab-logo.png` will replace this once the visual asset is finalised;
 * until then the typographic mark looks intentional next to the wordmark.
 */
export function YulaMark({ size = 28, className = "" }: Props) {
  return (
    <span
      className={"logo-mark inline-flex items-center justify-center rounded-md " + className}
      style={{
        width: size,
        height: size,
        background: "linear-gradient(135deg, #1a1a1e 0%, #0a0a0b 100%)",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        width={size * 0.62}
        height={size * 0.62}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: "#F4F4F5" }}
      >
        <path d="M4 4l8 9 8-9" />
        <path d="M12 13v7" />
      </svg>
    </span>
  );
}
