import { EGG_OP1_8K_PID, EGG_USAGE, EGG_USAGE_PAGE, EGG_VENDOR_ID } from "./protocol/op1";

export function isWebHidSupported(): boolean {
  return typeof navigator !== "undefined" && "hid" in navigator && navigator.hid !== undefined;
}

export function requestOp1Device(): Promise<HIDDevice> {
  return navigator.hid.requestDevice({
    filters: [
      {
        vendorId: EGG_VENDOR_ID,
        productId: EGG_OP1_8K_PID,
        usagePage: EGG_USAGE_PAGE,
        usage: EGG_USAGE,
      },
    ],
  }).then((devices) => {
    if (devices.length === 0) throw new Error("No device selected.");
    return devices[0];
  });
}

/** Previously authorised devices (so a reconnect does not need a new prompt). */
export async function getAuthorisedOp1Devices(): Promise<HIDDevice[]> {
  if (!isWebHidSupported()) return [];
  const devices = await navigator.hid.getDevices();
  return devices.filter((d) => d.vendorId === EGG_VENDOR_ID && d.productId === EGG_OP1_8K_PID);
}

export function describeDevice(device: HIDDevice): string {
  const name = device.productName || "Endgame Gear OP1 8K";
  return `${name} (${device.vendorId.toString(16).padStart(4, "0")}:${device.productId
    .toString(16)
    .padStart(4, "0")})`;
}
