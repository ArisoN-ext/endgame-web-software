/**
 * Endgame Gear OP1 8K (wired, PID 0x1964) — wire protocol constants.
 *
 * Reverse-engineered from
 *   "Endgame Gear OP1 8k Configuration Tool V1.12.exe" (native MFC, 32-bit)
 * via static analysis and cross-checked against independent community reverse
 * engineering of the same shared config protocol.
 *
 * Transport: USB HID feature reports on the vendor collection
 * (usage page 0xFF01, usage 0x02).
 */

export const EGG_VENDOR_ID = 0x3367;
export const EGG_OP1_8K_PID = 0x1964;

export const EGG_USAGE_PAGE = 0xff01;
export const EGG_USAGE = 0x0002;

/** Feature report carrying the full 1041-byte configuration blob. */
export const REPORT_CONFIG = 0xa0;
/** Feature report carrying short commands / status (64 bytes). */
export const REPORT_COMMAND = 0xa1;
/** Input report the mouse pushes for live events (8 bytes). */
export const REPORT_EVENT = 0x03;

export const CONFIG_REPORT_SIZE = 1041;
export const COMMAND_REPORT_SIZE = 64;
export const EVENT_REPORT_SIZE = 8;
/** The 1024-byte payload sits at report offset 16. */
export const CONFIG_PAYLOAD_OFFSET = 16;

/** Low byte of the little-endian opcode word placed at report byte 1. */
export const OP_STORE = 0x11;
export const OP_LOAD = 0x12;
export const OP_FACTORY_RESET = 0x13;
export const OP_FIRMWARE = 0x02;

export const STATUS_OK = 0x01;
export const STATUS_BUSY = 0x03;

/**
 * Offsets are absolute into the 1041-byte 0xA0 feature report
 * (byte 0 = report ID).
 */
export const OFFSET = {
  pollingDivider: 21,
  filterFlags: 22,
  ledOnLiftOff: 24,
  lod: 25,
  angleSnapping: 26,
  rippleControl: 27,
  motionSync: 28,
  activeStage: 29,
  cpiLevels: 30,
  stageColors: 31,
  firstCpiStage: 51,
  leftButtonMapping: 71,
  firstButton: 77,
  glassMode: 127,
  angleTuning: 128,
  forceMaxFps: 129,
  preserveByte: 130,
} as const;

export const CPI_STAGE_STRIDE = 5;
export const BUTTON_STRIDE = 7;
export const BUTTON_RECORD_COUNT = 7;
export const CPI_STAGE_COUNT_MAX = 4;

export const FILTER_FLAG_SLAMCLICK = 0x01;
export const FILTER_FLAG_MOTION_JITTER = 0x10;

/** Polling rate dropdown: divider -> Hz (Hz = 8000 / divider). */
export const POLLING_RATES = [1000, 2000, 4000, 8000] as const;
export type PollingRate = (typeof POLLING_RATES)[number];

export function pollingDividerFor(rate: PollingRate): number {
  return 8000 / rate;
}
export function pollingRateFor(divider: number): PollingRate | null {
  const rate = divider > 0 ? 8000 / divider : 0;
  return (POLLING_RATES as readonly number[]).includes(rate) ? (rate as PollingRate) : null;
}

/** V1 (0x1964) lift-off distance is a 3-entry list index. */
export const LOD_OPTIONS_V1 = ["0.7 mm", "1 mm", "2 mm"] as const;
/**
 * With Sensor Glass Mode on, the vendor tool trims the 0.7 mm entry, leaving a
 * 2-entry list. Confirmed from the v1.12 binary (only "0.7mm", "1mm", "2mm"
 * literals exist, and the glass-mode handler swaps the combo contents).
 */
export const LOD_OPTIONS_V1_GLASS = ["1 mm", "2 mm"] as const;

export function lodOptions(glassMode: boolean): readonly string[] {
  return glassMode ? LOD_OPTIONS_V1_GLASS : LOD_OPTIONS_V1;
}

/**
 * The CPI indicator colour is fixed per STAGE by firmware (not derived from the
 * stage's CPI value and not read from the blob's colour records at 31-50).
 * Order is CPI 1..4 = blue, green, yellow, red; the vendor UI paints these same
 * swatches. Verified against the binary (hardcoded literals) and the LED.
 */
export const STAGE_COLORS = ["#0000ff", "#00ff00", "#ffff00", "#ff0000"] as const;

export const CPI_MIN = 50;
export const CPI_MAX = 26000;
export const CPI_STEP = 50;

/** Default multiclick filter value observed on the device. */
export const DEFAULT_MULTICLICK = 8;

/** SPDT selector sentinel values (Left / Right buttons). */
export const SPDT_SAFE = 0xf0;
export const SPDT_SPEED = 0xf1;
export type SpdtMode = "off" | "safe" | "speed";
