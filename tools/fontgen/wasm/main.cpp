#include <cstdio>
#include <cstdlib>
#include <string>
#include <vector>
#include <ft2build.h>
#include FT_FREETYPE_H
#include FT_MULTIPLE_MASTERS_H
#include <msdfgen.h>
#include <msdfgen-ext.h>
#include <msdf-atlas-gen/msdf-atlas-gen.h>

namespace {
int fail(const char* message) { std::fprintf(stderr, "%s\n", message); return 1; }
struct FontOwner {
  FT_Library library = nullptr;
  FT_Face face = nullptr;
  msdfgen::FontHandle* handle = nullptr;
  ~FontOwner() {
    if (handle) msdfgen::destroyFont(handle);
    if (face) FT_Done_Face(face);
    if (library) FT_Done_FreeType(library);
  }
};
}

int main(int argc, char** argv) {
  if (argc < 7) return fail("Expected font, charset, raw output, metrics output, size and distance range");
  FontOwner owner;
  if (FT_Init_FreeType(&owner.library)) return fail("Could not initialize FreeType");
  if (FT_New_Face(owner.library, argv[1], 0, &owner.face)) return fail("Could not decode outline font (TTF/OTF/WOFF/WOFF2)");
  for (int i = 7; i < argc; ++i) {
    const std::string setting(argv[i]);
    const auto equals = setting.find('=');
    if (equals != 4) return fail("Invalid font variation axis tag");
    FT_MM_Var* axes = nullptr;
    if (FT_Get_MM_Var(owner.face, &axes) || !axes) return fail("Unknown or unsupported font variation axis");
    const auto tag = FT_MAKE_TAG(setting[0], setting[1], setting[2], setting[3]);
    std::vector<FT_Fixed> coordinates(axes->num_axis);
    bool found = false;
    if (!FT_Get_Var_Design_Coordinates(owner.face, axes->num_axis, coordinates.data())) {
      for (FT_UInt axis = 0; axis < axes->num_axis; ++axis) if (axes->axis[axis].tag == tag) {
        const double value = std::strtod(setting.c_str()+equals+1, nullptr) * 65536.0;
        if (value < axes->axis[axis].minimum || value > axes->axis[axis].maximum) {
          FT_Done_MM_Var(owner.library, axes);
          return fail("Font variation axis value is outside the font's range");
        }
        coordinates[axis] = static_cast<FT_Fixed>(value);
        found = true;
        break;
      }
    }
    const FT_Error changed = found ? FT_Set_Var_Design_Coordinates(owner.face, axes->num_axis, coordinates.data()) : 1;
    FT_Done_MM_Var(owner.library, axes);
    if (!found || changed) return fail("Unknown or unsupported font variation axis");
  }
  owner.handle = msdfgen::adoptFreetypeFont(owner.face);
  if (!owner.handle) return fail("Could not import outline font");
  msdf_atlas::Charset charset;
  if (!charset.load(argv[2]) || charset.empty() || charset.size() > 16384)
    return fail("Invalid charset, or more than 16384 requested codepoints");
  std::vector<msdf_atlas::GlyphGeometry> glyphs;
  msdf_atlas::FontGeometry geometry(&glyphs);
  // FreeType exposes legacy kern-table pairs. GPOS positioning needs a shaping engine.
  const int loaded = geometry.loadCharset(owner.handle, 1.0, charset, false, FT_HAS_KERNING(owner.face));
  if (loaded <= 0 || !geometry.getGlyph(msdf_atlas::unicode_t(63))) return fail("Font must provide outline glyphs and a '?' fallback");
  if (static_cast<std::size_t>(loaded) != charset.size()) {
    std::fprintf(stderr, "Missing codepoints:");
    for (const auto codepoint : charset) if (!geometry.getGlyph(codepoint)) std::fprintf(stderr, " U+%04X", codepoint);
    std::fprintf(stderr, "\n");
    return 2;
  }
  if (geometry.getKerning().size() > 262144) return fail("More than 262144 kerning pairs");
  for (auto& glyph : glyphs) glyph.edgeColoring(msdfgen::edgeColoringInkTrap, 3.0, 0);
  msdf_atlas::TightAtlasPacker packer;
  packer.setDimensionsConstraint(msdf_atlas::DimensionsConstraint::POWER_OF_TWO_SQUARE);
  packer.setScale(std::strtod(argv[5], nullptr));
  packer.setPixelRange(std::strtod(argv[6], nullptr));
  packer.setMiterLimit(1.0);
  if (packer.pack(glyphs.data(), static_cast<int>(glyphs.size())) != 0) return fail("Could not pack requested glyphs");
  int width = 0, height = 0;
  packer.getDimensions(width, height);
  if (width <= 0 || height <= 0 || width > 8192 || height > 8192) return fail("Atlas dimensions must fit within 8192 x 8192");
  using Generator = msdf_atlas::ImmediateAtlasGenerator<float, 4, msdf_atlas::mtsdfGenerator,
      msdf_atlas::BitmapAtlasStorage<msdf_atlas::byte, 4>>;
  Generator generator(width, height);
  generator.setThreadCount(1);
  msdf_atlas::GeneratorAttributes attributes;
  attributes.config.overlapSupport = true;
  attributes.scanlinePass = true;
  generator.setAttributes(attributes);
  generator.generate(glyphs.data(), static_cast<int>(glyphs.size()));
  auto bitmap = generator.atlasStorage().operator msdfgen::BitmapConstSection<msdf_atlas::byte, 4>();
  bitmap.reorient(msdfgen::Y_DOWNWARD);
  std::FILE* output = std::fopen(argv[3], "wb");
  if (!output) return fail("Could not open atlas output");
  bool written = true;
  for (int y = 0; y < height; ++y)
    if (std::fwrite(bitmap(0, y), 4, static_cast<std::size_t>(width), output) != static_cast<std::size_t>(width)) written = false;
  if (std::fclose(output) != 0 || !written) return fail("Could not write atlas output");
  msdf_atlas::JsonAtlasMetrics metrics{};
  metrics.distanceRange = packer.getPixelRange();
  metrics.size = packer.getScale(); metrics.width = width; metrics.height = height;
  metrics.yDirection = msdfgen::Y_DOWNWARD;
  if (!msdf_atlas::exportJSON(&geometry, 1, msdf_atlas::ImageType::MTSDF, metrics, argv[4], true))
    return fail("Could not write font metrics");
  return 0;
}
