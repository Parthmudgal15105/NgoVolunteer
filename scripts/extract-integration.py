"""Read supplied files into private JSON; never print credentials or member data."""
import json, re, zipfile, os
from pathlib import Path
import xml.etree.ElementTree as ET
import openpyxl
from pypdf import PdfReader

base = Path(os.environ.get('NGO_SOURCE_DIR', 'private/source-files'))
out = Path('private/imports')
ns = {'t': 'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
      'x': 'urn:oasis:names:tc:opendocument:xmlns:text:1.0'}
def tables(file):
    root = ET.fromstring(zipfile.ZipFile(file).read('content.xml'))
    for table in root.findall('.//t:table', ns):
        rows = []
        for row in table.findall('t:table-row', ns):
            cells = []
            for cell in row:
                value = '\n'.join(''.join(p.itertext()) for p in cell.findall('x:p', ns)).strip()
                count = min(int(cell.get('{'+ns['t']+'}number-columns-repeated', '1')), 40)
                cells.extend([value] * count)
            rows.append(cells)
        yield table.get('{'+ns['t']+'}name'), rows

payload = {'sources': [], 'participation': [], 'pdfRoster': [], 'credentials': []}
for filename in ['2026 Drive List Database.ods', 'Certificate and department change (Responses).ods']:
    for sheet, rows in tables(base / filename):
        sheetkey = ('Drives / ' if filename.startswith('2026') else 'Requests / ') + sheet
        context = None
        for index, cells in enumerate(rows, 1):
            if not any(cells):
                continue
            payload['sources'].append({'sheet': sheetkey, 'row': index, 'cells': cells})
            if not filename.startswith('2026') or sheet in ['Jan26', 'Feb26', 'Dec25']:
                continue
            c = (cells + [''] * 14)[:14]
            if c[1].lower() == 'names' or c[0].lower().startswith('week'):
                context = None
                continue
            if c[7] and re.fullmatch(r'\d{1,2}/\d{1,2}/\d{2,4}', c[7]):
                context = {'date': c[7], 'location': c[5], 'title': c[6],
                           'time': c[8], 'responsibleHead': c[10]}
            if c[1] and c[3].lower() in ['present', 'absent']:
                payload['participation'].append({'name': c[1], 'department': c[2],
                    'status': c[3].lower(), 'defaults': c[4], 'remarks': c[12],
                    'sourceKey': sheetkey + ':' + str(index), 'context': context})

reader = PdfReader(base / 'Database 2026 - DATABASE 2026.pdf')
for page in reader.pages:
    for line in page.extract_text(extraction_mode='layout').splitlines():
        if '@' not in line:
            continue
        cells = re.split(r'\s{2,}', line.strip())
        email_index = next((i for i, c in enumerate(cells) if '@' in c), -1)
        if email_index > 2:
            cells = [' '.join(cells[:email_index-1])] + cells[email_index-1:]
        payload['pdfRoster'].append(cells)
        payload['sources'].append({'sheet': 'Final roster PDF', 'row': len(payload['pdfRoster']), 'cells': cells})
w = openpyxl.load_workbook(base / 'NGO-account-credentials.xlsx', read_only=True)
for row in list(w.active.values)[6:]:
    if row[3] and str(row[3]).startswith('wwc-'):
        payload['credentials'].append({'name': row[0], 'email': row[1], 'password': row[2], 'loginId': row[3]})
target = out / 'integration.json'
target.write_text(json.dumps(payload, ensure_ascii=False))
os.chmod(target, 0o600)
print(json.dumps({'sourceRows': len(payload['sources']), 'participationRows': len(payload['participation']),
                  'pdfRosterRows': len(payload['pdfRoster']), 'credentialRows': len(payload['credentials'])}))
