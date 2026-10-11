import {
  ACTION_OPTIONS,
  BUTTON_IDS,
  BUTTON_LABELS,
  isMappable,
  type ActionKey,
  type ButtonId,
} from "../protocol/buttons";
import { actionLabel, swapHandedness } from "../protocol/codec";
import { checkbox, el, numberInput } from "./components";
import type { UiContext } from "./context";

function actionSelect(ctx: UiContext, button: ButtonId): HTMLSelectElement {
  const settings = ctx.config.buttons[button];
  const groups = new Map<string, { value: ActionKey; label: string }[]>();
  for (const option of ACTION_OPTIONS) {
    const list = groups.get(option.group) ?? [];
    list.push({ value: option.key, label: option.label });
    groups.set(option.group, list);
  }
  if (settings.action.key === "raw") {
    groups.set("Other", [
      ...(groups.get("Other") ?? []),
      { value: "raw", label: actionLabel(settings.action) },
    ]);
  }

  const node = el("select");
  for (const [group, options] of groups) {
    const optgroup = el("optgroup", { label: group });
    for (const option of options) {
      const opt = el("option", { value: option.value }, [option.label]);
      if (option.value === settings.action.key) opt.selected = true;
      optgroup.append(opt);
    }
    node.append(optgroup);
  }
  node.addEventListener("change", () => {
    const key = node.value as ActionKey;
    settings.action = key === "fixed-cpi"
      ? { key, x: settings.action.x ?? 1600, y: settings.action.y ?? 1600 }
      : { key };
    ctx.markDirty();
    ctx.requestRender();
  });
  return node;
}

function actionDetail(ctx: UiContext, button: ButtonId): HTMLElement | null {
  const action = ctx.config.buttons[button].action;
  if (action.key === "keyboard") {
    const mods = el("div", { class: "detail" }, []);
    const masks: [number, string][] = [
      [0x01, "Ctrl"],
      [0x02, "Shift"],
      [0x04, "Alt"],
      [0x08, "Win"],
    ];
    for (const [mask, label] of masks) {
      const cb = el("input", { type: "checkbox" });
      cb.checked = ((action.modifiers ?? 0) & mask) !== 0;
      cb.addEventListener("change", () => {
        const current = action.modifiers ?? 0;
        action.modifiers = cb.checked ? current | mask : current & ~mask;
        ctx.markDirty();
      });
      mods.append(el("label", { class: "checkbox" }, [cb, el("span", {}, [label])]));
    }
    const usage = numberInput(
      action.usage ?? 0,
      (value) => {
        action.usage = value & 0xff;
        ctx.markDirty();
      },
      { min: "0", max: "255", step: "1", placeholder: "HID usage" },
    );
    mods.append(el("span", { class: "field-label" }, ["Key"]), usage);
    return mods;
  }
  if (action.key === "fixed-cpi") {
    const x = numberInput(
      action.x ?? 1600,
      (value) => {
        action.x = value;
        ctx.markDirty();
      },
      { min: "50", max: "26000", step: "50" },
    );
    const y = numberInput(
      action.y ?? 1600,
      (value) => {
        action.y = value;
        ctx.markDirty();
      },
      { min: "50", max: "26000", step: "50" },
    );
    return el("div", { class: "detail" }, [
      el("span", { class: "field-label" }, ["X"]),
      x,
      el("span", { class: "field-label" }, ["Y"]),
      y,
    ]);
  }
  return null;
}

export function renderButtons(root: HTMLElement, ctx: UiContext): void {
  const cfg = ctx.config;
  root.replaceChildren();

  const mode = el("section", { class: "card" }, [el("h2", {}, ["Handedness"])]);
  mode.append(
    checkbox("Left-handed Mode", cfg.leftHanded, () => {
      swapHandedness(cfg);
      ctx.markDirty();
      ctx.requestRender();
    }),
  );

  const mapping = el("section", { class: "card" }, [el("h2", {}, ["Button Mapping"])]);
  for (const button of BUTTON_IDS) {
    const row = el("div", { class: "button-row" }, [
      el("div", { class: "field-label" }, [BUTTON_LABELS[button]]),
    ]);
    if (isMappable(button, cfg.leftHanded)) {
      const right = el("div", {}, [actionSelect(ctx, button)]);
      const detail = actionDetail(ctx, button);
      if (detail) right.append(detail);
      row.append(right);
    } else {
      row.append(
        el("div", {}, [
          el("span", { class: "field-label" }, ["Primary click (fixed)"]),
        ]),
      );
    }
    mapping.append(row);
  }

  root.append(mode, mapping);
}
