import { describe, expect, it } from "vitest";
import { decodeConfig, encodeConfig, swapHandedness } from "../src/protocol/codec";
import { decodeAction, encodeAction, isLeftHanded, readAction, writeAction } from "../src/protocol/buttons";
import { clampCpi } from "../src/protocol/cpi";
import { CONFIG_REPORT_SIZE, OFFSET, REPORT_CONFIG } from "../src/protocol/op1";

function blankReport(): Uint8Array {
  const report = new Uint8Array(CONFIG_REPORT_SIZE);
  report[0] = REPORT_CONFIG;
  report[1] = 0x01;
  // Sane factory-ish defaults.
  report[OFFSET.pollingDivider] = 8;
  report[OFFSET.lod] = 1;
  report[OFFSET.cpiLevels] = 4;
  report[OFFSET.activeStage] = 0;
  // Stage 1 = 1600 CPI, split off.
  report[OFFSET.firstCpiStage + 1] = 1600 & 0xff;
  report[OFFSET.firstCpiStage + 2] = 1600 >> 8;
  report[OFFSET.firstCpiStage + 3] = 1600 & 0xff;
  report[OFFSET.firstCpiStage + 4] = 1600 >> 8;
  // Plain LEFT CLICK in the handedness slot (right-handed).
  report[OFFSET.leftButtonMapping] = 0x00;
  report[OFFSET.leftButtonMapping + 1] = 0x01;
  // Record 0 mapping = Right Click.
  report[OFFSET.firstButton + 1] = 0x00;
  report[OFFSET.firstButton + 2] = 0x02;
  return report;
}

describe("codec roundtrip", () => {
  it("preserves unknown bytes on encode", () => {
    const base = blankReport();
    base[OFFSET.stageColors] = 0xde;
    base[OFFSET.stageColors + 1] = 0xad;
    base[OFFSET.preserveByte] = 0x42;
    const config = decodeConfig(base);
    const encoded = encodeConfig(base, config);
    expect(encoded[OFFSET.stageColors]).toBe(0xde);
    expect(encoded[OFFSET.stageColors + 1]).toBe(0xad);
    expect(encoded[OFFSET.preserveByte]).toBe(0x42);
  });

  it("roundtrips decoded settings", () => {
    const base = blankReport();
    const config = decodeConfig(base);
    config.polling = 4000;
    config.slamclick = true;
    config.motionJitter = true;
    config.motionSync = true;
    config.angleSnapping = true;
    config.glassMode = true;
    config.lodIndex = 1;
    config.cpiLevels = 2;
    config.stages[0] = { split: true, x: 800, y: 1600 };
    const encoded = encodeConfig(base, config);
    const decoded = decodeConfig(encoded);
    expect(decoded.polling).toBe(4000);
    expect(decoded.slamclick).toBe(true);
    expect(decoded.motionJitter).toBe(true);
    expect(decoded.motionSync).toBe(true);
    expect(decoded.angleSnapping).toBe(true);
    expect(decoded.glassMode).toBe(true);
    expect(decoded.lodIndex).toBe(1);
    expect(decoded.cpiLevels).toBe(2);
    expect(decoded.stages[0]).toEqual({ split: true, x: 800, y: 1600 });
  });

  it("keeps X and Y equal when split is off", () => {
    const base = blankReport();
    const config = decodeConfig(base);
    config.stages[1] = { split: false, x: 1200, y: 9999 };
    const decoded = decodeConfig(encodeConfig(base, config));
    expect(decoded.stages[1]).toEqual({ split: false, x: 1200, y: 1200 });
  });

  it("swaps the two main buttons on a handedness toggle", () => {
    const base = blankReport();
    const config = decodeConfig(base);
    expect(config.leftHanded).toBe(false);
    expect(config.buttons.left.action.key).toBe("mouse-left");
    expect(config.buttons.right.action.key).toBe("mouse-right");

    swapHandedness(config);
    expect(config.leftHanded).toBe(true);
    expect(config.buttons.left.action.key).toBe("mouse-right");
    expect(config.buttons.right.action.key).toBe("mouse-left");

    const decoded = decodeConfig(encodeConfig(base, config));
    expect(decoded.leftHanded).toBe(true);
    expect(decoded.buttons.left.action.key).toBe("mouse-right");
    expect(decoded.buttons.right.action.key).toBe("mouse-left");
  });
});

describe("CPI clamping", () => {
  it("clamps to the OP1 8K range and 50-step", () => {
    expect(clampCpi(10)).toBe(50);
    expect(clampCpi(1600)).toBe(1600);
    expect(clampCpi(1601)).toBe(1600);
    expect(clampCpi(30000)).toBe(26000);
  });
});

describe("button actions", () => {
  it("roundtrips every action option", () => {
    const cases = [
      { key: "mouse-left" as const },
      { key: "scroll-down" as const },
      { key: "keyboard" as const, modifiers: 0x01, usage: 0x06 },
      { key: "fixed-cpi" as const, x: 800, y: 1200 },
      { key: "media-volume-up" as const },
      { key: "browser-home" as const },
      { key: "disabled" as const },
    ];
    for (const action of cases) {
      const { type, params } = encodeAction(action);
      expect(decodeAction(type, params)).toEqual(action);
    }
  });

  it("reads a plain LEFT CLICK slot as right-handed", () => {
    const base = blankReport();
    expect(isLeftHanded(base)).toBe(false);
    const slot = OFFSET.leftButtonMapping;
    writeAction(base, slot, { key: "mouse-right" });
    expect(isLeftHanded(base)).toBe(true);
    expect(readAction(base, slot).key).toBe("mouse-right");
  });
});
