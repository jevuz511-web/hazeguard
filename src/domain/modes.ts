/**
 * Ways of making a trip and the sourced factors behind each one: emissions, speed,
 * breathing rate and in-vehicle exposure. Sources are listed in PROBLEM_ALIGNMENT.md.
 */
import { TRAVEL_POLICY } from './policy';

/** Ways of making a trip. `carpool` is a car shared between TRAVEL_POLICY.carpoolSize people. */
export const MODES = ['walk', 'cycle', 'bus', 'metro', 'motorbike', 'car', 'carpool'] as const;

/** One way of making a trip. */
export type Mode = (typeof MODES)[number];

/** The numbers behind a mode. */
export interface ModeProfile {
  readonly label: string;
  /** kg CO₂e per passenger-km (DESNZ/DEFRA 2025 conversion factors). */
  readonly co2PerKm: number;
  /** Typical door-to-door city speed (assumption). */
  readonly kmPerHour: number;
  /** Air breathed in m³/h at this activity level (US EPA Exposure Factors Handbook). */
  readonly breathing: number;
  /** PM2.5 inside the mode relative to the street (assumption from commuter studies). */
  readonly exposure: number;
  /** Whether the traveller is breathing hard outdoors. */
  readonly active: boolean;
}

/** Average petrol car, per vehicle-km (DESNZ/DEFRA 2025). */
const CAR_CO2_PER_KM = 0.1645;

/** Breathing rates in m³/h for adults (US EPA Exposure Factors Handbook 2011, Table 6-2). */
const BREATHING = { seated: 0.25, light: 0.72, moderate: 1.56 } as const;

/** Builds a profile for a mode where the traveller sits inside a vehicle. */
function seated(
  label: string,
  factors: { co2PerKm: number; kmPerHour: number; exposure: number },
): ModeProfile {
  return { label, ...factors, breathing: BREATHING.seated, active: false };
}

/** Per-mode factors used for every trip calculation. */
export const MODE_PROFILES: Readonly<Record<Mode, ModeProfile>> = {
  walk: {
    label: 'Walk',
    co2PerKm: 0,
    kmPerHour: 4.5,
    breathing: BREATHING.light,
    exposure: 1,
    active: true,
  },
  cycle: {
    label: 'Cycle',
    co2PerKm: 0,
    kmPerHour: 12,
    breathing: BREATHING.moderate,
    exposure: 1,
    active: true,
  },
  bus: seated('Bus', { co2PerKm: 0.1085, kmPerHour: 15, exposure: 0.9 }),
  metro: seated('Metro', { co2PerKm: 0.0286, kmPerHour: 30, exposure: 0.6 }),
  motorbike: {
    label: 'Motorbike or scooter',
    co2PerKm: 0.1137,
    kmPerHour: 25,
    breathing: BREATHING.light,
    exposure: 1.2,
    active: false,
  },
  car: seated('Car (alone)', { co2PerKm: CAR_CO2_PER_KM, kmPerHour: 22, exposure: 0.8 }),
  carpool: seated(`Carpool (${String(TRAVEL_POLICY.carpoolSize)} people)`, {
    co2PerKm: CAR_CO2_PER_KM / TRAVEL_POLICY.carpoolSize,
    kmPerHour: 22,
    exposure: 0.8,
  }),
};
