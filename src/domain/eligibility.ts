/**
 * Decides which catalogue actions fit a household, its forecast and its audience, ranked
 * by urgency. The rules alone make a complete plan; Gemini only reorders and explains.
 */
import { bandRank } from './aqi';
import { type Action, CATALOGUE, type Condition } from './catalogue';
import { AIR_POLICY } from './policy';
import type { Outlook } from './forecast';
import {
  type Audience,
  type Household,
  cooksWithSmokyFuel,
  hasSensitiveMember,
  heatsWithFuel,
} from './household';

/** Everything the eligibility rules look at. */
export interface Situation {
  readonly household: Household;
  readonly outlook: Outlook;
  readonly audience: Audience;
}

const RULES: Readonly<Record<Condition, (situation: Situation) => boolean>> = {
  sensitive: ({ household }) => hasSensitiveMember(household),
  purifier: ({ household }) => household.home.purifier,
  'no-purifier': ({ household }) => !household.home.purifier,
  'solid-cooking-fuel': ({ household }) => cooksWithSmokyFuel(household.home),
  'fuel-heater': ({ household }) => heatsWithFuel(household.home),
  smoker: ({ household }) => household.home.smoker,
  'bad-air': ({ outlook }) => bandRank(outlook.worst.band.id) >= bandRank(AIR_POLICY.badAirFrom),
  'outdoor-worker': ({ household }) => household.members.includes('outdoor-worker'),
  community: ({ audience }) => audience.kind === 'community',
  school: ({ audience }) => audience.kind === 'community' && audience.setting === 'school',
};

/** True when every condition of an action holds. */
export function fits(action: Action, situation: Situation): boolean {
  return action.when.every((condition) => RULES[condition](situation));
}

/** Actions that apply to this situation, most urgent first, catalogue order within a tie. */
export function eligibleActions(situation: Situation): Action[] {
  return CATALOGUE.filter((action) => fits(action, situation)).sort(
    (a, b) => a.priority - b.priority,
  );
}
