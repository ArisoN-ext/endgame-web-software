# Endgame Gear OP1 8K — Web Configuration Tool

A from-scratch, browser-based configuration tool for the **Endgame Gear OP1 8K**
(wired) gaming mouse, built on the **WebHID API**. It is a reimplementation of the
vendor's Windows utility `Endgame_Gear_OP1_8k_Configuration_Tool_V1.12.exe` and
talks directly to the mouse — no drivers, no install, no network.

The wire protocol was reverse-engineered from the shipped binary and validated on
real hardware (read, decode, write and persistence).

## Features

- **Basic settings** — lift-off distance (LOD), CPI levels 1–4 with per-stage X/Y
  split, active-stage indicator with the firmware's fixed stage colours, angle
  snapping, ripple control, surface calibration (Glass Mode only).
- **Advanced settings** — polling rate (1000/2000/4000/8000 Hz), motion sync,
  Glass Mode, slamclick filter, motion-jitter filter, per-button multiclick
  filters and SPDT mode (Off / GX Speed / GX Safe).
- **Button mapping** — left-handed mode plus remapping of the six non-primary
  buttons (mouse buttons, scroll, keyboard shortcut, CPI loop, fixed CPI, media
  keys, browser/explorer, disabled).
- **Device info** — firmware version, factory reset, and a live event channel
  (polling-rate changes).
- **Read-modify-write** — reserved bytes, LED-colour records and unknown bytes are
  preserved on every write.

## Requirements

- A **Chromium-based browser** (Chrome or Edge). Firefox and Safari do not
  implement WebHID.
- A **secure context** — `https://` or `http://localhost`.
- The device must be granted through the browser's device chooser, which requires
  a user gesture (the **Connect** button).

### Linux permissions

WebHID opens the device's `hidraw` node as your user, which is often root-only.
Grant access to the vendor interface (`usagePage 0xFF01`):

```bash
# persistent: install the udev rule
sudo cp udev/70-endgame-op1.rules /etc/udev/rules.d/
sudo udevadm control --reload-rules && sudo udevadm trigger
```

Then fully restart the browser so its HID service picks up the change.

## Quick start

Node/npm are used through `nix` in this project; any Node 18+ works too.

```bash
nix shell nixpkgs#nodejs_22 --command npm install
nix shell nixpkgs#nodejs_22 --command npm run dev     # http://localhost:5173
```

Other scripts:

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest run
npm run build       # typecheck + vite build -> dist/
npm run preview     # serve the production build
```

## Usage

1. Open the app (`http://localhost:5173` during development).
2. Click **Connect** and pick *Endgame Gear OP1 8k Gaming Mouse* in the chooser.
3. Adjust settings; **Apply** writes the configuration to the mouse.
4. **Factory Reset** restores the device defaults.

A debug hook is exposed for protocol work — in the browser console:

```js
op1Debug.dump()    // last raw 1041-byte report
op1Debug.config    // decoded configuration
```

## GitHub Pages

The build is static and uses relative asset paths (`base: "./"` in
`vite.config.ts`), so the same `dist/` works at a domain root or a project
subpath. Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds
and publishes to GitHub Pages.

## Protocol

Target device: **VID `0x3367`**, **PID `0x1964`**, vendor HID collection with
**usage page `0xFF01` / usage `0x02`**.

| Report | Kind | Size | Purpose |
|---|---|---|---|
| `0xA0` | feature | 1041 B | full configuration blob (1024-byte payload at offset 16) |
| `0xA1` | feature | 64 B | command / status / firmware |
| `0x03` | input | 8 B | live events (polling-rate changes) |

Opcodes (byte 1): store `0x11`, load `0x12`, factory reset `0x13`,
firmware `0x02`; status byte `0x01` = OK, `0x03` = busy. All field offsets live
in [`src/protocol/op1.ts`](src/protocol/op1.ts).

The layout was cross-checked against independent community reverse engineering
(`OpenMouse-Project/mouse-protocol`, `johanneszab/endgame-op1w`).

## Project structure

```
src/
  protocol/    pure codecs (no DOM): op1.ts, codec.ts, buttons.ts, cpi.ts,
               events.ts, version.ts
  transport.ts WebHID feature-report I/O, retries, event channel
  webhid.ts    device discovery / requestDevice filters
  ui/          panel builders (basic, advanced, buttons)
  types/       ambient WebHID type declarations
test/          Vitest codec round-trip tests
udev/          Linux permission rule
```

## Disclaimer

Not affiliated with Endgame Gear. Use at your own risk; settings are written
directly to the device. Only documented, safe settings are exposed — firmware
flashing and bootloader access are out of scope.
