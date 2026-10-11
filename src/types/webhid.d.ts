/**
 * Minimal WebHID type declarations. TypeScript's bundled `lib.dom` (5.6) does
 * not ship the Web HID API yet, so these ambient types fill the gap. Remove
 * this file once the API lands in `lib.dom`.
 */

interface HIDDeviceFilter {
  vendorId?: number;
  productId?: number;
  usagePage?: number;
  usage?: number;
  usagePageMask?: number;
  usageMask?: number;
}

interface HIDDeviceRequestOptions {
  filters: HIDDeviceFilter[];
  exclusionFilters?: HIDDeviceFilter[];
}

interface HIDInputReportEvent extends Event {
  readonly device: HIDDevice;
  readonly reportId: number;
  readonly data: DataView;
}

interface HIDConnectionEvent extends Event {
  readonly device: HIDDevice;
}

interface HIDReportInfo {
  readonly reportId: number;
  readonly items: readonly unknown[];
}

interface HIDCollectionInfo {
  readonly usagePage: number;
  readonly usage: number;
  readonly usageMinimum?: number;
  readonly usageMaximum?: number;
  readonly inputReports: readonly HIDReportInfo[];
  readonly outputReports: readonly HIDReportInfo[];
  readonly featureReports: readonly HIDReportInfo[];
  readonly children: readonly HIDCollectionInfo[];
}

interface HIDDevice extends EventTarget {
  readonly opened: boolean;
  readonly vendorId: number;
  readonly productId: number;
  readonly productName: string;
  readonly collections: readonly HIDCollectionInfo[];
  open(): Promise<void>;
  close(): Promise<void>;
  forget(): Promise<void>;
  sendReport(reportId: number, data: ArrayBufferView | ArrayBuffer): Promise<void>;
  sendFeatureReport(reportId: number, data: ArrayBufferView | ArrayBuffer): Promise<void>;
  receiveReport(reportId: number): Promise<DataView>;
  receiveFeatureReport(reportId: number): Promise<DataView>;
  addEventListener(
    type: "inputreport",
    listener: (this: HIDDevice, ev: HIDInputReportEvent) => void,
  ): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  removeEventListener(
    type: "inputreport",
    listener: (this: HIDDevice, ev: HIDInputReportEvent) => void,
  ): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
}

interface HID extends EventTarget {
  getDevices(): Promise<HIDDevice[]>;
  requestDevice(options: HIDDeviceRequestOptions): Promise<HIDDevice[]>;
}

interface Navigator {
  readonly hid: HID;
}
