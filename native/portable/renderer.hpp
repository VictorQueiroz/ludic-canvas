#pragma once
#include "include/core/SkCanvas.h"
#include "include/core/SkImage.h"
#include "include/effects/SkRuntimeEffect.h"
#include <unordered_map>
#include <vector>

namespace lc {
class SkiaRenderer {
public:
  SkiaRenderer();
  void draw(SkCanvas *canvas, const std::vector<float> &commands, const std::vector<uint32_t> &resources,
            const std::unordered_map<uint32_t, sk_sp<SkImage>> &images, double time);

private:
  sk_sp<SkRuntimeEffect> glyph_, image_, glow_;
};
} // namespace lc
