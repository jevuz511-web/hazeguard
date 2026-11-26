/**
 * The public request contract for POST /api/plan. Every field is bounded and enumerated,
 * free text rejects control and bidirectional-override characters, and unknown keys fail.
 */
import { z } from 'zod';
import { COOKING_FUELS, HEATING, LANGUAGES, MEMBERS, SETTINGS } from '../domain/household';
import { MODES } from '../domain/modes';
import { kilometres } from '../domain/units';
import type { PlanRequest } from '../services/coach';

/** Control characters and invisible direction overrides (Trojan Source); ZWJ/ZWNJ stay allowed for Indic scripts. */
const UNSAFE_CHARACTERS = /[\p{Cc}\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/u;

const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1, 'Please fill this in.')
    .max(max, `Keep this under ${String(max)} characters.`)
    .refine((value) => !UNSAFE_CHARACTERS.test(value), 'Remove hidden control characters.');

const TripSchema = z.strictObject({
  label: text(40),
  km: z
    .number({ error: 'Enter a number.' })
    .min(0.1, 'Use at least 0.1 km.')
    .max(150, 'Use 150 km or less.'),
  mode: z.enum(MODES),
  departHour: z.number({ error: 'Enter a number.' }).int().min(0).max(23),
  perWeek: z
    .number({ error: 'Enter a number.' })
    .int()
    .min(1, 'At least once a week.')
    .max(14, 'At most 14 times a week.'),
});

const LocationSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('name'), name: text(80) }),
  z.strictObject({
    kind: z.literal('coords'),
    latitude: z.number({ error: 'Enter a number.' }).min(-90).max(90),
    longitude: z.number({ error: 'Enter a number.' }).min(-180).max(180),
  }),
]);

const AudienceSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('household') }),
  z.strictObject({
    kind: z.literal('community'),
    setting: z.enum(SETTINGS),
    people: z
      .number({ error: 'Enter a number.' })
      .int()
      .min(2, 'A community has at least 2 people.')
      .max(100_000),
  }),
]);

/** Shape of the JSON body. */
export const PlanBodySchema = z.strictObject({
  location: LocationSchema,
  members: z.array(z.enum(MEMBERS)).max(MEMBERS.length),
  home: z.strictObject({
    cooking: z.enum(COOKING_FUELS),
    heating: z.enum(HEATING),
    purifier: z.boolean(),
    smoker: z.boolean(),
  }),
  trips: z.array(TripSchema).max(5, 'Add up to 5 trips.'),
  transit: z.strictObject({ bus: z.boolean(), metro: z.boolean() }),
  flexHours: z.number({ error: 'Enter a number.' }).int().min(0).max(3),
  audience: AudienceSchema,
  language: z.enum(LANGUAGES),
  note: text(280).nullable(),
});

/** A parsed request body. */
export type PlanBody = z.infer<typeof PlanBodySchema>;

/** Field path → first message, for showing errors next to form fields. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.map(String).join('.') || 'body';
    fields[path] ??= issue.message;
  }
  return fields;
}

/** Turns a parsed body into the coach's request. */
export function toPlanRequest(body: PlanBody): PlanRequest {
  const { location, audience, language, note, ...household } = body;
  return {
    location,
    audience,
    language,
    note,
    household: {
      ...household,
      members: [...new Set(household.members)],
      trips: household.trips.map((trip) => ({ ...trip, km: kilometres(trip.km) })),
    },
  };
}
