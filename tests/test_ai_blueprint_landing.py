"""Static, offline smoke checks for AI Automation Blueprint landing page."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse, parse_qs
import unittest

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "ai-automation-blueprint.html"

class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = []
        self.links = []
        self.ids = set()
        self.lang_sections = set()
        self.images_without_alt = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        self.tags.append((tag, a))
        if 'id' in a:
            self.ids.add(a['id'])
        if tag == 'section' and a.get('lang'):
            self.lang_sections.add(a['lang'])
        if tag == 'a':
            self.links.append(a.get('href', ''))
        if tag == 'img' and 'alt' not in a:
            self.images_without_alt.append(a)

class BlueprintTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding='utf-8')
        cls.page = PageParser()
        cls.page.feed(cls.html)

    def test_accessibility_landmarks_and_languages(self):
        self.assertTrue(any(t == 'main' and a.get('id') == 'main' for t,a in self.page.tags))
        self.assertTrue(any(t == 'nav' and a.get('aria-label') for t,a in self.page.tags))
        self.assertEqual(self.page.lang_sections, {'es', 'en'})
        self.assertFalse(self.page.images_without_alt)
        self.assertIn('#main', self.page.links)

    def test_seo_and_unique_page_headings(self):
        self.assertEqual(sum(t == 'h1' for t,_ in self.page.tags), 1)
        self.assertTrue(any(t == 'meta' and a.get('name') == 'description' and a.get('content') for t,a in self.page.tags))
        self.assertTrue(any(t == 'link' and a.get('rel') == 'canonical' and a.get('href') == 'https://jadeltechrd.com/ai-automation-blueprint.html' for t,a in self.page.tags))
        self.assertTrue(any(t == 'title' for t,_ in self.page.tags))

    def test_local_links_and_verified_references(self):
        for href in self.page.links:
            if href.startswith('#'):
                self.assertIn(href[1:], self.page.ids)
            elif href.startswith('/'):
                path = urlparse(href).path
                self.assertTrue((ROOT / (path.lstrip('/') or 'index.html')).is_file(), href)
            else:
                self.assertIn(href, {
                    'https://github.com/jadeldiaz01-png/support-tickets',
                    'https://github.com/jadeldiaz01-png/Agentic-Al-Brief'
                })
        intake = [u for u in self.page.links if u.startswith('/solicitar-proyecto.html?')]
        self.assertEqual(len(intake), 2)
        expected_attribution = {
            'offer_id': 'automation_blueprint',
            'utm_source': 'website',
            'utm_medium': 'organic',
            'utm_campaign': 'automation_blueprint',
            'utm_content': 'automation_blueprint',
        }
        for href in intake:
            params = parse_qs(urlparse(href).query)
            self.assertEqual(params.get('services'), ['architecture'])
            for key, value in expected_attribution.items():
                self.assertEqual(params.get(key), [value])
        for script_name in ('revenue-funnel.js', 'ga4-loader.js'):
            script = (ROOT / script_name).read_text(encoding='utf-8')
            for key, value in expected_attribution.items():
                allowlist = next(
                    (line for line in script.splitlines() if line.strip().startswith(f'{key}: new Set(')),
                    '',
                )
                self.assertIn(f'"{value}"', allowlist, f'{script_name} must allow {key}={value}')

    def test_fixed_scope_proposal_remains_quote_gated(self):
        self.assertIn('Paquete base propuesto: US$250 para un solo proceso empresarial', self.html)
        self.assertIn('Proposed starter package: US$250 for one business workflow', self.html)
        self.assertIn('El encaje, los plazos y las condiciones se revisan antes de emitir la cotización', self.html)
        self.assertIn('Solo después de aceptar una cotización', self.html)
        self.assertIn('Only after a quote is accepted', self.html)
        self.assertNotIn('paypal.com/ncp/payment/', self.html.lower())
        self.assertNotIn('https://www.paypal.com/checkoutnow', self.html.lower())
        self.assertEqual(len([x for x in self.page.links if x.startswith('/solicitar-proyecto.html?')]), 2)

    def test_no_misleading_production_claim(self):
        self.assertIn('no un agente entregado en producción', self.html)
        self.assertIn('not a production-ready agent', self.html)

if __name__ == '__main__':
    unittest.main()
