import QRCode from "qrcode";

const QUIET_ZONE = 2;

/** Vector QR rendered synchronously, so it is crisp at any card size and changes the moment `value` does. */
export function QrSvg({
  value,
  label = "QR code",
  dark = "#07100b",
  light = "#f7f1e3",
  className,
}: {
  value: string;
  label?: string;
  dark?: string;
  light?: string;
  className?: string;
}) {
  const { modules } = QRCode.create(value, { errorCorrectionLevel: "M" });
  const span = modules.size + QUIET_ZONE * 2;
  let path = "";
  for (let row = 0; row < modules.size; row += 1) {
    for (let col = 0; col < modules.size; col += 1) {
      if (modules.get(row, col)) path += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`;
    }
  }
  return (
    <svg
      viewBox={`0 0 ${span} ${span}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={label}
      data-qr-payload={value}
      className={className}
    >
      <rect width={span} height={span} fill={light} />
      <path d={path} fill={dark} />
    </svg>
  );
}
