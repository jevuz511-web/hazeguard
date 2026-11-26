/** Part of the vetted action catalogue; see catalogue.ts for the types and rules. */
import type { Action } from './catalogue';

/** Actions a residents' association, school or workplace can take together. */
export const COMMUNITY_ACTIONS: readonly Action[] = [
  {
    id: 'carpool-roster',
    room: 'community',
    cost: 'free',
    priority: 1,
    when: ['community'],
    title: 'Start a carpool roster',
    detail:
      'A shared sign-up sheet for regular routes cuts the number of cars at gates and on the road every morning.',
  },
  {
    id: 'no-burning',
    room: 'community',
    cost: 'free',
    priority: 1,
    when: ['community'],
    title: 'Stop leaf, waste and bonfire burning',
    detail:
      'Agree a no-burning rule, give guards a way to stop fires, and report open burning to the city through the CPCB Sameer app.',
  },
  {
    id: 'no-idling',
    room: 'community',
    cost: 'free',
    priority: 2,
    when: ['community'],
    title: 'No idling at gates',
    detail:
      'Ask drivers to switch off engines while waiting at gates and pick-up points, with clear signs.',
  },
  {
    id: 'dust-control',
    room: 'community',
    cost: 'low',
    priority: 2,
    when: ['community'],
    title: 'Control dust from works and roads',
    detail:
      'Ask contractors to cover sand and debris, and to wet the site and internal roads before sweeping.',
  },
  {
    id: 'shared-clean-room',
    room: 'community',
    cost: 'investment',
    priority: 3,
    when: ['community'],
    title: 'Set up a shared clean room',
    detail:
      'Run purifiers in one common room, such as a creche, clinic or staff room, for people who need a break from the smog.',
  },
  {
    id: 'daily-air-alert',
    room: 'community',
    cost: 'free',
    priority: 2,
    when: ['community'],
    title: 'Share a daily air alert',
    detail:
      'Post each morning’s forecast and cleanest hours in the residents’, parents’ or staff group so everyone can plan.',
  },
  {
    id: 'indoor-assembly',
    room: 'community',
    cost: 'free',
    priority: 1,
    when: ['school'],
    title: 'Move assembly and sport indoors',
    detail:
      'On Poor or worse days, hold assembly in classrooms and switch outdoor sport to indoor activity.',
  },
];
