import { EVENT_REPORT_SIZE, REPORT_EVENT } from "./op1";

/**
 * Input-report event codes on report 0x03.
 *
 * The v1.12 OP1 8K tool dispatches exactly two codes (verified: reader thread
 * at 0x411300, dispatcher at 0x412010): 0x06 = polling rate changed (value is
 * the divider, 8000/Hz) and 0xB4 = a numeric telemetry read-out it only logs.
 * The v2-family tool additionally handles 0x02 (active CPI stage); the wired V1
 * build does not, but we still accept it defensively so a stage push is
 * reflected if the firmware ever sends one.
 */
export const EVENT_ACTIVE_STAGE = 0x02;
export const EVENT_POLLING_CHANGED = 0x06;
export const EVENT_TELEMETRY = 0xb4;

export interface StageChangedEvent {
  type: "stage";
  stage: number;
}
export interface PollingChangedEvent {
  type: "polling";
  divider: number;
}
export type MouseEvent = StageChangedEvent | PollingChangedEvent;

export function parseEventReport(report: Uint8Array): MouseEvent | null {
  if (report.length < EVENT_REPORT_SIZE || report[0] !== REPORT_EVENT) return null;
  const code = report[1];
  const value = report[2];
  if (code === EVENT_ACTIVE_STAGE) return { type: "stage", stage: value };
  if (code === EVENT_POLLING_CHANGED) return { type: "polling", divider: value };
  return null;
}
