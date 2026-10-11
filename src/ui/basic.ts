import { clampCpi } from "../protocol/cpi";
import { CPI_MAX, CPI_MIN, CPI_STEP, STAGE_COLORS, lodOptions } from "../protocol/op1";
import { button, checkbox, el, field, numberInput, select } from "./components";
import type { UiContext } from "./context";

export function renderBasic(root: HTMLElement, ctx: UiContext): void {
  const cfg = ctx.config;
  root.replaceChildren();

  const sensor = el("section", { class: "card" }, [el("h2", {}, ["Sensor"])]);
  const lod = lodOptions(cfg.glassMode);
  const lodIndex = Math.min(cfg.lodIndex, lod.length - 1);
  sensor.append(
    field(
      "Lift-off distance",
      select(
        lod.map((label, value) => ({ value, label })),
        lodIndex,
        (value) => {
          cfg.lodIndex = value;
          ctx.markDirty();
        },
      ),
      cfg.glassMode ? { hint: "Glass Mode is on: 0.7 mm is unavailable." } : {},
    ),
    checkbox("Angle Snapping", cfg.angleSnapping, (value) => {
      cfg.angleSnapping = value;
      ctx.markDirty();
    }),
    checkbox("Ripple Control", cfg.rippleControl, (value) => {
      cfg.rippleControl = value;
      ctx.markDirty();
    }),
    field(
      "Surface Calibration",
      (() => {
        const calibrate = button("Calibrate", () =>
          ctx.setStatus("Surface calibration is enabled only in Glass Mode; its device command is not implemented yet."),
        );
        calibrate.disabled = !cfg.glassMode || !ctx.isConnected();
        return calibrate;
      })(),
      { hint: "Active only with Glass Mode (Advanced tab), as in the vendor tool." },
    ),
  );

  const cpi = el("section", { class: "card" }, [el("h2", {}, ["CPI Levels"])]);
  cpi.append(
    field(
      "Active levels",
      select(
        [1, 2, 3, 4].map((value) => ({ value, label: String(value) })),
        cfg.cpiLevels,
        (value) => {
          cfg.cpiLevels = value;
          ctx.markDirty();
        },
      ),
    ),
  );

  const grid = el("div", { class: "cpi-grid" });
  for (const heading of ["LED", "Stage", "X (CPI)", "Y (CPI)", "X/Y"]) {
    grid.append(el("div", { class: "head" }, [heading]));
  }

  for (let i = 0; i < cfg.stages.length; i += 1) {
    const stage = cfg.stages[i];

    // The vendor tool exposes no active-stage control and the wired firmware
    // ignores host writes to byte 29, so show it read-only. The colour is the
    // stage's fixed firmware colour (CPI 1-4 = blue/green/yellow/red).
    const active = cfg.activeStage === i;
    const swatch = el("span", { class: `stage-swatch${active ? " active" : ""}` });
    swatch.style.background = STAGE_COLORS[i] ?? "transparent";
    swatch.title = active ? "Active stage" : "";

    const xInput = numberInput(
      stage.x,
      (value) => {
        stage.x = clampCpi(value);
        if (!stage.split) stage.y = stage.x;
        ctx.markDirty();
        ctx.requestRender();
      },
      { min: String(CPI_MIN), max: String(CPI_MAX), step: String(CPI_STEP) },
    );

    const yInput = numberInput(
      stage.y,
      (value) => {
        stage.y = clampCpi(value);
        ctx.markDirty();
      },
      { min: String(CPI_MIN), max: String(CPI_MAX), step: String(CPI_STEP) },
    );
    yInput.disabled = !stage.split;

    const split = el("input", { type: "checkbox" });
    split.checked = stage.split;
    split.addEventListener("change", () => {
      stage.split = split.checked;
      if (!stage.split) stage.y = stage.x;
      ctx.markDirty();
      ctx.requestRender();
    });

    grid.append(
      el("div", { class: "stage-active" }, [swatch]),
      el("div", {}, [`CPI ${i + 1}`]),
      xInput,
      yInput,
      el("div", {}, [split]),
    );
  }
  cpi.append(grid);

  root.append(sensor, cpi);
}
