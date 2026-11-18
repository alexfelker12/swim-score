# Page changes move like a stack, with the router's typed view transitions

The installed app should feel like an app (#49, #55): forward, the new page slides in from the right; back, the page slides out to the right. TanStack Router can wrap a page change in a view transition and give it types; `src/lib/page-transitions.ts` gives each change the type "forward" or "back", and `src/styles.css` has the slides for both.

## Rules

- **Direction from the history:** a change to an earlier place in the history (`__TSR_index` in the router's history state, smaller) is "back", everything else "forward". Back links (`PageHeaderBack`, the arrow on the sign-up pages) add a step to the history but lead back up: they move "back" (`backTransition()`).
- **No transition** when only the search changes (the tabs of a Group) or a page loads again, when the device asks for reduced motion (also kept out in CSS), and for steps that only close a sheet: the router doesn't see them (ADR 0013).
- **No second animation:** when the browser animates a step back itself (iOS swipe from the edge, Android's predictive back gesture), it says so with `hasUAVisualTransition`; then there is no own transition. Where the browser doesn't say, iOS is assumed to animate every step back. This only counts for the page change within a second of the step.
- **The update hint stays put** (`view-transition-name`), the rest of the screen moves.
- **Only with typed transitions:** a browser that has view transitions but can't give them types would cross-fade every change, tabs and reloads included; there the router gets no transitions at all.
- The scroll position of each page stays as before (`scrollRestoration`).

## Considered Options

- **Animating the pages ourselves** (keeping the previous page in the DOM, as native stacks do, with a swipe that follows the finger): a lot of work against the router, and on iOS it collides with the browser's own swipe. Rejected (#49).
- **One transition for every change, without direction:** the router's default cross-fade; doesn't feel like a stack and also animates tab changes.

## Consequences

- During a transition (300 ms) the page doesn't take taps.
- New back links in a page header get the "back" movement through `PageHeaderBack`; a back link elsewhere moves "forward" unless it is given `backTransition()`.
- On an iPhone without `hasUAVisualTransition`, going back in the history doesn't animate at all, also with a button that calls `history.back()` (the player profile's back).
- After a back link the history has a step more: "Zurück" from there returns to the page the link left, and moves "back" although it goes deeper. Accepted, it's how the links already worked.
- `__TSR_index` is a field of the router's history state, not public API; a router update may need `historyIndex` adjusted.
- A drawer that is still closing when a link inside it navigates moves with the old page.
- Checked in Chrome; how it looks on the devices (Samsung, iPhone) needs a check there.
