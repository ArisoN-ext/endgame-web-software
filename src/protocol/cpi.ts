import {
  CPI_MAX,
  CPI_MIN,
  CPI_STAGE_COUNT_MAX,
  CPI_STAGE_STRIDE,
  OFFSET,
} from "./op1";

export interface CpiStage {
  split: boolean;
  x: number;
  y: number;
}

export function clampCpi(value: number): number {
  const clamped = Math.max(CPI_MIN, Math.min(CPI_MAX, Math.round(value)));
  const rounded = Math.floor((clamped + 50 / 2) / 50) * 50;
  return Math.max(CPI_MIN, Math.min(CPI_MAX, rounded));
}

export function isValidCpi(value: number): boolean {
  return Number.isInteger(value) && value === clampCpi(value);
}

export function readCpiStages(bytes: Uint8Array): CpiStage[] {
  const stages: CpiStage[] = [];
  for (let i = 0; i < CPI_STAGE_COUNT_MAX; i += 1) {
    const off = OFFSET.firstCpiStage + i * CPI_STAGE_STRIDE;
    stages.push({
      split: bytes[off] !== 0,
      x: bytes[off + 1] | (bytes[off + 2] << 8),
      y: bytes[off + 3] | (bytes[off + 4] << 8),
    });
  }
  return stages;
}

export function writeCpiStages(bytes: Uint8Array, stages: readonly CpiStage[]): void {
  for (let i = 0; i < CPI_STAGE_COUNT_MAX; i += 1) {
    const off = OFFSET.firstCpiStage + i * CPI_STAGE_STRIDE;
    const stage = stages[i];
    if (!stage) continue;
    const x = clampCpi(stage.x);
    const y = stage.split ? clampCpi(stage.y) : x;
    bytes[off] = x === y ? 0 : 1;
    bytes[off + 1] = x & 0xff;
    bytes[off + 2] = (x >> 8) & 0xff;
    bytes[off + 3] = y & 0xff;
    bytes[off + 4] = (y >> 8) & 0xff;
  }
}

export function readActiveStage(bytes: Uint8Array): number {
  return Math.min(Math.max(bytes[OFFSET.activeStage], 0), CPI_STAGE_COUNT_MAX - 1);
}

export function writeActiveStage(bytes: Uint8Array, stage: number): void {
  bytes[OFFSET.activeStage] = Math.min(Math.max(stage, 0), CPI_STAGE_COUNT_MAX - 1);
}

export function readCpiLevels(bytes: Uint8Array): number {
  return Math.min(Math.max(bytes[OFFSET.cpiLevels], 1), CPI_STAGE_COUNT_MAX);
}

export function writeCpiLevels(bytes: Uint8Array, levels: number): void {
  bytes[OFFSET.cpiLevels] = Math.min(Math.max(levels, 1), CPI_STAGE_COUNT_MAX);
}
