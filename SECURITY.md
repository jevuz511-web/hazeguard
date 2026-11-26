# Security

## Reporting a vulnerability

Please report privately through GitHub's **Report a vulnerability** button on this repository's Security tab. Do not open a public issue. Expect an acknowledgement within three days. The site also publishes `/.well-known/security.txt`.

## Threat model and defences

| Threat                                                   | Defence                                                                                                                                                                                                                                     | Code                                           | Test                                        |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------- |
| Cross-site scripting                                     | No HTML is ever built from strings: DOM is created with `createElement` and `textContent`. A CSP of `default-src 'none'` allows only same-origin scripts and styles, with **Trusted Types enforced** (`require-trusted-types-for 'script'`) | `web/dom.ts`, `src/http/security.ts`           | `app.test.ts`, conventions test             |
| Other sites spending the Gemini quota (CSRF-style abuse) | `POST /api/plan` rejects `Sec-Fetch-Site` other than same-origin. Without that header, a mismatched `Origin` is rejected. Only `application/json` is accepted                                                                               | `security.ts`                                  | `units.test.ts`, `app.test.ts`              |
| Abuse and cost blow-up                                   | A per-client limit (default 8 a minute), a **global** limit (default 60 a minute) and a bounded client table; replies carry `Retry-After`                                                                                                   | `rate-limit.ts`                                | `rate-limit.test.ts`, `app.test.ts`         |
| Spoofed client addresses                                 | `TRUSTED_PROXIES` picks the address appended by the outermost trusted proxy; earlier hops are ignored                                                                                                                                       | `rate-limit.ts`                                | `units.test.ts`                             |
| Oversized or malformed input                             | A 16 KB body limit (413). Strict Zod objects (unknown keys fail) with bounded numbers, enums and lengths                                                                                                                                    | `app.ts`, `plan-request.ts`                    | `app.test.ts`, `units.test.ts`              |
| Trojan Source and hidden text                            | Free text rejects control characters and bidi overrides, while allowing the ZWJ/ZWNJ that Devanagari needs. A test scans every file for invisible characters                                                                                | `plan-request.ts`                              | `units.test.ts`, conventions test           |
| Prompt injection                                         | The note is screened; a flagged note is dropped and the user is told. Otherwise it is fenced as `<household_note>` data, and the system instruction says it is not instructions                                                             | `services/brief.ts`, `coach.ts`                | `brief.test.ts`, `coach.test.ts`, live eval |
| Model hallucination or unsafe output                     | Replies must match a JSON schema, may only use eligible catalogue ids, may contain **no digits**, and run under Gemini safety settings. A failing reply is repaired by the next model, then falls back to the rules                         | `tailoring.ts`, `adapters/gemini.ts`           | `tailoring.test.ts`, `coach.test.ts`        |
| Secret leakage                                           | The key is read once, then deleted from `process.env`. The logger masks it in every line. Config errors name variables but never print values. Errors are logged by name only. gitleaks scans the full history in CI                        | `platform/*.ts`, `node-server.ts`, `vercel.ts` | `platform.test.ts`, `entry.test.ts`         |
| Information disclosure                                   | Unexpected errors return a generic problem and status 500. Problem bodies never include causes                                                                                                                                              | `app.ts`, `services/problem.ts`                | `app.test.ts`, `problem.test.ts`            |
| Clickjacking, sniffing, leaks                            | `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, COOP/CORP same-origin, HSTS for two years, and a Permissions-Policy that allows only same-origin geolocation                                  | `security.ts`                                  | `app.test.ts`                               |
| Slow clients                                             | 10 s header timeout, 60 s request timeout, 5 s keep-alive                                                                                                                                                                                   | `node-server.ts`                               | `entry.test.ts`                             |
| Supply chain                                             | Exact versions; `ignore-scripts=true`; `npm audit` and `npm audit signatures` in CI; CodeQL (`security-and-quality`); Dependabot for npm, Actions and Docker; actions and base images pinned by SHA or digest                               | `.npmrc`, `.github/`                           | CI                                          |
| Container escape surface                                 | Distroless Node 22 image: no shell, non-root user, only production dependencies                                                                                                                                                             | `Dockerfile`                                   | —                                           |

## Data handling

- **What is kept:**
  - Nothing a user enters is stored on the server.
  - The browser keeps the last plan and the ticks in `localStorage`, and **Clear saved plan** removes them.
- **What is sent:**
  - The form asks for no names or contact details.
  - Browser coordinates are sent only when the user taps **Use my current location**, and only to fetch the forecast.
- **What reaches Gemini:**
  - Gemini receives computed facts and, if present and safe, the 280-character note.
  - Logs record event names, counts and model names, never user text.
