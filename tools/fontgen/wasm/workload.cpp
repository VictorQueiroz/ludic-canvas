#include <msdf-atlas-gen/Workload.h>

namespace msdf_atlas {
Workload::Workload() : chunks(0) {}
Workload::Workload(const std::function<bool(int, int)>& fn, int count) : workerFunction(fn), chunks(count) {}
bool Workload::finishSequential() {
  for (int i = 0; i < chunks; ++i) if (!workerFunction(i, 0)) return false;
  return true;
}
bool Workload::finishParallel(int) { return finishSequential(); }
bool Workload::finish(int) { return finishSequential(); }
}  // namespace msdf_atlas
