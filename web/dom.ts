/**
 * Tiny DOM helpers. Elements are created with createElement and text is set with
 * textContent, so no user or model text is ever parsed as HTML.
 */

type Child = Node | string | null;

/** Looks up an element by id and checks its type, failing loudly if the page changed. */
export function byId<T extends Element>(id: string, type: abstract new () => T): T {
  const element = document.getElementById(id);
  if (!(element instanceof type)) throw new Error(`#${id} is missing or not a ${type.name}`);
  return element;
}

/** Creates an element with attributes and children. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Readonly<Record<string, string>> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  element.append(...children.filter((child) => child !== null));
  return element;
}

/** Replaces everything inside `parent` with `children`. */
export function fill(parent: Element, ...children: Child[]): void {
  parent.replaceChildren(...children.filter((child) => child !== null));
}

/** Finds a required descendant by selector and checks its type. */
export function find<T extends Element>(
  root: ParentNode,
  selector: string,
  type: abstract new () => T,
): T {
  const element = root.querySelector(selector);
  if (!(element instanceof type)) throw new Error(`${selector} is missing or not a ${type.name}`);
  return element;
}

/** A table header row with one column header per name. */
export function headRow(names: readonly string[]): HTMLTableRowElement {
  return h('tr', {}, ...names.map((name) => h('th', { scope: 'col' }, name)));
}

/** Wraps a wide table in a keyboard-scrollable, labelled region. */
export function scrollRegion(label: string, table: HTMLTableElement): HTMLDivElement {
  return h(
    'div',
    { class: 'table-scroll', role: 'region', 'aria-label': label, tabindex: '0' },
    table,
  );
}
