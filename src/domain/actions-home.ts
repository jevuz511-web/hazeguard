/** Part of the vetted action catalogue; see catalogue.ts for the types and rules. */
import type { Action } from './catalogue';

/** Actions a household can take at home and when going out. */
export const HOME_ACTIONS: readonly Action[] = [
  {
    id: 'clean-room',
    room: 'bedroom',
    cost: 'free',
    priority: 1,
    when: ['sensitive'],
    title: 'Make one clean room',
    detail:
      'Pick the room where children, older relatives or anyone with asthma sleeps. Keep its door and windows shut and put your purifier or fan filter there.',
  },
  {
    id: 'purifier-closed-room',
    room: 'bedroom',
    cost: 'free',
    priority: 1,
    when: ['purifier'],
    title: 'Run the purifier in a closed room',
    detail:
      'A purifier only cleans the room it is in. Close the door, run it on high for an hour, then on medium through the night.',
  },
  {
    id: 'fan-filter',
    room: 'bedroom',
    cost: 'low',
    priority: 2,
    when: ['no-purifier'],
    title: 'Build a fan filter',
    detail:
      'Strap a MERV 13 or HEPA-grade filter to the back of a box or table fan, arrow towards the fan. It removes much of the fine dust in a small bedroom.',
  },
  {
    id: 'windows-at-peaks',
    room: 'whole-home',
    cost: 'free',
    priority: 1,
    when: [],
    title: 'Keep windows shut at smog peaks',
    detail:
      'Late night and early morning are usually the worst hours in winter. Keep windows closed then and through any hour marked Poor or worse.',
  },
  {
    id: 'air-at-cleanest-hour',
    room: 'whole-home',
    cost: 'free',
    priority: 2,
    when: [],
    title: 'Air the home at the cleanest hour',
    detail:
      'Open windows on opposite sides for 10 to 15 minutes at the cleanest daytime hour shown in your forecast to clear cooking fumes and damp.',
  },
  {
    id: 'kitchen-exhaust',
    room: 'kitchen',
    cost: 'free',
    priority: 2,
    when: [],
    title: 'Run the exhaust while cooking',
    detail:
      'Switch on the chimney or exhaust fan before you light the stove and leave it on for 10 minutes after. Use lids and avoid deep frying on bad-air days.',
  },
  {
    id: 'clean-cooking-fuel',
    room: 'kitchen',
    cost: 'investment',
    priority: 1,
    when: ['solid-cooking-fuel'],
    title: 'Move cooking to gas or induction',
    detail:
      'Wood, dung, coal and kerosene stoves are one of the largest sources of indoor smoke. LPG, piped gas or induction cut it sharply; the Ujjwala scheme can help with an LPG connection.',
  },
  {
    id: 'electric-heating',
    room: 'living',
    cost: 'investment',
    priority: 1,
    when: ['fuel-heater'],
    title: 'Replace fuel heaters with electric ones',
    detail:
      'Kerosene, coal and wood heaters release fine particles and carbon monoxide indoors. An electric oil-filled heater warms the room without smoke.',
  },
  {
    id: 'smoke-outside',
    room: 'living',
    cost: 'free',
    priority: 1,
    when: ['smoker'],
    title: 'Smoke outside, away from doors',
    detail:
      'Indoor smoking fills the home with fine particles that linger for hours. Step outside and away from open doors and windows.',
  },
  {
    id: 'skip-incense',
    room: 'living',
    cost: 'free',
    priority: 3,
    when: [],
    title: 'Skip incense, coils and candles',
    detail:
      'Incense sticks, mosquito coils and candles add fine particles indoors. Use an electric repellent and LED diyas on bad-air days.',
  },
  {
    id: 'wet-cleaning',
    room: 'whole-home',
    cost: 'free',
    priority: 3,
    when: [],
    title: 'Wet-mop instead of sweeping',
    detail:
      'Sweeping throws settled dust back into the air. Damp-dust surfaces and wet-mop floors instead.',
  },
  {
    id: 'seal-gaps',
    room: 'whole-home',
    cost: 'low',
    priority: 3,
    when: ['bad-air'],
    title: 'Seal gaps around doors and windows',
    detail:
      'Foam weather strips and door sweeps stop smoggy air leaking in, so purifiers and fan filters work much better.',
  },
  {
    id: 'fitted-mask',
    room: 'outdoors',
    cost: 'low',
    priority: 2,
    when: ['bad-air'],
    title: 'Wear a fitted N95 outdoors',
    detail:
      'A well-fitted N95 or FFP2 filters most fine particles; cloth and surgical masks do not. Masks are not suitable for children under two.',
  },
  {
    id: 'exercise-indoors',
    room: 'outdoors',
    cost: 'free',
    priority: 2,
    when: ['bad-air'],
    title: 'Move exercise indoors',
    detail:
      'Hard breathing pulls far more smog into the lungs. Exercise indoors, or outdoors only at the cleanest hour.',
  },
  {
    id: 'outdoor-work-breaks',
    room: 'outdoors',
    cost: 'low',
    priority: 1,
    when: ['outdoor-worker'],
    title: 'Plan outdoor work around the air',
    detail:
      'Do the heaviest outdoor work at the cleanest hours, wear a fitted N95, and take breaks indoors with clean water to drink.',
  },
  {
    id: 'check-filter',
    room: 'whole-home',
    cost: 'low',
    priority: 3,
    when: ['purifier'],
    title: 'Check the purifier filter',
    detail:
      'Filters clog fast in smog season. Check the indicator or the manual and replace a grey, clogged filter.',
  },
];
