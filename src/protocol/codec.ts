import {
  ACTION_OPTIONS,
  BUTTON_IDS,
  isLeftHanded,
  readButtonSettings,
  writeButtonSettings,
  type ButtonAction,
  type ButtonId,
  type ButtonSettings,
} from "./buttons";
import {
  readActiveStage,
  readCpiLevels,
  readCpiStages,
  writeActiveStage,
  writeCpiLevels,
  writeCpiStages,
  type CpiStage,
} from "./cpi";
import {
  FILTER_FLAG_MOTION_JITTER,
  FILTER_FLAG_SLAMCLICK,
  OFFSET,
  POLLING_RATES,
  pollingDividerFor,
  pollingRateFor,
  type PollingRate,
} from "./op1";

export interface MouseConfig {
  polling: PollingRate;
  slamclick: boolean;
  motionJitter: boolean;
  angleSnapping: boolean;
  rippleControl: boolean;
  motionSync: boolean;
  glassMode: boolean;
  lodIndex: number;
  cpiLevels: number;
  activeStage: number;
  stages: CpiStage[];
  leftHanded: boolean;
  buttons: Record<ButtonId, ButtonSettings>;
}

export function decodeConfig(bytes: Uint8Array): MouseConfig {
  const flags = bytes[OFFSET.filterFlags];
  const buttons = {} as Record<ButtonId, ButtonSettings>;
  for (const button of BUTTON_IDS) buttons[button] = readButtonSettings(bytes, button);
  return {
    polling: pollingRateFor(bytes[OFFSET.pollingDivider]) ?? 1000,
    slamclick: (flags & FILTER_FLAG_SLAMCLICK) !== 0,
    motionJitter: (flags & FILTER_FLAG_MOTION_JITTER) !== 0,
    angleSnapping: bytes[OFFSET.angleSnapping] !== 0,
    rippleControl: bytes[OFFSET.rippleControl] !== 0,
    motionSync: bytes[OFFSET.motionSync] !== 0,
    glassMode: bytes[OFFSET.glassMode] !== 0,
    lodIndex: bytes[OFFSET.lod],
    cpiLevels: readCpiLevels(bytes),
    activeStage: readActiveStage(bytes),
    stages: readCpiStages(bytes),
    leftHanded: isLeftHanded(bytes),
    buttons,
  };
}

/**
 * Write the UI-facing configuration onto a copy of a previously read report.
 * Starting from the raw buffer keeps reserved, LED-colour and unknown bytes
 * untouched (read-modify-write).
 */
export function encodeConfig(base: Uint8Array, config: MouseConfig): Uint8Array {
  const out = base.slice();

  out[OFFSET.pollingDivider] = pollingDividerFor(config.polling);

  let flags = 0;
  if (config.slamclick) flags |= FILTER_FLAG_SLAMCLICK;
  if (config.motionJitter) flags |= FILTER_FLAG_MOTION_JITTER;
  out[OFFSET.filterFlags] = flags;

  out[OFFSET.angleSnapping] = config.angleSnapping ? 1 : 0;
  out[OFFSET.rippleControl] = config.rippleControl ? 1 : 0;
  out[OFFSET.motionSync] = config.motionSync ? 1 : 0;
  out[OFFSET.glassMode] = config.glassMode ? 1 : 0;
  out[OFFSET.lod] = config.lodIndex;

  writeCpiLevels(out, config.cpiLevels);
  writeActiveStage(out, config.activeStage);
  writeCpiStages(out, config.stages);

  for (const button of BUTTON_IDS) writeButtonSettings(out, button, config.buttons[button]);

  return out;
}

/** Swap the two main-button roles when the Left-handed Mode checkbox toggles. */
export function swapHandedness(config: MouseConfig): void {
  const left = config.buttons.left.action;
  config.buttons.left.action = config.buttons.right.action;
  config.buttons.right.action = left;
  config.leftHanded = !config.leftHanded;
}

/**
 * Motion Sync and 8000 Hz are mutually exclusive on the OP1 8K: Endgame Gear
 * state it is a sensor limitation, and the vendor tool removes the 8000 Hz
 * option while Motion Sync is on. Returns true if a fix-up was applied.
 */
export function sanitizeConfig(config: MouseConfig): boolean {
  if (config.motionSync && config.polling === 8000) {
    config.polling = 4000;
    return true;
  }
  return false;
}

const ACTION_LABELS: Partial<Record<ButtonAction["key"], string>> = Object.fromEntries(
  ACTION_OPTIONS.map((option) => [option.key, option.label]),
);

export function actionLabel(action: ButtonAction): string {
  if (action.key === "raw") return "Custom (preserved)";
  if (action.key === "keyboard") {
    const mods: [number, string][] = [
      [0x01, "Ctrl"],
      [0x02, "Shift"],
      [0x04, "Alt"],
      [0x08, "Win"],
    ];
    const parts = mods.filter(([mask]) => (action.modifiers ?? 0) & mask).map(([, label]) => label);
    parts.push(action.usage ? `HID 0x${action.usage.toString(16).padStart(2, "0")}` : "Unassigned");
    return parts.join(" + ");
  }
  if (action.key === "fixed-cpi") {
    return action.x === action.y ? `CPI ${action.x}` : `X ${action.x} / Y ${action.y}`;
  }
  return ACTION_LABELS[action.key] ?? action.key;
}

export { POLLING_RATES };
