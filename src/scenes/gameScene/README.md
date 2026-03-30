# GameScene Routing

Use this folder as the first stop before opening the full scene implementation.

## Entry point
- `src/scenes/GameScene.js`: thin Phaser scene shell with constructor, update loop, preload, create, and prototype wiring.

## Helper modules
- `src/scenes/gameScene/runtimeMethods.js`: audio playback, debug bridge, scoring preview, end-game formatting helpers, and the top-level `renderDynamicUi()` refresh path.
- `src/scenes/gameScene/settingsOverlayMethods.js`: locale switching, settings overlay rendering, DOM input bridge, save persistence helpers, and settings-screen rendering.
- `src/scenes/gameScene/sessionFlowMethods.js`: player-count changes, demo launch, fair-session continue/new-game flow, and session bootstrap/teardown.
- `src/scenes/gameScene/viewportMethods.js`: viewport detection, mobile/desktop shell switching, scroll-wheel routing, and mobile-section state.
- `src/scenes/gameScene/mobileLayoutMethods.js`: mobile landscape controls, navigation rail, market, player area, and debug panel rendering.
- `src/scenes/gameScene/boardLayoutMethods.js`: desktop controls, market, player area, tabs, debug panel, and end-game overlay rendering.
- `src/scenes/gameScene/sharedUiMethods.js`: shared buttons, locale toggle, scrollbars, click zones, selection outlines, and interaction guards reused by mobile and desktop views.
- `src/scenes/gameScene/constants.js`: shared scene constants and sound keys.

## Routing hints
- Settings, locale, overlay, saved-session menu, or rules popup changes: start with `settingsOverlayMethods.js`, then `sessionFlowMethods.js` if session launch behavior also changes.
- Player-count defaults, new game flow, continue/demo logic, or session bootstrapping: start with `sessionFlowMethods.js`.
- Mobile-only layout or navigation work: start with `viewportMethods.js` and `mobileLayoutMethods.js`.
- Desktop board, market, tabs, end-game popup, or in-game controls: start with `boardLayoutMethods.js`.
- Shared button behavior, click zones, scrollbars, or selection visuals: start with `sharedUiMethods.js`.
- Audio, scoring preview, debug bridge, or top-level redraw behavior: start with `runtimeMethods.js`.
