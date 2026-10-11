import {
  BUTTON_STRIDE,
  DEFAULT_MULTICLICK,
  OFFSET,
  SPDT_SAFE,
  SPDT_SPEED,
  type SpdtMode,
} from "./op1";

/** Physical buttons in the order the vendor UI presents them. */
export const BUTTON_IDS = [
  "left",
  "right",
  "middle",
  "forward",
  "back",
  "wheelUp",
  "wheelDown",
] as const;
export type ButtonId = (typeof BUTTON_IDS)[number];

export const BUTTON_LABELS: Record<ButtonId, string> = {
  left: "Left Button",
  right: "Right Button",
  middle: "Middle Button",
  forward: "Forward Button",
  back: "Back Button",
  wheelUp: "Wheel Up",
  wheelDown: "Wheel Down",
};

/**
 * Record index that carries each physical button's 7-byte slot. The mapping
 * bytes are shifted for the two main buttons: the dedicated 71-76 slot always
 * describes physical Left, and record 0 always describes physical Right, in
 * both handedness modes.
 */
const ACTION_OFFSET: Record<ButtonId, number> = {
  left: OFFSET.leftButtonMapping,
  right: OFFSET.firstButton + 0 * BUTTON_STRIDE + 1,
  middle: OFFSET.firstButton + 1 * BUTTON_STRIDE + 1,
  forward: OFFSET.firstButton + 2 * BUTTON_STRIDE + 1,
  back: OFFSET.firstButton + 3 * BUTTON_STRIDE + 1,
  wheelUp: OFFSET.firstButton + 5 * BUTTON_STRIDE + 1,
  wheelDown: OFFSET.firstButton + 6 * BUTTON_STRIDE + 1,
};

/** Multiclick/SPDT control byte slots (left..back), physical button order. */
const CONTROL_OFFSET: Partial<Record<ButtonId, number>> = {
  left: OFFSET.firstButton + 0 * BUTTON_STRIDE,
  right: OFFSET.firstButton + 1 * BUTTON_STRIDE,
  middle: OFFSET.firstButton + 2 * BUTTON_STRIDE,
  forward: OFFSET.firstButton + 3 * BUTTON_STRIDE,
  back: OFFSET.firstButton + 4 * BUTTON_STRIDE,
};

export function actionOffset(button: ButtonId): number {
  return ACTION_OFFSET[button];
}

/** Which main button the user may remap given the current handedness. */
export function isMappable(button: ButtonId, leftHanded: boolean): boolean {
  if (button === "left") return leftHanded;
  if (button === "right") return !leftHanded;
  return true;
}

export type ActionKey =
  | "mouse-left"
  | "mouse-right"
  | "mouse-middle"
  | "mouse-back"
  | "mouse-forward"
  | "scroll-up"
  | "scroll-down"
  | "keyboard"
  | "cpi-loop"
  | "fixed-cpi"
  | "media-play"
  | "media-next"
  | "media-previous"
  | "media-mute"
  | "media-volume-up"
  | "media-volume-down"
  | "browser-home"
  | "file-explorer"
  | "disabled"
  | "raw";

export interface ButtonAction {
  key: ActionKey;
  /** Keyboard modifier bitmask: 0x01 Ctrl, 0x02 Shift, 0x04 Alt, 0x08 Win. */
  modifiers?: number;
  /** USB HID usage id for a keyboard key. */
  usage?: number;
  x?: number;
  y?: number;
  rawType?: number;
  rawParams?: number[];
}

export interface ActionOption {
  group: string;
  key: ActionKey;
  label: string;
}

export const ACTION_OPTIONS: readonly ActionOption[] = [
  { group: "Mouse", key: "mouse-left", label: "Left Click" },
  { group: "Mouse", key: "mouse-right", label: "Right Click" },
  { group: "Mouse", key: "mouse-middle", label: "Middle Click" },
  { group: "Mouse", key: "mouse-back", label: "Back" },
  { group: "Mouse", key: "mouse-forward", label: "Forward" },
  { group: "Scroll", key: "scroll-up", label: "Wheel Up" },
  { group: "Scroll", key: "scroll-down", label: "Wheel Down" },
  { group: "Keyboard", key: "keyboard", label: "Keyboard shortcut" },
  { group: "CPI", key: "cpi-loop", label: "CPI Loop" },
  { group: "CPI", key: "fixed-cpi", label: "Fixed CPI" },
  { group: "Media", key: "media-play", label: "Play / Pause" },
  { group: "Media", key: "media-next", label: "Next Track" },
  { group: "Media", key: "media-previous", label: "Previous Track" },
  { group: "Media", key: "media-mute", label: "Mute" },
  { group: "Media", key: "media-volume-up", label: "Volume Up" },
  { group: "Media", key: "media-volume-down", label: "Volume Down" },
  { group: "System", key: "browser-home", label: "Browser Home" },
  { group: "System", key: "file-explorer", label: "File Explorer" },
  { group: "Other", key: "disabled", label: "Disabled" },
];

const MOUSE_CODES: Record<number, ActionKey> = {
  0x01: "mouse-left",
  0x02: "mouse-right",
  0x04: "mouse-middle",
  0x08: "mouse-back",
  0x10: "mouse-forward",
};

const MEDIA_CODES: Record<number, ActionKey> = {
  0xcd: "media-play",
  0xb5: "media-next",
  0xb6: "media-previous",
  0xe2: "media-mute",
  0xe9: "media-volume-up",
  0xea: "media-volume-down",
};

