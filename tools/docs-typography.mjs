export function typographyGuide(code) {
  return `<h3>Kerning and explicit font fallback</h3><p>Register one to four MSDF/MTSDF faces. The first is the default. Set <code>fontFamily</code> to a registered name or an ordered array of one to four unique registered names. Each codepoint uses the first face containing it; system fonts are never consulted. Every atlas must include space and question mark. A codepoint absent from the complete chain renders as <code>?</code> from its primary face.</p>${code(
    `const ui = await createUI({
  canvas,
  fonts: [
    { name: 'interface', atlas: '/fonts/interface.png', metrics: '/fonts/interface.json' },
    { name: 'symbols', atlas: '/fonts/symbols.png', metrics: '/fonts/symbols.json' },
  ],
  onFontDiagnostic: (diagnostic) => console.warn(diagnostic.message),
});
ui.render(
  <Text style={{ fontFamily: ['interface', 'symbols'], fontSize: 24 }}>
    Café — Ready
  </Text>,
);`,
    'tsx',
    'Explicit font coverage',
  )}<p>Measurement, wrapping, alignment, ellipsis and drawing use the same selected glyph and face. Fallback faces share a baseline, and their metrics may enlarge a line. Atlas pair adjustments apply between adjacent glyphs from the same face, including across emphasis markers; line and face boundaries reset pair context. Set <code>fontKerning: 'none'</code> for unkerned spacing. Trailing spaces are excluded from line width.</p><p>The optional atlas <code>kerning</code> array uses <code>{ unicode1, unicode2, advance }</code> records. Advance is an additive pair adjustment in the same <code>metrics.emSize</code> units as glyph advances. Existing JSON without pairs stays supported. The CLI extracts legacy FreeType <code>kern</code> pairs; a GPOS-only font can export zero pairs. Rebuild old generated atlases to acquire available pairs.</p><p><code>onFontDiagnostic</code> is opt-in and runs in a microtask after synchronous layout. It reports the missing codepoint, ordered font names, replacement and a suggested charset/fallback fix; it does not include the original string. Reports are deduplicated per codepoint/ordered chain and capped at 1024 per root lifetime. Throwing callbacks go to <code>onError</code>. Add missing characters to the CLI charset/characters configuration and regenerate.</p><p>The bundled face covers Latin-1 and selected punctuation. Kerning and per-codepoint fallback do not implement bidi, grapheme-aware wrapping, GPOS positioning, complex-script/ligature shaping, editable text or automatic emoji fallback. Use native DOM text/editing for those requirements.</p>`;
}
