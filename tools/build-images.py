#!/usr/bin/env python3
"""Downscale and convert the ASPECTS reference plates to WebP.

The source plates are 1254x1254 PNGs of ~1.8 MB each. They display at about
400 CSS px, so 900 px covers a 2x screen with headroom, and WebP at q82 takes
the set from ~7.7 MB to ~350 KB. That matters: this is an offline PWA whose
service worker precaches every asset on install.

Run after replacing any source PNG:  python3 tools/build-images.py
"""
import os
from PIL import Image

SRC = os.path.join(os.path.dirname(__file__), '..', 'assets', 'images', 'aspects')
TARGET = 900
QUALITY = 82
PLATE_BG = (11, 26, 48)   # the plates' own navy, for flattening transparency

PLATES = [
    'aspects-ganglionic',
    'aspects-supraganglionic',
    'pc-aspects-supratentorial',
    'pc-aspects-infratentorial',
    'scoring-key',
]

def main():
    before = after = 0
    for name in PLATES:
        png = os.path.join(SRC, name + '.png')
        if not os.path.exists(png):
            print('  skip (missing): ' + name + '.png')
            continue
        im = Image.open(png)
        if im.mode == 'RGBA':
            flat = Image.new('RGB', im.size, PLATE_BG)
            flat.paste(im, mask=im.split()[3])
            im = flat
        else:
            im = im.convert('RGB')
        im = im.resize((TARGET, TARGET), Image.LANCZOS)
        webp = os.path.join(SRC, name + '.webp')
        im.save(webp, 'WEBP', quality=QUALITY, method=6)
        b, a = os.path.getsize(png), os.path.getsize(webp)
        before += b; after += a
        print('  %-30s %7.1f KB -> %6.1f KB' % (name, b / 1024, a / 1024))
    if before:
        print('  total %.1f KB -> %.1f KB (%.0fx smaller)' %
              (before / 1024, after / 1024, before / after))

if __name__ == '__main__':
    main()
