# Problem statement alignment

> Create a **GenAI-powered assistant** that helps **families and communities** navigate **severe winter smog and urban air pollution**: **low-emission daily routines**, **indoor air quality hacks** and **sustainable alternatives** **tailored to their location and lifestyle**, while **clearly explaining the direct impact of their choices**.

The C1 to C9 table in the [README](README.md#problem-statement-alignment) maps each phrase to UI, code and tests. This page explains the reasoning and lists every number HazeGuard uses, with its source.

## Who it serves

- **Families:**
  - The household form records children, older adults, people with lung or heart disease, pregnancy and outdoor work.
  - These change three things: which actions appear (a _clean room_ only matters if someone needs one), how actions are ranked, and whether walking or cycling may be suggested on Poor days.
- **Communities:**
  - A residents' welfare association, school or workplace adds community actions: carpool roster, no burning (with the CPCB _Sameer_ app for reporting), no idling at gates, dust control, a shared clean room, daily air alerts, and indoor assemblies for schools.
  - It also adds a **ready-to-share notice** and the CO₂ saving if every member made the same switches.

## The three kinds of advice

1. **Low-emission daily routines.** Each regular trip is compared, at the cleanest hour within the family's flexibility, across every realistic mode. The plan says what changed and why, for example: "Leave at 10 am instead of 9 am: PM2.5 is 100 instead of 127 µg/m³. Metro instead of car (alone)." (from a live Delhi plan)
2. **Indoor air quality hacks.** A vetted catalogue covers:
   - **bedroom:** clean room, closed-room purifier use, DIY fan filter;
   - **whole home:** windows shut at peaks, airing at the forecast's cleanest daytime hour, wet cleaning, sealing gaps, filter checks;
   - **kitchen:** exhaust while cooking;
   - **living space:** skipping incense and mosquito coils, smoking outside;
   - **going out:** fitted N95, exercise indoors, outdoor-work planning.
3. **Sustainable alternatives.** These cover metro, bus, carpooling, cycling and walking; LPG, piped gas or induction instead of wood, dung, coal or kerosene, with the Ujjwala scheme for LPG; and electric heaters instead of kerosene, wood or coal heaters.

## Explaining the direct impact

- **Climate:** kg CO₂e saved per week, per household and for the whole community.
- **Health:**
  - Micrograms of PM2.5 breathed in while travelling, per week, as an amount and a percentage.
  - When cycling _raises_ the dose because of harder breathing, the plan says so ("more (breathing harder outdoors)") rather than hiding the trade-off.
- **Why:** a plain-language reason for every trip change and every action. Gemini writes the "why this matters for your family" line, and the catalogue gives the how-to.
- **How:** an expandable **How these numbers were worked out** section lists the formulas and the full factor table.

## Numbers and sources

| Quantity               | Value                                                                                                                            | Source                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Air quality index      | CPCB NAQI breakpoints. PM2.5: 0/30/60/90/120/250 µg/m³ for index 0/50/100/200/300/400. PM10: 0/50/100/250/350/430. Capped at 500 | Central Pollution Control Board, National Air Quality Index (2014)                 |
| Air data               | Hourly PM2.5 and PM10 forecast, next 24 hours                                                                                    | Open-Meteo Air Quality API (Copernicus CAMS)                                       |
| Car, petrol average    | 0.1645 kg CO₂e per km                                                                                                            | DESNZ/DEFRA GHG conversion factors 2025                                            |
| Carpool                | 0.1645 ÷ 3 per passenger-km                                                                                                      | Assumption: three occupants                                                        |
| Motorbike or scooter   | 0.1137 kg CO₂e per km                                                                                                            | DESNZ/DEFRA 2025                                                                   |
| Bus (local)            | 0.1085 kg CO₂e per passenger-km                                                                                                  | DESNZ/DEFRA 2025                                                                   |
| Metro (light rail)     | 0.0286 kg CO₂e per passenger-km                                                                                                  | DESNZ/DEFRA 2025                                                                   |
| Walking, cycling       | 0                                                                                                                                | —                                                                                  |
| Breathing rate         | 0.25 m³/h seated; 0.72 m³/h light activity (walking, riding a two-wheeler); 1.56 m³/h moderate (cycling)                         | US EPA Exposure Factors Handbook (2011), Table 6-2, adults                         |
| In-mode exposure ratio | Metro 0.6, car 0.8, bus 0.9, walking and cycling 1.0, motorbike 1.2                                                              | Assumption: typical commuter-exposure findings for Indian cities; shown in the app |
| Door-to-door speed     | Walk 4.5, cycle 12, bus 15, car 22, motorbike 25, metro 30 km/h                                                                  | Assumption: city traffic                                                           |

**Formulas:**

- Trip CO₂ = km × factor.
- Dose = PM2.5 × exposure ratio × breathing rate × (km ÷ speed).
- Weekly figures = per trip × times per week.
- Community CO₂ = household weekly saving × people.

## Tailoring inputs

The tailoring uses:

- the place (typed, or the browser's location);
- household members;
- cooking fuel and heating;
- whether the home has a purifier, and whether anyone smokes indoors;
- up to five trips, each with distance, mode, start time and times a week;
- the bus or metro within a 10-minute walk;
- how far trip times can move (0 to 3 hours);
- household or community, with the community's size;
- English or Hindi;
- an optional note.
