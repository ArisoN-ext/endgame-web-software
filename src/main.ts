import { en } from "./i18n/en";
import { decodeConfig, encodeConfig, sanitizeConfig, type MouseConfig } from "./protocol/codec";
import type { MouseEvent } from "./protocol/events";
import { Op1Transport } from "./transport";
import { describeDevice, getAuthorisedOp1Devices, isWebHidSupported, requestOp1Device } from "./webhid";
import { renderAdvanced } from "./ui/advanced";
import { renderBasic } from "./ui/basic";
import { renderButtons } from "./ui/buttons";
import type { UiContext } from "./ui/context";

const SOFTWARE_VERSION = "V1.12 (web)";

type TabId = "basic" | "advanced" | "buttons";

const $ = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node as T;
};

const connectButton = $<HTMLButtonElement>("connect");
const applyButton = $<HTMLButtonElement>("apply");
const resetButton = $<HTMLButtonElement>("factory-reset");
const deviceName = $<HTMLSpanElement>("device-name");
const fwBadge = $<HTMLSpanElement>("fw-version");
const swBadge = $<HTMLSpanElement>("sw-version");
const status = $<HTMLSpanElement>("status");
const unsupported = $<HTMLDivElement>("unsupported");
const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>(".tab"));
const panels: Record<TabId, HTMLElement> = {
  basic: document.querySelector<HTMLElement>('[data-panel="basic"]')!,
  advanced: document.querySelector<HTMLElement>('[data-panel="advanced"]')!,
  buttons: document.querySelector<HTMLElement>('[data-panel="buttons"]')!,
};

let transport: Op1Transport | null = null;
let baseBuffer: Uint8Array | null = null;
let config: MouseConfig | null = null;
let activeTab: TabId = "basic";
let unsubscribe: (() => void) | null = null;

