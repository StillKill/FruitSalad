export const layoutConfig = {
  width: 1600,
  height: 900,
  palette: {
    background: 0x111315,
    panel: 0x1b1f24,
    panelAlt: 0x242a31,
    border: 0x4a5360,
    accent: 0x7ed957,
    warning: 0xf5c451,
    textPrimary: '#f8f4ea',
    textMuted: '#c7c2b8',
    deckBack: 0x4f6752,
    marketCard: 0xc6d67f,
    saladCard: 0x5f6ccf
  },
  regions: {
    market: { x: 36, y: 36, width: 700, height: 828 },
    player: { x: 760, y: 168, width: 804, height: 520 },
    controls: { x: 760, y: 36, width: 804, height: 112 },
    scoreTabs: { x: 760, y: 694, width: 804, height: 72 },
    debug: { x: 760, y: 780, width: 804, height: 84 }
  },
  card: {
    width: 124,
    height: 172
  }
};