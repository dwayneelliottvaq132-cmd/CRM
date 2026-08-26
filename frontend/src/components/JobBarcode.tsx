import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

/** Real, scannable Code128 barcode encoding a job id — read by the kiosk scan station
 * (see KioskScanPage) with any keyboard-wedge USB/Bluetooth barcode scanner. */
export function JobBarcode({ value, height = 44 }: { value: string; height?: number }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    JsBarcode(ref.current, value, {
      format: "CODE128",
      displayValue: true,
      fontSize: 12,
      height,
      margin: 4,
    });
  }, [value, height]);

  return <svg ref={ref} />;
}
