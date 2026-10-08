export function HeroBackdrop() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className="absolute drift-a"
        style={{
          width: "70vw",
          height: "70vw",
          left: "-15vw",
          top: "-25vw",
          background:
            "radial-gradient(circle, rgba(120,140,255,0.08) 0%, transparent 60%)",
          filter: "blur(120px)",
        }}
      />
      <div
        className="absolute drift-b"
        style={{
          width: "60vw",
          height: "60vw",
          right: "-15vw",
          top: "0vw",
          background:
            "radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 60%)",
          filter: "blur(120px)",
        }}
      />
      <div
        className="absolute drift-c"
        style={{
          width: "60vw",
          height: "60vw",
          left: "20vw",
          bottom: "-20vw",
          background:
            "radial-gradient(circle, rgba(160,120,255,0.05) 0%, transparent 60%)",
          filter: "blur(140px)",
        }}
      />
    </div>
  );
}
