"""Archivo + Archivo Black -> fonts/*.woff2 (self-hosted, subset).

Google's CDN served four files from two foreign origins, 100 KB, behind a
render-blocking stylesheet, and nothing at all offline. These two files cover the
same pages in 64 KB from our own origin.

The subset is latin + latin extended + the Romanian comma-below letters + the
punctuation and arrows the games actually print. Player names are typed by hand,
so the range stays wide enough for any Romanian or English keyboard; anything
outside it falls back to the system font, as it already did for the CJK photo
credits in data/cars.js.

Archivo is kept variable (weight 400 to 700, width pinned to 100), so one file
serves 400, 500, 600 and 700.

Run after changing the character set:
    pip install fonttools brotli
    python scripts/build_fonts.py
"""
import os
import subprocess
import sys
import tempfile
import urllib.request

RADACINA = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IESIRE = os.path.join(RADACINA, 'fonts')

SURSE = {
    'archivo-var.woff2': (
        'https://raw.githubusercontent.com/google/fonts/main/ofl/archivo/Archivo%5Bwdth%2Cwght%5D.ttf',
        ['wdth=100', 'wght=400:700'],
    ),
    'archivo-black.woff2': (
        'https://raw.githubusercontent.com/google/fonts/main/ofl/archivoblack/ArchivoBlack-Regular.ttf',
        [],
    ),
}

UNICODE = ','.join([
    'U+0000-00FF',            # latin de baza, cu diacriticele obisnuite
    'U+0100-017F',            # latin extins A: a breve, s si t cu sedila, ceh, maghiar
    'U+0180-024F',            # latin extins B: s si t cu virgula, formele romanesti corecte
    'U+02BB-02BC,U+02C6,U+02DA,U+02DC',
    'U+2010-2015,U+2018-201A,U+201C-201E,U+2020-2022,U+2026,U+2030,U+2039-203A,U+2044',
    'U+20AC,U+2122',          # euro, marca inregistrata
    'U+2190-2194',            # sagetile din butoanele de navigare si din axele Turometrului
    'U+2212',                 # minus adevarat, pentru diferentele de pret
    'U+FEFF,U+FFFD',
])

TRASATURI = 'kern,liga,clig,calt,locl'


def ruleaza(*args):
    subprocess.run([sys.executable, '-m', *args], check=True)


def main():
    os.makedirs(IESIRE, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for nume, (url, axe) in SURSE.items():
            sursa = os.path.join(tmp, nume.replace('.woff2', '.ttf'))
            print('iau', url)
            urllib.request.urlretrieve(url, sursa)
            if axe:
                fixat = os.path.join(tmp, 'fixat-' + os.path.basename(sursa))
                ruleaza('fontTools.varLib.instancer', sursa, *axe, '-o', fixat)
                sursa = fixat
            tinta = os.path.join(IESIRE, nume)
            ruleaza('fontTools.subset', sursa,
                    '--unicodes=' + UNICODE,
                    '--layout-features=' + TRASATURI,
                    '--flavor=woff2',
                    '--output-file=' + tinta)
            print(nume, os.path.getsize(tinta) // 1024, 'KB')


if __name__ == '__main__':
    main()
