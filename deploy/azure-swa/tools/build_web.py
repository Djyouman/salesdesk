#!/usr/bin/env python3
"""Build the hosted web app from the single-file SalesDesk page.

Usage: python3 build_web.py <path/to/salesdesk.html> <path/to/data dir> <out dir (app/)>

The page is published to claude.ai without a document skeleton (the viewer adds one). For a real host we
wrap it in <!doctype html> with the same head the viewer provides, and load shim.js first so
window.claude.use() resolves against the SalesDesk API instead of returning null.
"""
import os, re, shutil, sys

SKELETON_HEAD = ('<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8">'
                 '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
                 '<meta name="color-scheme" content="light dark">'
                 '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
                 'body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>'
                 '</head><body>')

def main(src, data_dir, out):
    html = open(src, encoding='utf-8').read()
    if html.lstrip().lower().startswith('<!doctype'):
        raise SystemExit('salesdesk.html already carries a document skeleton; adjust build_web.py')
    page = SKELETON_HEAD + '<script src="shim.js"></script>\n' + html + '\n</body></html>'
    os.makedirs(os.path.join(out, 'data'), exist_ok=True)
    open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(page)
    here = os.path.dirname(os.path.abspath(__file__))
    shutil.copy(os.path.join(here, '..', 'app-src', 'shim.js'), os.path.join(out, 'shim.js'))
    shutil.copy(os.path.join(here, '..', 'app-src', 'forbidden.html'), os.path.join(out, 'forbidden.html'))
    for f in ['history.json', 'orgs.json', 'contacts.json', 'plans.json', 'quality.json']:
        p = os.path.join(data_dir, f)
        if os.path.exists(p):
            shutil.copy(p, os.path.join(out, 'data', f))
    # live.json is deliberately NOT copied: on the web the live data comes from the API, not a snapshot.
    m = re.search(r"APP_VERSION='([^']+)'", html)
    print('built', out, 'version', m.group(1) if m else '?', 'bytes', len(page))

if __name__ == '__main__':
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    main(*sys.argv[1:])
