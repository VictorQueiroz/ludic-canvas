#include "engine.hpp"
#include <iostream>
#include <thread>

int main(int argc, const char **argv) {
  try {
    if (argc != 2)
      throw std::runtime_error("Usage: ludic-contract contract.hbc");
    lc::Engine engine;
    engine.load(argv[1]);
    const auto deadline = engine.now() + 10000;
    while (!engine.runtime().global().getProperty(engine.runtime(), "__ludicTestDone").isBool()) {
      if (engine.now() > deadline)
        throw std::runtime_error("Native contract timed out");
      engine.pump();
      std::this_thread::sleep_for(std::chrono::milliseconds(1));
    }
    if (!engine.runtime().global().getProperty(engine.runtime(), "__ludicTestDone").getBool())
      return 1;
    if (engine.layoutCount() || engine.nodeCount())
      throw std::runtime_error("Native layout ownership leaked");
    engine.shutdown();
    return engine.errors.empty() ? 0 : 1;
  } catch (const std::exception &error) {
    std::cerr << error.what() << '\n';
    return 1;
  }
}
