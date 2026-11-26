/**
 * Physical quantities as branded numbers. A dose in micrograms and an emission in
 * kilograms are both `number` at runtime, but the compiler refuses to mix them, and every
 * value must pass through a constructor here, which also fixes its precision.
 */

declare const unit: unique symbol;

/** A number tagged with its unit; plain numbers must be converted explicitly. */
export type Quantity<U extends string> = number & { readonly [unit]: U };

/** A distance. */
export type Kilometres = Quantity<'km'>;
/** Greenhouse-gas emissions in kilograms of CO₂ equivalent. */
export type KilogramsCo2e = Quantity<'kg CO2e'>;
/** A mass of particulate matter breathed in. */
export type Micrograms = Quantity<'µg'>;
/** A particulate concentration in micrograms per cubic metre of air. */
export type Concentration = Quantity<'µg/m³'>;
/** A duration. */
export type Minutes = Quantity<'min'>;

/** Rounds to two decimal places, the precision every reported quantity uses. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** A distance in kilometres. */
export function kilometres(value: number): Kilometres {
  return value as Kilometres;
}

/** Emissions in kg CO₂e, rounded to two decimals. */
export function kilogramsCo2e(value: number): KilogramsCo2e {
  return round2(value) as KilogramsCo2e;
}

/** A dose in micrograms, rounded to two decimals. */
export function micrograms(value: number): Micrograms {
  return round2(value) as Micrograms;
}

/** A concentration in µg/m³. */
export function concentration(value: number): Concentration {
  return value as Concentration;
}

/** A duration in whole minutes. */
export function minutes(value: number): Minutes {
  return Math.round(value) as Minutes;
}
