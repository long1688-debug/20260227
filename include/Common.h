#pragma once

// Standard library headers (must be before windows.h)
#include <string>
#include <vector>
#include <map>
#include <memory>
#include <mutex>
#include <atomic>
#include <thread>
#include <chrono>
#include <fstream>
#include <sstream>
#include <iomanip>
#include <ctime>
#include <algorithm>

#pragma comment(lib, "ws2_32.lib")
#pragma comment(lib, "user32.lib")
#pragma comment(lib, "gdi32.lib")
#pragma comment(lib, "kernel32.lib")

namespace TrainingTeachingSystem {

// Common constants
namespace Config {
    constexpr int PORT = 8080;
    constexpr int MAX_CONNECTIONS = 1000;
    constexpr int BUFFER_SIZE = 4096;
    constexpr int HEARTBEAT_INTERVAL = 30;
    constexpr int HEARTBEAT_TIMEOUT = 90;
}

// Common types
// 重命名为ByteType以避免与C++17中的std::byte冲突
using ByteType = unsigned char;

} // namespace TrainingTeachingSystem
