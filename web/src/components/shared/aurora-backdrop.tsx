export function AuroraBackdrop() {
  return (
    <div className="aurora-backdrop" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, #04080f 0%, #081326 50%, #0a1422 100%)",
        }}
      />
    </div>
  );
}
