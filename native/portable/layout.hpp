#pragma once
#include "../layout/style.hpp"
#include <functional>
#include <memory>
#include <stdexcept>
#include <unordered_map>

namespace lc {
// A context owns its configuration and nodes. Handles are monotonically allocated IDs,
// never truncated native pointers. A stale/freed handle fails deterministically.
class NativeLayout {
public:
  using Measure = std::function<YGSize(uint32_t, float, uint32_t, float, uint32_t)>;
  explicit NativeLayout(Measure measure) : measure_(std::move(measure)), config_(YGConfigNew()) {}
  ~NativeLayout() { dispose(); }
  NativeLayout(const NativeLayout &) = delete;
  NativeLayout &operator=(const NativeLayout &) = delete;
  uint32_t create() {
    ensure();
    if (next_ == UINT32_MAX)
      throw std::runtime_error("Layout handle space exhausted");
    const auto id = ++next_;
    auto entry = std::make_unique<Entry>();
    entry->owner = this;
    entry->node = YGNodeNewWithConfig(config_);
    YGNodeSetContext(entry->node, entry.get());
    nodes_.emplace(id, std::move(entry));
    return id;
  }
  YGNodeRef node(uint32_t id) {
    ensure();
    const auto found = nodes_.find(id);
    if (found == nodes_.end())
      throw std::runtime_error("Invalid layout handle");
    return found->second->node;
  }
  void free(uint32_t id) {
    auto n = node(id);
    YGNodeFree(n);
    nodes_.erase(id);
  }
  void measured(uint32_t id, uint32_t measurement) {
    auto n = node(id);
    nodes_.at(id)->measurement = measurement;
    YGNodeSetMeasureFunc(n, measurement ? [](YGNodeConstRef node, float w, YGMeasureMode wm, float h, YGMeasureMode hm) {
      const auto& e = *static_cast<Entry*>(YGNodeGetContext(node));
      return e.owner->measure_(e.measurement, w, wm, h, hm);
    } : static_cast<YGMeasureFunc>(nullptr));
    YGNodeSetNodeType(n, measurement ? YGNodeTypeText : YGNodeTypeDefault);
  }
  void setPointScale(float scale) {
    ensure();
    YGConfigSetPointScaleFactor(config_, scale);
  }
  void dispose() {
    if (!config_)
      return;
    // Detach before freeing so unordered destruction never follows a freed parent.
    for (auto &[id, entry] : nodes_)
      YGNodeRemoveAllChildren(entry->node);
    for (auto &[id, entry] : nodes_)
      YGNodeFree(entry->node);
    nodes_.clear();
    YGConfigFree(config_);
    config_ = nullptr;
    measure_ = {};
  }
  size_t nodeCount() const { return nodes_.size(); }

private:
  struct Entry {
    NativeLayout *owner;
    YGNodeRef node;
    uint32_t measurement = 0;
  };
  void ensure() const {
    if (!config_)
      throw std::runtime_error("Layout context destroyed");
  }
  Measure measure_;
  YGConfigRef config_;
  uint32_t next_ = 0;
  std::unordered_map<uint32_t, std::unique_ptr<Entry>> nodes_;
};
} // namespace lc
