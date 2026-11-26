/**
 * The interfaces the coach depends on. Adapters implement them for Open-Meteo and
 * Gemini; tests implement them with fakes, so no service code touches the network.
 */
import type { Forecast } from '../domain/forecast';

/** Where the user wants advice for: a typed place name or the browser's coordinates. */
export type LocationQuery =
  | { readonly kind: 'name'; readonly name: string }
  | { readonly kind: 'coords'; readonly latitude: number; readonly longitude: number };

/** Supplies hourly air forecasts. */
export interface AirSource {
  forecastFor(location: LocationQuery): Promise<Forecast>;
}

/** One structured-output request to a language model. */
export interface ModelRequest {
  readonly model: string;
  readonly system: string;
  readonly prompt: string;
  /** JSON Schema the reply must follow. */
  readonly schema: Readonly<Record<string, unknown>>;
}

/** Sends a prompt to a language model and returns the raw reply text. */
export interface TextModel {
  generate(request: ModelRequest): Promise<string>;
}

/** Structured log sink; values must never contain secrets or user text. */
export interface Logger {
  info(event: string, data?: Readonly<Record<string, unknown>>): void;
  warn(event: string, data?: Readonly<Record<string, unknown>>): void;
  error(event: string, data?: Readonly<Record<string, unknown>>): void;
}
