# Acute Stroke Guide

An evidence-based, offline-capable bedside reference for the acute management of stroke — built for stroke neurologists, emergency physicians, nurses, advanced practice clinicians and trainees.

**Live app:** https://strokedoc.github.io/acute-stroke-guide/

It is a progressive web app: one page, no dependencies, no build step, no network calls after the first load. Add it to a home screen and it works in a code cart, an ambulance bay, or a rural CT suite with no signal.

---

## What it covers

| Ischaemic stroke | Haemorrhagic stroke | Tools |
| --- | --- | --- |
| Prehospital triage, LVO scales, destination | ICH first hour, BP targets, INTERACT3 bundle | Reperfusion pathfinder |
| ED time targets and evaluation | Anticoagulation reversal by agent | NIHSS calculator with copy-to-note |
| Imaging, ASPECTS, perfusion thresholds | Platelet transfusion and ANNEXA-I | ASPECTS scorer |
| IV thrombolysis: disabling deficit, agent, dose | Surgery, ENRICH, ICH score | Tenecteplase / alteplase dosing |
| Contraindications in three tiers | | Last-known-well clock |
| Extended-window thrombolysis | | ICH score, ABC/2 |
| Thrombectomy by window and ASPECTS, basilar | | Filterable trial library |
| Post-reperfusion BP, sICH, angioedema | | |
| Supportive care, antithrombotics, complications | | |

Every recommendation carries its class of recommendation and level of evidence.

## Sources

Content is derived from published guidelines and peer-reviewed trials:

- Prabhakaran S, et al. **2026 Guideline for the Early Management of Patients With Acute Ischemic Stroke.** *Stroke.* 2026;57. [doi:10.1161/STR.0000000000000513](https://doi.org/10.1161/STR.0000000000000513)
- Greenberg SM, et al. **2022 Guideline for the Management of Patients With Spontaneous Intracerebral Hemorrhage.** *Stroke.* 2022;53:e282–e361. [doi:10.1161/STR.0000000000000407](https://doi.org/10.1161/STR.0000000000000407)
- Individual trials are cited in-app with DOIs in the trial library.

Content published after a guideline's literature cut-off (OPTION, ENRICH, ANNEXA-I) is labelled as such in-app and carries no class of recommendation.

**Sourcing transparency.** The ischaemic-stroke sections were written against the full text of the 2026 guideline, recommendation by recommendation. The 2022 ICH guideline is paywalled, so the class and level labels in the ICH and reversal sections came from published summaries rather than the source document; that is stated in-app at the point of use. If you have access and spot an error, please open an issue.

No figures, tables or extended text are reproduced from any copyrighted publication. Recommendations are facts about the literature, restated in the authors' own words.

## Deliberately not included

No institutional protocol, activation criterion, screening tool or workflow from any hospital or health system. Everything here is generic and published. If your local protocol differs, your local protocol governs.

## Disclaimer

**Educational reference only.** Not medical advice. It does not establish a standard of care, has not been validated as a clinical decision support system, and is not cleared by any regulatory authority as a medical device. The clinician remains solely responsible for every decision. Verify doses, thresholds and criteria against the primary literature, product labelling and local protocol before acting on them.

## Running it locally

No toolchain required — it is static files.

```bash
python3 -m http.server 8811
```

Then open http://localhost:8811. A service worker needs `http://` or `https://`, so open it through a server rather than as a `file://` URL if you want to test offline behaviour.

## Project layout

```
index.html                 all content — sections are plain semantic HTML
assets/css/app.css         theming (light/dark), layout, print styles
assets/js/app.js           routing, search index, calculators, pathfinder
manifest.webmanifest       PWA manifest
sw.js                      service worker — precache, cache-first
icons/                     app icons (SVG source + rasterised PNGs)
```

Search builds its index from the DOM at runtime, so **new content is searchable automatically** — there is no separate index to maintain.

## Contributing

Corrections are wanted, especially clinical ones.

- **A recommendation is misstated, or a number is wrong** → open an issue with the citation, or a PR editing the relevant section of `index.html`. Include the source and, where relevant, the class of recommendation.
- **A guideline has been updated** → open an issue naming the document and what changed.
- **Adding content** → keep the existing pattern: a table of recommendations with COR/LOE chips, then the trial evidence, then a `<p class="src">` naming the source section.

When changing content, bump `CACHE` in `sw.js` and `data-version` on the `<html>` element so installed copies refresh.

## Licence

- **Software** (HTML/CSS/JS): [MIT](LICENSE)
- **Clinical content**: [CC BY 4.0](LICENSE-CONTENT) — reuse, adapt for your own institution, translate it. Attribute the source.
