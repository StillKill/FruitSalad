export const SETTINGS_NAME_MAX_LENGTH = 18;
export const DEFAULT_SOUND_VOLUME = 0.5;

export const SOUND_KEYS = {
  gameStart: 'game_start',
  tabSelect: 'tab_select',
  buttonClick: 'button_click',
  cardSelect: 'card_select',
  roundStart: 'round_start',
  timerEnds: 'timer_ends',
  endGame: 'end_game'
};

export function buildDeckDebugSnapshot(deck) {
  return {
    id: deck.id,
    saladsLeft: deck.cards.length,
    topSalad: deck.cards[0]
      ? {
        runtimeId: deck.cards[0].runtimeId,
        cardId: deck.cards[0].id,
        backFruit: deck.cards[0].backFruit
      }
      : null,
    market: deck.market.map((card) => ({
      id: card.id,
      fruit: card.fruit,
      sourceCardId: card.sourceCardId
    }))
  };
}
