# UI from shadcn/ui on Base UI, looks as variants

The screens #3–#16 were built from hand-made parts: an own bottom sheet with its own portal, focus and Escape handling, an own full-screen dialog, own tabs, badges, fields and radio cards, and raw `<button>`s with long Tailwind strings at every call site. The project had shadcn/ui set up (style `base-rhea`, `@base-ui/react`), but only an unused `Button` came from it. Behaviour and accessibility were rebuilt by hand and differ from place to place, and a change of look has to be repeated at many call sites.

From now on the UI is built from shadcn/ui components in the `base-rhea` style, on Base UI primitives (`src/components/ui`, added with the shadcn CLI or the shadcn MCP server). The looks from `docs/design/README.md` › Bausteine live in those components as cva variants and sizes. Call sites pick `variant` and `size` and add only layout classes (margin, gap, width, flex/grid placement, visibility); colour, type, radius, border and height belong in a variant.

## Decisions

- **Own the components.** shadcn copies the source into the repo. We change the default variants to the design (sizes, radius, 1.5 px borders, disabled at 40 %, focus outline in `primary`) instead of wrapping them.
- **Native date and select.** On phones the native controls are easier and familiar: dates use `DateInput` (a native `type="date"` with our own calendar icon, since browsers draw different indicators: Samsung Internet a chevron, iOS none), choices from a list use `NativeSelect` with `NativeSelectOption`. No Base UI popover select or calendar.
- **Compound components.** Parts with several pieces (sheets, fields, choices, lists, domain parts such as player rows or the period picker) are built from composable pieces, as shadcn does (`Drawer` + `DrawerHeader` + `DrawerTitle` …), not as one component with many configuration props and not assembled inline at the call site.
- **Domain components stay.** Game board, life bar, scorekeeper status, logo and QR code remain app components, built inside from shadcn parts, with their states as variants.
- **Lint guard.** ESLint reports raw `button`, `input`, `select`, `textarea`, `table` and `role="dialog"` outside `src/components/ui`.

## Considered Options

- **Keep the hand-made parts and only tidy them**: rejected, focus traps, Escape, swiping and ARIA would still be ours to keep right.
- **Radix instead of Base UI**: rejected, the project is set up on Base UI and nothing needs Radix.
- **Popover select and calendar from Base UI**: rejected for phones, see above.

## Consequences

- #40 adds the components and variants beside the old parts; #41–#45 move the screens over; #46 deletes the old parts and turns the lint rule from warning into error.
- New UI first looks for a shadcn component (shadcn MCP server or `pnpm dlx shadcn@latest add <name>`); `ui.shadcn.com` must be reachable for that.
- `docs/design/README.md` › Bausteine names the component and variant for each part.
