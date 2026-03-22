export class TurnStateMachine {
  constructor(initialState) {
    this.state = initialState;
  }

  transition(nextState) {
    this.state = nextState;
    return this.state;
  }
}