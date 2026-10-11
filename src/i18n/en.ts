export const en = {
  connect: "Connect",
  disconnect: "Disconnect",
  noDevice: "No device",
  apply: "Apply",
  factoryReset: "Factory Reset",
  basic: "Basic Settings",
  advanced: "Advanced Settings",
  buttons: "Button Mapping",
  status: {
    disconnected: "Disconnected",
    connected: "Connected",
    connecting: "Connecting…",
    reading: "Reading configuration…",
    writing: "Applying configuration…",
    applied: "Configuration applied",
    reset: "Factory reset requested",
    dirty: "Unsaved changes",
    error: "Error",
  },
} as const;

export function t<K extends keyof typeof en>(key: K): (typeof en)[K] {
  return en[key];
}
