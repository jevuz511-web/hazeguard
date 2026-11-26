/** Bundle entry: starts the page with the real browser services. */
import { start } from './main';

start({
  fetch: window.fetch.bind(window),
  storage: window.localStorage,
  // Older or locked-down browsers leave these undefined; the page explains instead.
  geolocation: navigator.geolocation,
  clipboard: navigator.clipboard,
  print: () => {
    window.print();
  },
});
