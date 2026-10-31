#include "renderer.hpp"
#include "include/core/SkColor.h"
#include "include/core/SkRRect.h"
#include "include/core/SkSamplingOptions.h"
#include "include/effects/SkDashPathEffect.h"
#include "include/effects/SkGradient.h"
#include <cmath>
#include <stdexcept>

namespace lc {
static sk_sp<SkRuntimeEffect> effect(const char *source) {
  auto result = SkRuntimeEffect::MakeForShader(SkString(source));
  if (!result.effect)
    throw std::runtime_error(result.errorText.c_str());
  return result.effect;
}
SkiaRenderer::SkiaRenderer() {
  glyph_ = effect(R"SK(uniform shader atlas; uniform float4 color; uniform float range; uniform float weight;
half4 main(float2 p) { float3 s = atlas.eval(p).rgb; float median = max(min(s.r,s.g),min(max(s.r,s.g),s.b)); return half4(color * clamp((median - 0.5 + weight) * range + 0.5, 0.0, 1.0)); })SK");
  image_ =
      effect(R"SK(uniform shader image; uniform float4 tint; uniform float desaturate; uniform float darken;
half4 main(float2 p) { half4 c = image.eval(p); float gray = dot(c.rgb, float3(0.299,0.587,0.114)); c.rgb = mix(c.rgb, half3(gray), desaturate) * (1.0 - darken); return c * half4(tint); })SK");
  glow_ = effect(
      R"SK(uniform float2 center; uniform float2 radius; uniform float4 color; uniform float falloff; uniform float pulse;
half4 main(float2 p) { float2 q = (p-center)/radius; float r2 = dot(q,q); float a = exp(-r2*falloff)*(1.0-smoothstep(0.7,1.0,sqrt(r2))); return half4(color*a*pulse); })SK");
}
static SkColor4f color(const float *c) {
  const auto a = c[3];
  return {a > 0 ? c[0] / a : 0, a > 0 ? c[1] / a : 0, a > 0 ? c[2] / a : 0, a};
}
void SkiaRenderer::draw(SkCanvas *canvas, const std::vector<float> &commands,
                        const std::vector<uint32_t> &resources,
                        const std::unordered_map<uint32_t, sk_sp<SkImage>> &images, double time) {
  constexpr size_t stride = 24;
  if (commands.size() % stride)
    throw std::runtime_error("Invalid draw command buffer");
  const auto base = canvas->save();
  canvas->save();
  for (size_t i = 0; i < commands.size(); i += stride) {
    const auto *p = &commands[i + 1];
    for (size_t j = 0; j < stride; ++j)
      if (!std::isfinite(commands[i + j]))
        throw std::runtime_error("Non-finite drawing command");
    if (commands[i] < 0 || commands[i] > 7 || std::floor(commands[i]) != commands[i])
      throw std::runtime_error("Unsupported drawing command");
    const auto op = static_cast<int>(commands[i]);
    if (op == 7) {
      canvas->restore();
      canvas->save();
      if (p[0])
        canvas->clipRect(SkRect::MakeXYWH(p[1], p[2], p[3], p[4]));
      continue;
    }
    SkPaint paint;
    paint.setAntiAlias(true);
    paint.setColor4f(color(p + 4));
    auto rect = SkRect::MakeXYWH(p[0], p[1], std::max(0.f, p[2]), std::max(0.f, p[3]));
    switch (op) {
    case 0:
      canvas->drawRoundRect(rect, p[8], p[8], paint);
      break;
    case 1: {
      if (p[9] <= 0)
        break;
      paint.setStyle(SkPaint::kStroke_Style);
      paint.setStrokeWidth(p[9]);
      rect.inset(p[9] / 2, p[9] / 2);
      canvas->drawRoundRect(rect, std::max(0.f, p[8] - p[9] / 2), std::max(0.f, p[8] - p[9] / 2), paint);
      break;
    }
    case 2: {
      const SkPoint points[2] = {{p[0], p[1]}, {p[0], p[1] + p[3]}};
      const SkColor4f colors[2] = {color(p + 4), color(p + 8)};
      paint.setColor(SK_ColorWHITE);
      paint.setShader(
          SkShaders::LinearGradient(points, SkGradient(SkGradient::Colors(colors, SkTileMode::kClamp),
                                                       {SkGradient::Interpolation::InPremul::kYes})));
      canvas->drawRoundRect(rect, p[12], p[12], paint);
      break;
    }
    case 3:
    case 4: {
      if (p[12] < 0 || p[12] >= resources.size() || std::floor(p[12]) != p[12])
        throw std::runtime_error("Unknown renderer resource");
      const auto index = static_cast<size_t>(p[12]);
      if (index >= resources.size() || !images.contains(resources[index]))
        throw std::runtime_error("Unknown renderer resource");
      auto image = images.at(resources[index]);
      if (p[2] <= 0 || p[3] <= 0 || p[8] == p[10] || p[9] == p[11])
        break;
      // Map image pixel coordinates into the destination, preserving UV flips.
      const float sx = p[2] / ((p[10] - p[8]) * image->width()),
                  sy = p[3] / ((p[11] - p[9]) * image->height());
      SkMatrix matrix;
      matrix.setScaleTranslate(sx, sy, p[0] - p[8] * image->width() * sx, p[1] - p[9] * image->height() * sy);
      SkRuntimeShaderBuilder builder(op == 4 ? glyph_ : image_);
      if (op == 4) {
        builder.child("atlas") = image->makeRawShader(SkTileMode::kClamp, SkTileMode::kClamp,
                                                      SkSamplingOptions(SkFilterMode::kLinear), &matrix);
        builder.uniform("color") = SkV4{p[4], p[5], p[6], p[7]};
        builder.uniform("range") = p[13];
        builder.uniform("weight") = p[14];
      } else {
        builder.child("image") = image->makeShader(SkTileMode::kClamp, SkTileMode::kClamp,
                                                   SkSamplingOptions(SkFilterMode::kLinear), &matrix);
        builder.uniform("tint") = SkV4{p[4], p[5], p[6], p[7]};
        builder.uniform("desaturate") = p[14];
        builder.uniform("darken") = p[15];
      }
      paint.setColor(SK_ColorWHITE);
      paint.setShader(builder.makeShader());
      if (op == 3)
        canvas->drawRoundRect(rect, p[13], p[13], paint);
      else
        canvas->drawRect(rect, paint);
      break;
    }
    case 5: {
      if (p[2] <= 0 || p[3] <= 0)
        break;
      SkRuntimeShaderBuilder builder(glow_);
      builder.uniform("center") = SkV2{p[0], p[1]};
      builder.uniform("radius") = SkV2{p[2], p[3]};
      builder.uniform("color") = SkV4{p[4], p[5], p[6], p[7]};
      builder.uniform("falloff") = p[8];
      builder.uniform("pulse") = float(1 + p[9] * std::sin(time * 2.2 + p[10]));
      paint.setColor(SK_ColorWHITE);
      paint.setShader(builder.makeShader());
      canvas->drawRect(SkRect::MakeXYWH(p[0] - p[2], p[1] - p[3], p[2] * 2, p[3] * 2), paint);
      break;
    }
    case 6: {
      paint.setStyle(SkPaint::kStroke_Style);
      paint.setStrokeCap(SkPaint::kRound_Cap);
      paint.setStrokeWidth(p[8]);
      if (p[9] > 0) {
        const float intervals[2] = {p[9] * .55f, p[9] * .45f};
        paint.setPathEffect(SkDashPathEffect::Make(intervals, -time * p[10]));
      }
      canvas->drawLine(p[0], p[1], p[2], p[3], paint);
      break;
    }
    default:
      throw std::runtime_error("Unsupported drawing command");
    }
  }
  canvas->restoreToCount(base);
}
} // namespace lc
