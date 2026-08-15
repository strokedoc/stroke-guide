# ASPECTS image set

Educational scoring-reference assets for the Acute Stroke Guide. These images
are schematics, not diagnostic scans or a substitute for reviewing the complete
CT/CTA/MRI examination.

## Files

- `aspects-ganglionic.png` — current corrected plate for C, L, IC, I, M1, M2,
  and M3. The caudate head hugs the frontal horn; the internal capsule is a
  narrow boomerang medial to the lentiform nucleus; and the insular ribbon lies
  lateral to the lentiform nucleus along the Sylvian fissure.
- `aspects-supraganglionic.png` — M4, M5, and M6.
- `pc-aspects-supratentorial.png` — paired thalami and PCA territories.
- `pc-aspects-infratentorial.png` — paired cerebellar hemispheres, midbrain,
  and pons.
- `scoring-key.png` / `scoring-key.svg` — combined point-deduction key.
  **Not shipped in the app**: it restates the region lists and point weights
  the in-app scorer already carries, and two sources for one fact is how they
  drift apart. Kept here for print or teaching use.

## Build

These PNGs are the masters and are not served. `tools/build-images.py`
downscales them to 900 px and writes the `.webp` the app actually loads —
about 350 KB for the set against 8 MB of PNG, which matters because the
service worker precaches every shipped asset. Re-run it after replacing any
master:

```
python3 tools/build-images.py
```

Superseded revisions are not kept alongside the current plate; git history is
the archive.

## Scoring represented

Both scores begin at 10.

- ASPECTS: subtract 1 for each affected region (C, L, IC, I, M1–M6).
- PC-ASPECTS: subtract 1 for each affected left/right thalamus, PCA territory,
  or cerebellar hemisphere; subtract 2 for any involvement of the midbrain and
  2 for any involvement of the pons.

## Sources checked

- Pexman JHW et al. *Use of the Alberta Stroke Program Early CT Score
  (ASPECTS) for Assessing CT Scans in Patients with Acute Stroke.* AJNR.
  https://pmc.ncbi.nlm.nih.gov/articles/PMC7974585/
- Barber PA et al. *Validity and reliability of a quantitative computed
  tomography score in predicting outcome of hyperacute stroke before
  thrombolytic therapy.* Lancet. 2000.
  https://pubmed.ncbi.nlm.nih.gov/10905241/
- Puetz V et al. *Extent of hypoattenuation on CT angiography source images
  predicts functional outcome in patients with basilar artery occlusion.*
  Stroke. 2008. https://pubmed.ncbi.nlm.nih.gov/18617663/

## Generation note

The four anatomical plates were generated with the built-in image-generation
workflow from prompts specifying the exact levels, regions, labels, point
weights, dark navy clinical palette, and a no-pathology/no-identifiers
constraint. The scoring key was typeset deterministically as SVG and rendered
to PNG to prevent label or weight errors.
