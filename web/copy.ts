/**
 * Every sentence the page writes itself, in one place, so wording can be reviewed,
 * kept consistent and translated without touching rendering or behaviour code.
 */
import type { Action, Room } from '../src/domain/catalogue';
import type { Notice } from '../src/services/coach';

/** Messages for the status line under the form. */
export const STATUS = {
  working:
    'Fetching the live air forecast and writing your plan. This can take up to half a minute.',
  ready: 'Your plan is ready below.',
  cleared: 'Saved plan cleared.',
  offline: 'We could not reach HazeGuard. Check your connection and try again.',
  unexpected: 'HazeGuard sent an unexpected reply. Please try again.',
} as const;

/** Messages for "Use my current location". */
export const LOCATION = {
  unsupported: 'This browser cannot share its location. Please type a place.',
  asking: 'Asking your browser for your location…',
  found: 'Location found. The plan will use it.',
  denied: 'Location was not shared. Please type a place instead.',
  fieldValue: 'My current location',
} as const;

/** Announcements for adding and removing trips. */
export const TRIPS = {
  added: (count: number): string => `Trip ${String(count)} added.`,
  removed: (left: number): string => `Trip removed. ${String(left)} left.`,
  legend: (number: number): string => `Trip ${String(number)}`,
  remove: (number: number): string => `Remove trip ${String(number)}`,
} as const;

/** Messages for copying the community notice. */
export const COPYING = {
  button: 'Copy notice text',
  done: 'Notice copied. Paste it into your group.',
  unavailable: 'Copying is not available here. Select the notice text and copy it instead.',
  blocked: 'Copying was blocked. Select the notice text and copy it instead.',
} as const;

/** Explanations for the notices a plan can carry. */
export const NOTICES: Readonly<Record<Notice, string>> = {
  'note-ignored': 'Your note looked like instructions to the AI, so it was left out of the plan.',
  'written-by-rules':
    'Gemini was unavailable, so HazeGuard’s built-in rules wrote this plan in English. Every number is the same.',
};

/** Who wrote a plan and where its numbers come from. */
export const AUTHORSHIP = {
  gemini: (model: string): string => `Written with Gemini (${model})`,
  rules: 'Written by HazeGuard’s rules',
  numbers: 'every number is calculated by HazeGuard from live Open-Meteo data.',
  pageTitle: (place: string): string => `Smog plan for ${place} | HazeGuard`,
} as const;

/** Headings, captions and column names of the plan sections. */
export const SECTIONS = {
  air: (place: string): string => `Air in ${place}`,
  airNow: (band: string): string => `${band} now`,
  glossary:
    'NAQI is India’s National Air Quality Index (0 to 500). PM2.5 is fine dust under 2.5 micrometres, small enough to reach deep into the lungs.',
  worstHour: 'Worst hour',
  cleanestHour: 'Cleanest hour',
  airingHour: 'Best time to air the home',
  unhealthyHours: 'Hours at Poor or worse',
  hourTable: 'Hour-by-hour table',
  hourCaption: 'Air for the next 24 hours',
  hourRegion: 'Hour-by-hour air',
  hourColumns: ['Time', 'Band', 'NAQI', 'PM2.5 (µg/m³)'],
  impact: 'What your switches change',
  trips: 'Cleaner trips',
  tripCaption: 'Your trips and the suggested switch',
  tripRegion: 'Trip comparison table',
  tripColumns: ['Trip', 'Usually', 'Suggested', 'CO₂ saved a week', 'PM2.5 breathed a week'],
  actions: 'What to do, room by room',
  actionsHint:
    'Most urgent first. Tick each one off as you do it; your ticks are saved on this device.',
  notice: 'Notice for your community',
  methodCaption: 'Factors used for every trip',
  methodRegion: 'Factors used',
  methodColumns: [
    'Mode',
    'kg CO₂e per km',
    'km per hour',
    'Breathing m³ per hour',
    'Exposure ratio',
  ],
} as const;

/** Sentences that explain a trip suggestion and its effect on the weekly dose. */
export const TRIP_REASONS = {
  retimed: (
    times: { better: string; usual: string },
    pm: { better: number; usual: number },
  ): string =>
    `Leave at ${times.better} instead of ${times.usual}: PM2.5 is ${String(pm.better)} instead of ${String(pm.usual)} µg/m³.`,
  switched: (better: string, usual: string): string =>
    `${better} instead of ${usual.toLowerCase()}.`,
  enclosed:
    'Walking and cycling were ruled out: the air will be Poor or worse and someone at home is sensitive.',
  unchanged: 'Your usual trip is already the cleanest choice within reach.',
  doseLess: (amount: string): string => `${amount} less`,
  doseMore: (amount: string): string => `${amount} more (breathing harder outdoors)`,
  doseSame: 'no change',
} as const;

/** Captions of the impact figures. */
export const IMPACT = {
  household: 'CO₂ saved a week by your household',
  community: (people: string): string =>
    `CO₂ saved a week if all ${people} people make the same switches`,
  doseLess: (percent: number): string =>
    `${String(percent)}% less PM2.5 breathed in while travelling`,
  doseMore: (percent: number): string =>
    `${String(percent)}% more PM2.5 breathed in while travelling, the cost of active travel`,
  doseSame: 'No change in PM2.5 breathed in while travelling',
} as const;

/** The computed lines printed under a community notice. */
export const NOTICE_FACTS = {
  worst: (when: string, band: string, index: number): string =>
    `Worst air: ${when} (${band}, NAQI ${String(index)})`,
  cleanest: (when: string): string => `Cleanest hour for outdoor activity: ${when}`,
  community: (saved: string): string =>
    `Same trip switches by everyone: ${saved} of CO₂ saved a week`,
} as const;

/** Headings for the rooms of the checklist. */
export const ROOMS: Readonly<Record<Room, string>> = {
  bedroom: 'Bedroom',
  kitchen: 'Kitchen',
  living: 'Living space',
  'whole-home': 'Whole home',
  outdoors: 'Going out',
  community: 'Together with your community',
};

/** Labels for how much an action costs. */
export const COSTS: Readonly<Record<Action['cost'], string>> = {
  free: 'Free',
  low: 'Low cost',
  investment: 'Worth investing in',
};

/** The formulas and sources behind every number, shown under "How these numbers were worked out". */
export const METHOD_NOTES: readonly string[] = [
  'NAQI: each pollutant’s reading is placed on the CPCB breakpoint scale; the index is the worst of PM2.5 and PM10.',
  'Trip CO₂ = distance × the mode’s kg CO₂e per passenger-km (DESNZ/DEFRA 2025 conversion factors; carpool shares a car between three).',
  'PM2.5 breathed = outdoor PM2.5 at departure × in-mode exposure ratio × breathing rate × time on the move.',
  'Weekly figures multiply one trip by how many times a week you make it. Cleaner hours are searched within the flexibility you chose.',
  'Breathing rates come from the US EPA Exposure Factors Handbook (2011); in-mode exposure ratios and speeds are typical values for Indian cities and are estimates.',
];
