/**
 * Shows the server's field errors the accessible way: a focused summary with links to
 * each field, plus aria-invalid and an inline message on the field itself.
 */
import { byId, h } from './dom';

/** The form control id for a server error path such as `trips.0.km`. */
export function fieldId(path: string): string {
  return `f-${path.replaceAll('.', '-')}`;
}

/** Human name of a field: its label text without "(required)", or the path itself. */
function fieldName(id: string, path: string): string {
  const label = document.querySelector(`label[for="${id}"]`);
  return label === null ? path : label.textContent.replace('(required)', '').trim();
}

/** Removes every error message and invalid marker. */
export function clearErrors(): void {
  byId('error-summary', HTMLElement).hidden = true;
  byId('error-list', HTMLUListElement).replaceChildren();
  for (const field of document.querySelectorAll('[aria-invalid="true"]')) {
    field.removeAttribute('aria-invalid');
  }
  for (const message of document.querySelectorAll<HTMLElement>('.field-error')) {
    message.hidden = true;
    message.textContent = '';
  }
}

function markField(id: string, message: string): void {
  document.getElementById(id)?.setAttribute('aria-invalid', 'true');
  const inline = document.getElementById(`${id}-error`);
  if (inline !== null) {
    inline.textContent = message;
    inline.hidden = false;
  }
}

/** Shows a problem: its title, then each field error linked to its field; focuses the summary. */
export function showErrors(title: string, fields: Readonly<Record<string, string>>): void {
  clearErrors();
  byId('error-title', HTMLElement).textContent = title;
  const items = Object.entries(fields).map(([path, message]) => {
    const id = fieldId(path);
    markField(id, message);
    const target = document.getElementById(id) === null ? 'planner' : id;
    return h('li', {}, h('a', { href: `#${target}` }, `${fieldName(id, path)}: ${message}`));
  });
  byId('error-list', HTMLUListElement).replaceChildren(...items);
  const summary = byId('error-summary', HTMLElement);
  summary.hidden = false;
  summary.focus();
}
