export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) node.append(child);
  return node;
}

export interface FieldOptions {
  id?: string;
  hint?: string;
}

export function field(label: string, control: HTMLElement, options: FieldOptions = {}): HTMLElement {
  const wrapper = el("label", { class: "field" });
  if (options.id) control.id = options.id;
  wrapper.append(el("span", { class: "field-label" }, [label]), control);
  if (options.hint) wrapper.append(el("span", { class: "field-hint" }, [options.hint]));
  return wrapper;
}

export function checkbox(label: string, checked: boolean, onChange: (value: boolean) => void): HTMLElement {
  const input = el("input", { type: "checkbox" });
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  return el("label", { class: "checkbox" }, [input, el("span", {}, [label])]);
}

export function select<T extends string | number>(
  options: readonly { value: T; label: string }[],
  value: T,
  onChange: (value: T) => void,
): HTMLSelectElement {
  const node = el("select");
  for (const option of options) {
    const opt = el("option", { value: String(option.value) }, [option.label]);
    if (option.value === value) opt.selected = true;
    node.append(opt);
  }
  node.addEventListener("change", () => onChange(node.value as T));
  return node;
}

export function numberInput(
  value: number,
  onChange: (value: number) => void,
  attrs: Record<string, string> = {},
): HTMLInputElement {
  const input = el("input", { type: "number", ...attrs });
  input.value = String(value);
  input.addEventListener("change", () => onChange(Number(input.value)));
  return input;
}

export function range(
  value: number,
  min: number,
  max: number,
  onChange: (value: number) => void,
): { node: HTMLElement; input: HTMLInputElement; output: HTMLOutputElement } {
  const input = el("input", { type: "range", min: String(min), max: String(max), step: "1" });
  input.value = String(value);
  const output = el("output", {}, [String(value)]);
  input.addEventListener("input", () => {
    output.textContent = input.value;
    onChange(Number(input.value));
  });
  return { node: el("div", { class: "range" }, [input, output]), input, output };
}

export function button(label: string, onClick: () => void, attrs: Record<string, string> = {}): HTMLButtonElement {
  const node = el("button", { type: "button", ...attrs }, [label]);
  node.addEventListener("click", onClick);
  return node;
}