export function decodeAction(type: number, params: readonly number[]): ButtonAction {
  const p = (i: number): number => params[i] ?? 0;
  if (type === 0x00 && MOUSE_CODES[p(0)] !== undefined) return { key: MOUSE_CODES[p(0)] };
  if (type === 0x01 && p(0) === 0x01) return { key: "scroll-up" };
  if (type === 0x01 && p(0) === 0xff) return { key: "scroll-down" };
  if (type === 0x02) return { key: "keyboard", modifiers: p(0) & 0x0f, usage: p(1) };
  if (type === 0x09) return { key: "cpi-loop" };
  if (type === 0x0c) return { key: "fixed-cpi", x: p(1) | (p(2) << 8), y: p(3) | (p(4) << 8) };
  if (type === 0x18 && p(0) === 0x96) return { key: "browser-home" };
  if (type === 0x18 && p(0) === 0x94) return { key: "file-explorer" };
  if (type === 0x20 && MEDIA_CODES[p(0)] !== undefined) return { key: MEDIA_CODES[p(0)] };
  if (type === 0xff) return { key: "disabled" };
  return { key: "raw", rawType: type, rawParams: [0, 1, 2, 3, 4].map(p) };
}

export interface EncodedAction {
  type: number;
  params: [number, number, number, number, number];
}

export function encodeAction(action: ButtonAction): EncodedAction {
  const params = (...values: number[]): EncodedAction["params"] => {
    const out: EncodedAction["params"] = [0, 0, 0, 0, 0];
    values.slice(0, 5).forEach((v, i) => (out[i] = v & 0xff));
    return out;
  };
  switch (action.key) {
    case "mouse-left": return { type: 0x00, params: params(0x01) };
    case "mouse-right": return { type: 0x00, params: params(0x02) };
    case "mouse-middle": return { type: 0x00, params: params(0x04) };
    case "mouse-back": return { type: 0x00, params: params(0x08) };
    case "mouse-forward": return { type: 0x00, params: params(0x10) };
    case "scroll-up": return { type: 0x01, params: params(0x01) };
    case "scroll-down": return { type: 0x01, params: params(0xff) };
    case "keyboard": return { type: 0x02, params: params(action.modifiers ?? 0, action.usage ?? 0) };
    case "cpi-loop": return { type: 0x09, params: params(0xf1) };
    case "fixed-cpi": {
      const x = action.x ?? 1600;
      const y = action.y ?? x;
      return { type: 0x0c, params: params(0, x, x >> 8, y, y >> 8) };
    }
    case "browser-home": return { type: 0x18, params: params(0x96) };
    case "file-explorer": return { type: 0x18, params: params(0x94) };
    case "media-play": return { type: 0x20, params: params(0xcd) };
    case "media-next": return { type: 0x20, params: params(0xb5) };
    case "media-previous": return { type: 0x20, params: params(0xb6) };
    case "media-mute": return { type: 0x20, params: params(0xe2) };
    case "media-volume-up": return { type: 0x20, params: params(0xe9) };
    case "media-volume-down": return { type: 0x20, params: params(0xea) };
    case "disabled": return { type: 0xff, params: params() };
    case "raw": return { type: action.rawType ?? 0xff, params: params(...(action.rawParams ?? [])) };
  }
}

export function readAction(bytes: Uint8Array, offset: number): ButtonAction {
  return decodeAction(bytes[offset], [
    bytes[offset + 1],
    bytes[offset + 2],
    bytes[offset + 3],
    bytes[offset + 4],
    bytes[offset + 5],
  ]);
}

export function writeAction(bytes: Uint8Array, offset: number, action: ButtonAction): void {
  const { type, params } = encodeAction(action);
  bytes[offset] = type;
  for (let i = 0; i < 5; i += 1) bytes[offset + 1 + i] = params[i];
}

export interface ButtonSettings {
  action: ButtonAction;
  multiclick: number | null;
  spdt: SpdtMode;
  spdtAvailable: boolean;
}

export function readButtonSettings(bytes: Uint8Array, button: ButtonId): ButtonSettings {
  const action = readAction(bytes, actionOffset(button));

  const ctrlOff = CONTROL_OFFSET[button];
  const spdtAvailable = button === "left" || button === "right";
  let multiclick: number | null = null;
  let spdt: SpdtMode = "off";
  if (ctrlOff !== undefined) {
    const raw = bytes[ctrlOff];
    if (raw === SPDT_SAFE) spdt = "safe";
    else if (raw === SPDT_SPEED) spdt = "speed";
    else multiclick = raw;
  }
  return { action, multiclick, spdt, spdtAvailable };
}

export function writeButtonSettings(bytes: Uint8Array, button: ButtonId, settings: ButtonSettings): void {
  writeAction(bytes, actionOffset(button), settings.action);

  const ctrlOff = CONTROL_OFFSET[button];
  if (ctrlOff === undefined) return;
  if (settings.spdtAvailable && settings.spdt === "safe") bytes[ctrlOff] = SPDT_SAFE;
  else if (settings.spdtAvailable && settings.spdt === "speed") bytes[ctrlOff] = SPDT_SPEED;
  else bytes[ctrlOff] = settings.multiclick ?? DEFAULT_MULTICLICK;
}

/**
 * Handedness is derived, not flagged: the dedicated Left slot at 71-76 holds a
 * plain LEFT CLICK in right-handed mode and Left's user action in left-handed
 * mode.
 */
export function isLeftHanded(bytes: Uint8Array): boolean {
  return readAction(bytes, OFFSET.leftButtonMapping).key !== "mouse-left";
}