function setStatus(message: string, isError = false): void {
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function setDirty(value: boolean): void {
  applyButton.disabled = !transport || !value;
  if (value) setStatus(en.status.dirty);
}

const ctx: UiContext = {
  get config() {
    if (!config) throw new Error("Not connected");
    return config;
  },
  isConnected: () => transport !== null && config !== null,
  markDirty: () => setDirty(true),
  requestRender: () => renderActive(),
  setStatus: (message) => setStatus(message),
};

function renderActive(): void {
  const panel = panels[activeTab];
  if (!config) {
    panel.replaceChildren(
      Object.assign(document.createElement("p"), {
        textContent: "Connect an Endgame Gear OP1 8K to configure it.",
      }),
    );
    return;
  }
  if (activeTab === "basic") renderBasic(panel, ctx);
  else if (activeTab === "advanced") renderAdvanced(panel, ctx);
  else renderButtons(panel, ctx);
}

function selectTab(tab: TabId): void {
  activeTab = tab;
  for (const button of tabs) {
    button.setAttribute("aria-selected", String(button.dataset.tab === tab));
  }
  for (const [id, panel] of Object.entries(panels)) panel.hidden = id !== tab;
  renderActive();
}

function handleEvent(event: MouseEvent): void {
  if (!config) return;
  if (event.type === "stage") {
    config.activeStage = event.stage;
    if (activeTab === "basic") renderActive();
  } else if (event.type === "polling") {
    const rate = [1000, 2000, 4000, 8000].find((hz) => 8000 / hz === event.divider);
    if (rate) {
      config.polling = rate as MouseConfig["polling"];
      if (activeTab === "advanced") renderActive();
    }
  }
}

async function connect(): Promise<void> {
  try {
    setStatus(en.status.connecting);
    const device = await requestOp1Device();
    console.info("[op1] selected device", {
      name: device.productName,
      vendorId: device.vendorId,
      productId: device.productId,
      collections: device.collections.map((collection) => ({
        usagePage: collection.usagePage,
        usage: collection.usage,
        featureReports: collection.featureReports.map((r) => r.reportId),
        inputReports: collection.inputReports.map((r) => r.reportId),
      })),
    });
    deviceName.textContent = describeDevice(device);

    const next = new Op1Transport(device);
    try {
      await next.open();
    } catch (error) {
      throw new Error(`Could not open the device: ${describeError(error)}`);
    }
    transport = next;

    setStatus(en.status.reading);
    try {
      baseBuffer = await next.readConfig();
    } catch (error) {
      throw new Error(`Config read failed: ${describeError(error)}`);
    }
    config = decodeConfig(baseBuffer);
    const fixed = sanitizeConfig(config);
    unsubscribe = next.onEvent(handleEvent);

    console.info("[op1] decoded config", summarizeConfig(config));
    console.info("[op1] payload 0x10..0x82", hexRange(baseBuffer, 0x10, 0x82));

    swBadge.textContent = `Software ${SOFTWARE_VERSION}`;
    swBadge.hidden = false;
    try {
      const firmware = await next.readFirmwareVersion();
      if (firmware) {
        fwBadge.textContent = `Firmware ${firmware}`;
        fwBadge.hidden = false;
      }
    } catch {
      /* firmware read is best-effort */
    }

    connectButton.textContent = en.disconnect;
    resetButton.disabled = false;
    setDirty(fixed);
    setStatus(fixed ? en.status.dirty : en.status.connected);
    renderActive();
  } catch (error) {
    console.error("[op1] connect failed", error);
    await resetConnection();
    setStatus(`Connect failed: ${describeError(error)}`, true);
  }
}

/** Clear device state without clobbering the status line or device label. */
async function resetConnection(): Promise<void> {
  unsubscribe?.();
  unsubscribe = null;
  if (transport) await transport.close().catch(() => undefined);
  transport = null;
  baseBuffer = null;
  config = null;
  connectButton.textContent = en.connect;
  applyButton.disabled = true;
  resetButton.disabled = true;
  renderActive();
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function hexRange(bytes: Uint8Array, start: number, end: number): string {
  const parts: string[] = [];
  for (let i = start; i < end && i < bytes.length; i += 1) {
    parts.push(bytes[i].toString(16).padStart(2, "0"));
  }
  return parts.join(" ");
}

function summarizeConfig(cfg: MouseConfig): Record<string, unknown> {
  return {
    polling: cfg.polling,
    lodIndex: cfg.lodIndex,
    cpiLevels: cfg.cpiLevels,
    activeStage: cfg.activeStage,
    stages: cfg.stages,
    angleSnapping: cfg.angleSnapping,
    rippleControl: cfg.rippleControl,
    motionSync: cfg.motionSync,
    slamclick: cfg.slamclick,
    motionJitter: cfg.motionJitter,
    glassMode: cfg.glassMode,
    leftHanded: cfg.leftHanded,
    buttons: Object.fromEntries(
      Object.entries(cfg.buttons).map(([id, settings]) => [
        id,
        { action: settings.action, multiclick: settings.multiclick, spdt: settings.spdt },
      ]),
    ),
  };
}

async function disconnect(): Promise<void> {
  await resetConnection();
  deviceName.textContent = en.noDevice;
  fwBadge.hidden = true;
  swBadge.hidden = true;
  setStatus(en.status.disconnected);
}

async function apply(): Promise<void> {
  if (!transport || !config || !baseBuffer) return;
  try {
    setStatus(en.status.writing);
    const report = encodeConfig(baseBuffer, config);
    const diff: string[] = [];
    for (let i = 0; i < report.length; i += 1) {
      if (report[i] !== baseBuffer[i]) {
        diff.push(`0x${i.toString(16)}:${baseBuffer[i].toString(16)}->${report[i].toString(16)}`);
      }
    }
    console.info("[op1] store diff", diff.join(" ") || "(none)");
    await transport.storeConfig(report);
    // Re-read so the UI reflects any clamping/normalisation the firmware applied.
    baseBuffer = await transport.readConfig();
    config = decodeConfig(baseBuffer);
    console.info("[op1] after store", summarizeConfig(config));
    setDirty(sanitizeConfig(config));
    renderActive();
    setStatus(en.status.applied);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), true);
  }
}

async function factoryReset(): Promise<void> {
  if (!transport) return;
  try {
    setStatus(en.status.reset);
    await transport.factoryReset();
    baseBuffer = await transport.readConfig();
    config = decodeConfig(baseBuffer);
    setDirty(sanitizeConfig(config));
    renderActive();
    setStatus(en.status.applied);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), true);
  }
}

connectButton.addEventListener("click", () => {
  if (transport) void disconnect();
  else void connect();
});
applyButton.addEventListener("click", () => void apply());
resetButton.addEventListener("click", () => void factoryReset());
for (const button of tabs) {
  button.addEventListener("click", () => selectTab(button.dataset.tab as TabId));
}

if (!isWebHidSupported()) {
  unsupported.hidden = false;
  connectButton.disabled = true;
} else {
  void getAuthorisedOp1Devices().then((devices) => {
    if (devices.length > 0) deviceName.textContent = `${describeDevice(devices[0])} (authorised)`;
  });
  navigator.hid.addEventListener("disconnect", (event) => {
    if (transport && (event as HIDConnectionEvent).device === transport.device) void disconnect();
  });
}

selectTab("basic");
setStatus(en.status.disconnected);

// Small verification hook: in the browser console, `op1Debug.dump()` returns the
// last raw 1041-byte report and `op1Debug.config` the decoded view. Handy when
// diffing against a capture from the vendor tool.
Object.defineProperty(window, "op1Debug", {
  value: {
    dump: (): number[] | null => (baseBuffer ? Array.from(baseBuffer) : null),
    get config(): MouseConfig | null {
      return config;
    },
  },
});
