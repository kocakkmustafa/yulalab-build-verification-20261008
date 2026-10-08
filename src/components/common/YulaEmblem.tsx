type Props = {
  /** Rendered size in px. The artwork is authored on a 200×200 grid. */
  size?: number;
  className?: string;
  /**
   * Small sizes (header/footer marks) drop the glow and the falling
   * filaments — at 22–26px they turn into mud rather than detail.
   */
  detail?: "full" | "mark";
  title?: string;
};

/**
 * YULA Lab emblem — the flame-drop silhouette, the glowing core, the six
 * metallic arms and the filaments falling from the core.
 *
 * Authored as vector rather than shipped as a raster: the closing scene
 * scales it to ~300px against pure black, where a cut-out PNG shows its
 * alpha fringe, and the same artwork has to read at 22px in the footer.
 * Vector also keeps it in the same visual language as the filament field,
 * which is drawn with the identical stroke ramp.
 */
export function YulaEmblem({
  size = 200,
  className = "",
  detail = "full",
  title,
}: Props) {
  const full = detail === "full";
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      fill="none"
    >
      <defs>
        <radialGradient id="ye-core" cx="50%" cy="42%" r="58%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="26%" stopColor="#E8FBFF" />
          <stop offset="62%" stopColor="#7FD8DC" />
          <stop offset="100%" stopColor="#1B5460" />
        </radialGradient>
        <linearGradient id="ye-metal" x1="18%" y1="0%" x2="82%" y2="100%">
          <stop offset="0%" stopColor="#E4EDEF" />
          <stop offset="42%" stopColor="#93A9B0" />
          <stop offset="100%" stopColor="#4E656D" />
        </linearGradient>
        {full && (
          <radialGradient id="ye-bloom" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#B8F0F5" stopOpacity="0.42" />
            <stop offset="45%" stopColor="#4FA8B8" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#2A6E7A" stopOpacity="0" />
          </radialGradient>
        )}
      </defs>

      {full && <circle cx="100" cy="103" r="62" fill="url(#ye-bloom)" />}

      {/* six arms, sweeping out and up from behind the drop */}
      <g
        stroke="url(#ye-metal)"
        strokeWidth="2.6"
        strokeLinecap="round"
        opacity="0.9"
      >
        <path d="M84 108 C 66 96, 56 78, 55 58" />
        <path d="M78 120 C 55 110, 39 94, 31 74" />
        <path d="M75 133 C 50 132, 30 124, 14 110" />
        <path d="M116 108 C 134 96, 144 78, 145 58" />
        <path d="M122 120 C 145 110, 161 94, 169 74" />
        <path d="M125 133 C 150 132, 170 124, 186 110" />
      </g>

      {/* flame-drop silhouette — outer shell and inner bevel */}
      <path
        d="M100 14 C 122 52, 138 78, 138 100 C 138 128, 121 148, 100 148
           C 79 148, 62 128, 62 100 C 62 78, 78 52, 100 14 Z"
        stroke="url(#ye-metal)"
        strokeWidth="3.2"
      />
      <path
        d="M100 30 C 117 60, 130 82, 130 101 C 130 123, 117 139, 100 139
           C 83 139, 70 123, 70 101 C 70 82, 83 60, 100 30 Z"
        stroke="#8FA6AD"
        strokeWidth="1.1"
        opacity="0.55"
      />

      {/* the core */}
      <circle cx="100" cy="103" r="21" fill="url(#ye-core)" />
      <circle cx="100" cy="103" r="21" stroke="#CFEFF3" strokeWidth="0.8" opacity="0.5" />
      <circle cx="94" cy="96" r="5.4" fill="#FFFFFF" opacity="0.75" />

      {/* filaments falling from the core — the motif the whole page is built on */}
      {full && (
        <g stroke="#7FD8DC" strokeLinecap="round" fill="none">
          <path d="M94 122 C 91 140, 89 156, 90 176" strokeWidth="1.5" opacity="0.85" />
          <path d="M100 124 C 100 142, 101 158, 99 180" strokeWidth="1.7" opacity="0.95" />
          <path d="M106 122 C 110 140, 112 154, 110 174" strokeWidth="1.4" opacity="0.8" />
          <path d="M88 118 C 82 136, 78 148, 76 166" strokeWidth="1.1" opacity="0.6" />
          <path d="M112 118 C 118 136, 122 148, 124 164" strokeWidth="1.1" opacity="0.6" />
        </g>
      )}
    </svg>
  );
}
