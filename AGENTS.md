# AGENTS.md

WebHID configuration tool for the **Endgame Gear OP1 8K** (wired, `0x1964`), a
from-scratch reimplementation of the vendor's Windows tool
`Endgame_Gear_OP1_8k_Configuration_Tool_V1.12.exe` (kept in the repo root as the
reference binary). Vanilla TypeScript + Vite, no framework, deployable to GitHub
Pages.

## Commands

Node/npm are **not** on the system PATH; run everything through nix:

```bash
nix shell nixpkgs#nodejs_22 --command npm install
nix shell nixpkgs#nodejs_22 --command npm run dev        # Vite dev server
nix shell nixpkgs#nodejs_22 --command npm run typecheck  # tsc --noEmit
nix shell nixpkgs#nodejs_22 --command npm test           # vitest run
nix shell nixpkgs#nodejs_22 --command npm run build      # typecheck + vite build
```

- `npm run build` = `tsc --noEmit && vite build`; run `typecheck` first when iterating.
- Single test: `npx vitest run test/<file>.test.ts`.
- Vitest exits 1 when no test files exist, so keep at least one in `test/`.

## Layout

- `src/protocol/` — pure codecs, no DOM: `op1.ts` (wire constants), `codec.ts`
  (`MouseConfig` <-> 1041-byte report), `buttons.ts`, `cpi.ts`, `events.ts`, `version.ts`.
- `src/transport.ts` — `Op1Transport`: WebHID feature-report I/O, retries, event channel.
- `src/webhid.ts` — device discovery / `requestDevice` filters.
- `src/ui/` — panel builders; `context.ts` is the interface panels get.
- `src/types/webhid.d.ts` — ambient WebHID types (see gotchas).

## Protocol invariants (easy to get wrong)

Target: VID `0x3367`, PID `0x1964`, vendor collection `usagePage 0xFF01` / `usage 0x02`.
Feature reports: `0xA0` = 1041-byte config blob (1024-byte payload at offset 16),
`0xA1` = 64-byte command/status; `0x03` = 8-byte input events.
Opcodes (byte 1): store `0x11`, load `0x12`, factory reset `0x13`, firmware `0x02`;
status byte `0x01` = OK, `0x03` = busy. All offsets/encodings live in
`src/protocol/op1.ts` — read them there, do not guess.

- **Read-modify-write is mandatory.** `encodeConfig()` must start from the last
  read report so reserved bytes, stage-colour records (offsets 31-50) and unknown
  bytes are preserved.
- **This mouse has no lighting.** Do not add LED UI. LED-colour bytes are preserve-only.
- Handedness is derived from the Left slot at 71-76 (plain `mouse-left` = right-handed).
  Never zero that slot — it kills the left button.
- Version strings are BCD patch/major bytes, not `raw/100`.
- **Glass Mode exists in this build** (offset 127, checkbox in Advanced). When on,
  the LOD list drops to `1 mm` / `2 mm` and Surface Calibration becomes enabled.
  The community docs claim the OP1 8K V1 lacks it — the v1.12 binary disagrees.

## Verified against the reference binary

Static analysis of the shipped exe (Ghidra-class disassembly) confirms, and any
protocol change should be re-checked against these:

- Device selection: `HidD_GetAttributes` VID `0x3367` / PID `0x1964`, then the
  collection with `usagePage 0xFF01` / `usage 0x02` (`0x40421d`, `0x40422b`).
- Read: command `A1 12` (64 B) → `Sleep(80)` → `GetFeature(0xA0)` 1041 B, status at
  byte 1, 1024-byte payload at offset 16 (`0x4045e9`).
- Write: serialize 1024 B → report `A0 11` (1041 B) → `SetFeature` → `Sleep` → read
  status via `GetFeature(0xA1)` (`0x404c68`).
- Factory reset: `A1 13`, `Sleep(1100)` (`0x412743`).
- Retries: 4 attempts, `GetLastError` in {`0x15`,`0x17`,`0x1d`,`0x57`,`0x65b`},
  `Sleep(50)` (`0x404320`).
- Serializer writes payload offsets `0x00..0x6F` only — no angle tuning / max-FPS.

## Gotchas

- **WebHID types:** TypeScript 5.6 `lib.dom` lacks the Web HID API. Ambient types
  live in `src/types/webhid.d.ts`. Keep that name: a `.d.ts` next to a same-named
  `.ts` (e.g. `src/webhid.d.ts`) is silently dropped from the program.
- **Typed arrays:** declare HID buffer params as `ArrayBufferView | ArrayBuffer`,
  not `BufferSource` — the latter is `ArrayBufferView<ArrayBuffer>` and rejects
  `Uint8Array<ArrayBufferLike>`.
- **Feature-report framing:** WebHID's `sendFeatureReport(reportId, data)` takes the
  ID separately and `data` must NOT include it; `receiveFeatureReport(reportId)`
  returns data that DOES include the ID. Buffers here keep the hidapi layout (ID at
  byte 0), so `Op1Transport.sendFeature` strips byte 0 before sending.
- **GitHub Pages:** `vite.config.ts` intentionally sets `base: "./"` so the same
  `dist/` works at the root or a project subpath. Don't switch to an absolute base.
  Deploy runs via `.github/workflows/deploy.yml` on push to `main`.
- **WebHID runtime:** Chromium-only, requires `https://` or `http://localhost`
  (secure context), and the first `requestDevice` must come from a user gesture.
  On Linux, if `device.open()` fails with a permission error, install
  `udev/70-endgame-op1.rules` (`sudo cp` to `/etc/udev/rules.d/`, reload, replug).
- `tsconfig` is strict with `noUnusedLocals`/`noUnusedParameters`.

## Protocol references

The wire format was reverse-engineered and cross-checked against independent
community work: `OpenMouse-Project/mouse-protocol` (`src/endgame-gear/op1.ts`) and
`johanneszab/endgame-op1w` (`re/PROTOCOL.md`). When adding fields, prefer those
verified sources over re-deriving from the binary.
