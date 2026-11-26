/** Formatting for times, weights and doses shown in the plan. */

const number = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** "7 am", "12 pm", "11 pm" from a `YYYY-MM-DDTHH:mm` local time. */
export function clock(time: string): string {
  const hour = Number(time.slice(11, 13));
  const suffix = hour < 12 ? 'am' : 'pm';
  return `${String(hour % 12 === 0 ? 12 : hour % 12)} ${suffix}`;
}

/** The clock time, prefixed with "tomorrow" when it falls on a later date than `today`. */
export function when(time: string, today: string): string {
  return time.slice(0, 10) > today.slice(0, 10) ? `tomorrow ${clock(time)}` : clock(time);
}

/** "2.4 kg" with Indian digit grouping. */
export function kg(value: number): string {
  return `${number.format(value)} kg`;
}

/** "350 µg" for an inhaled dose. */
export function micrograms(value: number): string {
  return `${whole.format(value)} µg`;
}

/** "1,200" with Indian digit grouping. */
export function count(value: number): string {
  return whole.format(value);
}

/** Option label for a clock hour select. */
export function hourLabel(hour: number): string {
  return clock(`0000-00-00T${String(hour).padStart(2, '0')}:00`);
}
