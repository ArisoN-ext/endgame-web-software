import { BUTTON_LABELS, type ButtonId } from "../protocol/buttons";
import { POLLING_RATES } from "../protocol/op1";
import { checkbox, el, field, range, select } from "./components";
import type { UiContext } from "./context";

const FILTER_BUTTONS: ButtonId[] = ["left", "right", "middle", "forward", "back"];

export function renderAdvanced(root: HTMLElement, ctx: UiContext): void {
  const cfg = ctx.config;
  root.replaceChildren();

  const performance = el("section", { class: "card" }, [el("h2", {}, ["Performance"])]);
  // Motion Sync cannot run at 8000 Hz (sensor limitation); the vendor tool drops
  // the 8000 Hz option while it is enabled.
  const pollingRates = cfg.motionSync ? POLLING_RATES.filter((rate) => rate !== 8000) : POLLING_RATES;
  performance.append(
    checkbox("Motion Sync", cfg.motionSync, (value) => {
      cfg.motionSync = value;
      if (value && cfg.polling === 8000) cfg.polling = 4000;
      ctx.markDirty();
      ctx.requestRender();
    }),
    checkbox("Glass Mode", cfg.glassMode, (value) => {
      cfg.glassMode = value;
      if (value && cfg.lodIndex > 1) cfg.lodIndex = 1;
      ctx.markDirty();
      ctx.requestRender();
    }),
    field(
      "Polling Rate",
      select(
        pollingRates.map((rate) => ({ value: rate, label: `${rate} Hz` })),
        cfg.polling,
        (value) => {
          cfg.polling = value;
          ctx.markDirty();
        },
      ),
      cfg.motionSync ? { hint: "Motion Sync is on: 8000 Hz is unavailable." } : {},
    ),
  );

  const filters = el("section", { class: "card" }, [el("h2", {}, ["Filters"])]);
  filters.append(
    checkbox("Slamclick Filter", cfg.slamclick, (value) => {
      cfg.slamclick = value;
      ctx.markDirty();
    }),
    checkbox("Motion Jitter Filter", cfg.motionJitter, (value) => {
      cfg.motionJitter = value;
      ctx.markDirty();
    }),
  );

  const buttons = el("section", { class: "card" }, [el("h2", {}, ["Button Filters"])]);
  for (const id of FILTER_BUTTONS) {
    const settings = cfg.buttons[id];
    const row = el("div", { class: "button-row" }, [el("div", { class: "field-label" }, [BUTTON_LABELS[id]])]);

    const slider = range(settings.multiclick ?? 8, 0, 25, (value) => {
      settings.multiclick = value;
      ctx.markDirty();
    });
    slider.input.disabled = settings.spdt !== "off";

    const spdt = select(
      [
        { value: "off", label: "Off" },
        { value: "speed", label: "GX Speed Mode" },
        { value: "safe", label: "GX Safe Mode" },
      ],
      settings.spdt,
      (value) => {
        settings.spdt = value;
        ctx.markDirty();
        ctx.requestRender();
      },
    );

    row.append(
      el("div", { class: "detail" }, [
        el("span", { class: "field-label" }, ["Multiclick"]),
        slider.node,
        el("span", { class: "field-label" }, ["SPDT"]),
        spdt,
      ]),
    );
    buttons.append(row);
  }

  root.append(performance, filters, buttons);
}
