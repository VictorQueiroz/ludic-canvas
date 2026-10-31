#include "include/core/SkPixmap.h"
#include "include/core/SkSurface.h"
#include "renderer.hpp"
#include <iostream>
#include <stdexcept>

int main() {
  try {
    lc::SkiaRenderer renderer;
    auto surface = SkSurfaces::Raster(SkImageInfo::MakeN32Premul(32, 32));
    if (!surface)
      throw std::runtime_error("No raster surface");
    std::vector<uint32_t> white(16 * 16, SK_ColorWHITE);
    auto image =
        SkImages::RasterFromPixmapCopy(SkPixmap(SkImageInfo::MakeN32Premul(16, 16), white.data(), 64));
    std::unordered_map<uint32_t, sk_sp<SkImage>> images{{1, image}};
    auto pixel = [&](int x, int y) {
      SkPixmap pixels;
      if (!surface->peekPixels(&pixels))
        throw std::runtime_error("No pixels");
      return pixels.getColor(x, y);
    };
    auto check = [](bool ok) {
      if (!ok)
        throw std::runtime_error("Skia command pixel mismatch");
    };
    for (int op = 0; op <= 6; ++op) {
      surface->getCanvas()->clear(SK_ColorTRANSPARENT);
      std::vector<float> cmd(24);
      cmd[0] = op;
      auto *p = cmd.data() + 1;
      p[2] = p[3] = 16;
      p[4] = p[7] = 1;
      if (op == 1) {
        p[8] = 2;
        p[9] = 2;
      }
      if (op == 2) {
        p[10] = p[11] = 1;
      }
      if (op == 3 || op == 4) {
        p[10] = p[11] = 1;
        p[13] = op == 4 ? 4 : 0;
      }
      if (op == 5) {
        p[0] = p[1] = p[2] = p[3] = 8;
        p[8] = 3;
      }
      if (op == 6) {
        p[0] = 1;
        p[1] = p[3] = 8;
        p[2] = 15;
        p[8] = 2;
      }
      renderer.draw(surface->getCanvas(), cmd, {1}, images, 0);
      if (op == 1) {
        check(SkColorGetR(pixel(1, 8)) > 200);
        check(SkColorGetA(pixel(8, 8)) == 0);
      } else if (op == 2) {
        check(SkColorGetR(pixel(8, 1)) > 200);
        check(SkColorGetB(pixel(8, 14)) > 200);
      } else
        check(SkColorGetR(pixel(8, 8)) > 200);
      check(SkColorGetA(pixel(24, 24)) == 0);
    }
    surface->getCanvas()->clear(SK_ColorTRANSPARENT);
    std::vector<float> clipped(48);
    clipped[0] = 7;
    clipped[1] = 1;
    clipped[2] = clipped[3] = 5;
    clipped[4] = clipped[5] = 10;
    clipped[24] = 0;
    clipped[27] = clipped[28] = 32;
    clipped[29] = clipped[32] = 1;
    renderer.draw(surface->getCanvas(), clipped, {}, images, 0);
    check(SkColorGetR(pixel(8, 8)) > 200);
    check(SkColorGetA(pixel(2, 2)) == 0);
    // A rejected frame must not leave its clip/save stack on the caller's canvas.
    const auto saves = surface->getCanvas()->getSaveCount();
    auto rejected = clipped;
    rejected[24] = 3; // Image command, but no resource table entry.
    bool threw = false;
    try {
      renderer.draw(surface->getCanvas(), rejected, {}, images, 0);
    } catch (const std::runtime_error &) {
      threw = true;
    }
    if (!threw || surface->getCanvas()->getSaveCount() != saves)
      throw std::runtime_error("Rejected frame leaked canvas state");
    std::vector<float> next(clipped.begin() + 24, clipped.end());
    renderer.draw(surface->getCanvas(), next, {}, images, 0);
    check(SkColorGetR(pixel(2, 2)) > 200);
    std::cout << "Skia raster: all eight drawing operations passed pixel checks.\n";
    std::cout << "Skia error recovery: rejected frame restores canvas state.\n";
    return 0;
  } catch (const std::exception &error) {
    std::cerr << error.what() << '\n';
    return 1;
  }
}
