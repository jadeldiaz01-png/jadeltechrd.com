from pathlib import Path

INDEX = Path('index.html')
text = INDEX.read_text(encoding='utf-8')

anchor = '  <meta name="theme-color" content="#0b1220">\n'
security_meta = '''  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; media-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; upgrade-insecure-requests">\n  <meta name="referrer" content="strict-origin-when-cross-origin">\n'''
if 'http-equiv="Content-Security-Policy"' not in text:
    if anchor not in text:
        raise SystemExit('theme-color anchor missing; refusing index mutation')
    text = text.replace(anchor, anchor + security_meta, 1)

if '<script src="/app.js" defer></script>' not in text:
    raise SystemExit('expected same-origin app.js script missing')
if 'http://' in text.replace('http-equiv', ''):
    raise SystemExit('insecure HTTP reference detected in source')

INDEX.write_text(text, encoding='utf-8')

pins = {
    'actions/checkout@v4': 'actions/checkout@11d5960a326750d5838078e36cf38b85af677262',
    'actions/configure-pages@v5': 'actions/configure-pages@983d7736d9b0ae728b81ab479565c72886d7745b',
    'actions/upload-pages-artifact@v3': 'actions/upload-pages-artifact@56afc609e74202658d3ffba0e8f6dda462b719fa',
    'actions/deploy-pages@v4': 'actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e',
}
for workflow in Path('.github/workflows').glob('*.y*ml'):
    body = workflow.read_text(encoding='utf-8')
    for old, new in pins.items():
        body = body.replace(old, new)
    workflow.write_text(body, encoding='utf-8')

print('SOURCE_CSP=PASS')
print('KNOWN_ACTION_PINS=APPLIED')
