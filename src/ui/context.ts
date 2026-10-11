import type { MouseConfig } from "../protocol/codec";

export interface UiContext {
  /** The live, editable configuration. Panels mutate it in place. */
  readonly config: MouseConfig;
  isConnected(): boolean;
  /** Mark the form dirty; enables Apply. */
  markDirty(): void;
  /** Re-render all panels (e.g. after a handedness toggle). */
  requestRender(): void;
  setStatus(message: string): void;
}
