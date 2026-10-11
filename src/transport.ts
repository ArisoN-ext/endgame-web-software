import { parseEventReport, type MouseEvent } from "./protocol/events";
import {
  COMMAND_REPORT_SIZE,
  CONFIG_REPORT_SIZE,
  OP_FACTORY_RESET,
  OP_FIRMWARE,
  OP_LOAD,
  OP_STORE,
  REPORT_COMMAND,
  REPORT_CONFIG,
  REPORT_EVENT,
  STATUS_OK,
} from "./protocol/op1";
import { formatFirmwareVersion } from "./protocol/version";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const RETRY_ATTEMPTS = 4;
const RETRY_DELAY_MS = 50;
const READ_SETTLE_MS = 80;
const WRITE_SETTLE_MS = 300;
const RESET_SETTLE_MS = 1100;
const FIRMWARE_SETTLE_MS = 50;

/**
 * Normalise a feature-report reply into a fixed-size buffer whose byte 0 is the
 * report ID. Different OS/descriptor shapes return the reply with or without
 * the echoed report ID, and some expose the full 1040-byte payload, so the
 * framing byte is detected instead of assumed.
 */
function normaliseReport(raw: Uint8Array, reportId: number, size: number): Uint8Array {
  const out = new Uint8Array(size);
  const looksFramed =
    raw.length > 0 && (raw[0] === reportId || raw[0] === 0 || raw[0] === REPORT_CONFIG || raw[0] === REPORT_COMMAND);
  if (looksFramed) out.set(raw.subarray(0, size));
  else {
    out[0] = reportId;
    out.set(raw.subarray(0, size - 1), 1);
  }
  return out;
}

function commandBuffer(opcode: number): Uint8Array {
  const cmd = new Uint8Array(COMMAND_REPORT_SIZE);
  cmd[0] = REPORT_COMMAND;
  cmd[1] = opcode;
  return cmd;
}

export class Op1Transport {
  private readonly listeners = new Set<(event: MouseEvent) => void>();
  private readonly onInputReport = (event: HIDInputReportEvent): void => {
    if (event.reportId !== REPORT_EVENT) return;
    const report = new Uint8Array(event.data.byteLength + 1);
    report[0] = REPORT_EVENT;
    report.set(new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength), 1);
    const parsed = parseEventReport(report);
    if (parsed) for (const listener of this.listeners) listener(parsed);
  };

  constructor(readonly device: HIDDevice) {}

  async open(): Promise<void> {
    if (!this.device.opened) await this.device.open();
    this.device.addEventListener("inputreport", this.onInputReport);
  }

  async close(): Promise<void> {
    this.device.removeEventListener("inputreport", this.onInputReport);
    if (this.device.opened) await this.device.close();
  }

  onEvent(listener: (event: MouseEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * WebHID's `sendFeatureReport(reportId, data)` takes the report ID separately
   * and expects `data` WITHOUT it (unlike hidapi, where the ID is buffer byte 0).
   * Our buffers keep the hidapi layout, so strip byte 0 here.
   */
  private async sendFeature(buffer: Uint8Array): Promise<void> {
    await this.device.sendFeatureReport(buffer[0], buffer.slice(1));
  }

  /** Load and return the full 1041-byte configuration report. */
  async readConfig(): Promise<Uint8Array> {
    await this.sendFeature(commandBuffer(OP_LOAD));
    await sleep(READ_SETTLE_MS);

    // The stock path reads 0xA0, but some OS/descriptor combinations answer the
    // full blob on 0xA1, so fall back to it when the first read is empty or not OK.
    const attempts: number[] = [REPORT_CONFIG, REPORT_COMMAND];
    let lastError: unknown;
    for (const reportId of attempts) {
      try {
        const view = await this.device.receiveFeatureReport(reportId);
        const raw = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
        const config = normaliseReport(raw, reportId, CONFIG_REPORT_SIZE);
        if (config[1] === STATUS_OK) return config;
        lastError = new Error(
          `status 0x${config[1].toString(16)} (report 0x${reportId.toString(16)}, ${raw.length} B)`,
        );
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error(`Device did not return a valid config blob: ${String(lastError)}`);
  }

  /** Commit a full 1041-byte configuration report. */
  async storeConfig(config: Uint8Array): Promise<void> {
    if (config.length !== CONFIG_REPORT_SIZE) {
      throw new Error(`Config report must be ${CONFIG_REPORT_SIZE} bytes, got ${config.length}.`);
    }
    const buffer = config.slice();
    buffer[0] = REPORT_CONFIG;
    buffer[1] = OP_STORE;
    await this.sendFeature(buffer);
    await sleep(WRITE_SETTLE_MS);
  }

  async factoryReset(): Promise<void> {
    await this.sendFeature(commandBuffer(OP_FACTORY_RESET));
    await sleep(RESET_SETTLE_MS);
  }

  async readFirmwareVersion(): Promise<string | null> {
    await this.sendFeature(commandBuffer(OP_FIRMWARE));
    await sleep(FIRMWARE_SETTLE_MS);
    const view = await this.device.receiveFeatureReport(REPORT_COMMAND);
    const reply = normaliseReport(
      new Uint8Array(view.buffer, view.byteOffset, view.byteLength),
      REPORT_COMMAND,
      COMMAND_REPORT_SIZE,
    );
    return formatFirmwareVersion(reply);
  }

  /** Run `action` with the vendor tool's small retry budget. */
  async withRetries<T>(action: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt += 1) {
      try {
        return await action();
      } catch (error) {
        lastError = error;
        await sleep(RETRY_DELAY_MS);
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
}
