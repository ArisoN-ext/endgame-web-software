/**
 * Firmware version decoding. The device stores BCD patch/major bytes; e.g.
 * `37 01` renders as "V1.37". Several offsets have been observed on different
 * shapes, so we try the known candidates and keep a raw/100 fallback.
 */

function decodeBcdByte(value: number): number | null {
  const high = value >> 4;
  const low = value & 0x0f;
  return high <= 9 && low <= 9 ? high * 10 + low : null;
}

export function formatFirmwareVersion(bytes: Uint8Array): string | null {
  for (const offset of [17, 16, 18]) {
    const patch = decodeBcdByte(bytes[offset] ?? 0xff);
    const major = decodeBcdByte(bytes[offset + 1] ?? 0xff);
    if (patch !== null && major !== null && major > 0) {
      return `V${major}.${String(patch).padStart(2, "0")}`;
    }
  }
  return null;
}
