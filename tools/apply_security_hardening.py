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
print('SOURCE_CSP=PASS')
