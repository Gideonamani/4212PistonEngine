import { readChoice, useStoredChoice } from '../data/localChoice';

// How Explore's camera answers a selection, chosen in the Look tab and kept on this device for every model.
// 'on' (the default) brings the selected part to the middle of the view and closes in on it; 'off' leaves the camera where it is.
const CENTRE_ON_SELECT_KEY = '4212-explore-centre-on-select';
const CENTRE_CHOICES = ['on', 'off'] as const;

/** Read at each selection, so a change in the Look tab applies from the next tap without reloading the model. */
export const readCentreOnSelect = () => readChoice(CENTRE_ON_SELECT_KEY, CENTRE_CHOICES) !== 'off';

export function useCentreOnSelect() {
  const [choice, choose] = useStoredChoice(CENTRE_ON_SELECT_KEY, CENTRE_CHOICES);
  return [choice !== 'off', (on: boolean) => choose(on ? 'on' : 'off')] as const;
}
