# Contributing

Clinical corrections are the most valuable contribution here. If something in
this guide misstates a guideline recommendation or misreports a trial result,
please say so — with a citation.

## Reporting a clinical error

Open an issue containing:

1. The section and the exact text as it currently reads.
2. What it should say.
3. The source: guideline section number, or the trial with its DOI.

## Making a change

1. Content lives in `index.html`. Sections are plain semantic HTML —
   there is no build step and no framework.
2. Follow the existing pattern for a topic:
   - a `<div class="tablewrap"><table>` of recommendations, each with a
     `<span class="cor cor-1">` class chip and a `<span class="loe">` level,
   - the supporting trial evidence,
   - a closing `<p class="src">` naming the source section or DOI.
3. Search indexes the DOM at runtime, so new content becomes searchable with
   no extra work.
4. If you add a section, add a matching link in the `.sidebar` nav and give the
   section a `data-title`.
5. Bump `CACHE` in `sw.js` and `data-version` on `<html>` so installed copies
   pick the change up.

## Editorial rules

- **Cite everything clinical.** A recommendation without a source does not go in.
- **Carry the class of recommendation.** If a statement has a COR/LOE in the
  source, show it. If it does not — because it postdates a guideline, or is
  practical advice — say so explicitly rather than implying strength it lacks.
- **Nothing site-specific.** No institutional protocol, activation criterion,
  screening tool or workflow. This is a public reference; local practice
  belongs in local documents.
- **State limits honestly.** Where a recommendation rests on a trial that
  excluded a group (age, comorbidity, prestroke disability), say so at the
  point of use. Clinicians act on the caveats.
- **No new dependencies.** The app must stay a single page of static files
  that works offline with no network calls.

## Accessibility and offline

Changes should keep the app usable with a keyboard, readable in both light and
dark themes, legible on a phone, and fully functional with no network.
