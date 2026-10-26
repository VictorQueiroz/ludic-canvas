"""Regenerate our MIT-licensed outline fixtures with fonttools==4.60.2, brotli==1.2.1."""
from pathlib import Path
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.ttLib import TTFont
from fontTools.designspaceLib import DesignSpaceDocument, AxisDescriptor, SourceDescriptor
from fontTools.varLib import build

out = Path(__file__).resolve().parents[2] / 'tests' / 'fixtures'
out.mkdir(exist_ok=True)
names = ['.notdef', 'space', 'question', 'A']

def contours(pen, name, weight):
    if name == 'space':
        return
    if name == 'A':
        points = [(80, 0), (300, 700), (520, 0), (440-weight, 0), (300, 470-weight), (160+weight, 0)]
    else:
        points = [(100, 0), (100, 700), (500, 700), (500, 0)]
    pen.moveTo(points[0])
    for point in points[1:]:
        pen.lineTo(point)
    pen.closePath()

def make(path, cff=False, weight=0):
    builder = FontBuilder(1000, isTTF=not cff)
    builder.setupGlyphOrder(names)
    builder.setupCharacterMap({code: 'space' if code == 32 else 'question' if code == 63 else 'A' for code in range(32, 127)})
    builder.setupHorizontalMetrics({name: (300 if name == 'space' else 600, 0) for name in names})
    builder.setupHorizontalHeader(ascent=800, descent=-200)
    builder.setupNameTable({'familyName': 'Ludic Fixture', 'styleName': 'Regular',
        'uniqueFontIdentifier': 'LudicFixture', 'fullName': 'Ludic Fixture', 'psName': 'LudicFixture'})
    builder.setupOS2(sTypoAscender=800, sTypoDescender=-200, usWinAscent=800, usWinDescent=200)
    builder.setupPost()
    if cff:
        glyphs = {}
        for name in names:
            pen = T2CharStringPen(300 if name == 'space' else 600, None)
            contours(pen, name, weight)
            glyphs[name] = pen.getCharString()
        builder.setupCFF('LudicFixture', {'FullName': 'Ludic Fixture', 'FamilyName': 'Ludic Fixture', 'Weight': 'Regular'}, glyphs, {})
    else:
        glyphs = {}
        for name in names:
            pen = TTGlyphPen(None)
            contours(pen, name, weight)
            glyphs[name] = pen.glyph()
        builder.setupGlyf(glyphs)
    builder.setupMaxp()
    builder.font.recalcTimestamp = False
    builder.font['head'].created = builder.font['head'].modified = 3800000000
    builder.save(path)

make(out / 'fixture.ttf')
make(out / 'fixture.otf', cff=True)
for source, prefix in [('fixture.ttf', 'fixture'), ('fixture.otf', 'fixture-cff')]:
    for flavor in ['woff', 'woff2']:
        font = TTFont(out / source, recalcTimestamp=False)
        font.flavor = flavor
        font.save(out / f'{prefix}.{flavor}')

masters = out / '.masters'
masters.mkdir(exist_ok=True)
document = DesignSpaceDocument()
axis = AxisDescriptor()
axis.name = 'Weight'; axis.tag = 'wght'; axis.minimum = 400; axis.default = 400; axis.maximum = 700
document.addAxis(axis)
for value, width in [(400, 0), (700, 75)]:
    path = masters / f'weight-{value}.ttf'
    make(path, weight=width)
    source = SourceDescriptor()
    source.path = str(path); source.location = {'Weight': value}; source.name = f'weight-{value}'
    source.copyInfo = source.copyLib = source.copyFeatures = value == 400
    document.addSource(source)
variable, _, _ = build(document)
variable.recalcTimestamp = False
variable.save(out / 'fixture-variable.ttf')
for path in masters.iterdir():
    path.unlink()
masters.rmdir()
