import type { ProjectConfig } from "@/lib/types";

type Props = {
  project: ProjectConfig;
  size?: number;
  radius?: number;
};

export function ProjectMonogram({ project, size = 64, radius = 14 }: Props) {
  const text = project.monogram || project.name.slice(0, 1);
  const factor = text.length === 1 ? 0.46 : 0.3;

  return (
    <div
      className="relative flex items-center justify-center overflow-hidden"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: project.brand.gradient,
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -16px 32px rgba(0,0,0,0.35)",
      }}
      aria-hidden
    >
      <span
        className="font-display font-bold tracking-tight"
        style={{
          fontSize: size * factor,
          color: "rgba(0,0,0,0.78)",
          textShadow: "0 1px 0 rgba(255,255,255,0.18)",
          fontFamily: project.brand.fontDisplay,
        }}
      >
        {text}
      </span>
    </div>
  );
}
