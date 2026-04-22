# 📦 项目文件归档说明

## 🛡️ 防误用保护机制

**重要**: 为防止未来调试时误调用旧版代码，已实施四重防护：

1. ✅ **运行时警告**: `video.js.deprecated` 包含强烈的 `console.error` 警告
2. ✅ **自动化检查**: `npm run check:deprecated` 在开发/构建前自动扫描
3. ✅ **文档说明**: `stores/index.js` 中有明确的废弃注释
4. ✅ **流程集成**: 检查脚本已集成到 `predev` 和 `prebuild` hook

详见: [DEPRECATED_PROTECTION.md](./DEPRECATED_PROTECTION.md)

---

## 📂 目录结构

```
F:\20260227\
├── ARCHIVE/                          # 🗄️ 归档目录
│   ├── README.md                     # 本文件
│   ├── DEPRECATED_PROTECTION.md      # 🛡️ 防误用保护机制说明
│   ├── deprecated_stores/            # 废弃的Store文件
│   │   └── video.js.deprecated       # 旧版视频状态管理Store（已废弃）
│   └── migration_docs/               # 迁移相关文档
│       ├── MIGRATION_GUIDE_VIDEO_SYNC.md      # 详细迁移指南
│       ├── CLEANUP_REPORT_VIDEO_STORE.md      # 清理报告
│       └── USEVIDEOSYNC_QUICK_REF.md          # useVideoSync快速参考
│
├── tauri-app/                        # 🚀 主应用目录（新版系统）
│   ├── src/
│   │   ├── composables/
│   │   │   └── useVideoSync.js       # ✅ 新版：统一视频状态管理
│   │   ├── components/
│   │   │   ├── TeacherWindow.vue     # ✅ 已迁移
│   │   │   ├── EnhancedTeacherWindow.vue  # ✅ 已迁移
│   │   │   ├── VideoGrid.vue         # ✅ 已迁移
│   │   │   └── EnhancedVideoGrid.vue # ✅ 已迁移
│   │   └── stores/
│   │       ├── index.js              # ✅ 已移除useVideoStore导出
│   │       └── ...                   # 其他Store
│   └── ...
│
└── ...                               # 其他项目文件
```

---

## 🏷️ 文件分类说明

### ✅ 新版系统（当前使用）

**核心文件**:
- `tauri-app/src/composables/useVideoSync.js` - 统一的视频状态管理Composable
- 所有组件已通过解构使用 `useVideoSync()`

**特点**:
- 单一数据源，状态一致
- 提供原子操作方法，禁止直接修改数组
- 支持布局配置保存/恢复
- 完整的录制状态管理

**使用方式**:
```javascript
import { useVideoSync } from '@/composables/useVideoSync'

const { 
  setLayout, 
  setCanvasSource, 
  removeSource,
  // ... 其他方法
} = useVideoSync()
```

---

### ⚠️ 旧版系统（已废弃）

**归档位置**: `ARCHIVE/deprecated_stores/`

**废弃文件**:
- `video.js.deprecated` - 旧的Pinia Store实现

**废弃原因**:
1. 与useVideoSync并存导致状态不一致
2. 多套系统互不感知，引发各种Bug
3. 直接操作响应式数组，违反Vue最佳实践

**迁移时间**: 2026-04-23

---

### 📚 迁移文档

**归档位置**: `ARCHIVE/migration_docs/`

**文档清单**:

1. **MIGRATION_GUIDE_VIDEO_SYNC.md**
   - 详细的迁移指南
   - API对照表
   - 使用示例和最佳实践
   - 测试清单

2. **CLEANUP_REPORT_VIDEO_STORE.md**
   - 完整的清理报告
   - 验证结果
   - 遗留说明

3. **USEVIDEOSYNC_QUICK_REF.md**
   - 快速参考卡片
   - 常用API速查
   - 禁止操作说明

---

## 🔄 版本对比

| 特性 | 旧版 (useVideoStore) | 新版 (useVideoSync) |
|------|---------------------|-------------------|
| 架构模式 | Pinia Store | Composable |
| 状态一致性 | ❌ 多套系统，不一致 | ✅ 单一数据源 |
| 数组操作 | ❌ 允许直接push/splice | ✅ 必须使用原子方法 |
| 维护成本 | ❌ 需维护两套API | ✅ 单一Composable |
| 类型安全 | ⚠️ 一般 | ✅ 更好（TS友好） |
| 组合性 | ❌ 受限于Pinia | ✅ 可在任何地方使用 |

---

## 📋 归档原则

### 什么文件会被归档？

1. **废弃的代码文件**
   - 已被新方案完全替代
   - 不再被任何活跃代码引用
   - 保留作为历史参考或紧急回滚

2. **迁移相关文档**
   - 迁移指南和对照表
   - 清理报告和验证结果
   - 快速参考和使用说明

3. **临时备份文件**
   - `.deprecated` 后缀的文件
   - `.backup` 或 `.old` 后缀的文件

### 什么文件不会被归档？

1. **当前使用的代码**
   - 所有活跃的 `.vue`, `.js`, `.ts` 文件
   - 正在开发的模块

2. **核心配置文件**
   - `package.json`, `vite.config.js`
   - `tauri.conf.json`, `Cargo.toml`

3. **构建产物**
   - `node_modules/`
   - `dist/`, `target/`

---

## 🔍 如何查找文件？

### 查找新版代码
```bash
# 搜索 useVideoSync 的使用
grep -r "useVideoSync" tauri-app/src/

# 查找所有Composable
ls tauri-app/src/composables/
```

### 查找旧版归档
```bash
# 查看归档的废弃文件
ls ARCHIVE/deprecated_stores/

# 查看迁移文档
ls ARCHIVE/migration_docs/
```

### 检查是否有遗漏
```bash
# 搜索是否还有useVideoStore的引用
grep -r "useVideoStore" tauri-app/src/ --include="*.vue" --include="*.js"

# 应该返回空结果（除了注释）
```

---

## 📅 归档历史

| 日期 | 操作 | 说明 |
|------|------|------|
| 2026-04-23 | 创建ARCHIVE目录 | 完成useVideoStore到useVideoSync的迁移 |
| 2026-04-23 | 归档video.js | 重命名为.deprecated并移动 |
| 2026-04-23 | 归档迁移文档 | 整理3份文档到migration_docs |

---

## 🗑️ 何时可以彻底删除归档文件？

### 建议保留期限
- **短期** (1-3个月): 保留所有归档文件，观察稳定性
- **中期** (3-6个月): 如无问题，可删除废弃代码文件
- **长期** (6个月+): 可考虑删除迁移文档（已合并到主文档）

### 删除条件
1. ✅ 新系统稳定运行至少3个月
2. ✅ 无任何用户反馈相关问题
3. ✅ 团队所有成员熟悉新系统
4. ✅ 已有更完善的文档覆盖

### 删除步骤
```bash
# 1. 确认无引用
grep -r "video.js.deprecated" .

# 2. 备份到外部存储（可选）
# 3. 删除归档目录
rm -rf ARCHIVE/
```

---

## 💡 最佳实践

### 对于开发者

1. **始终使用新版系统**
   - 导入 `useVideoSync` 而非 `useVideoStore`
   - 使用原子方法而非直接操作数组

2. **查阅归档文档**
   - 遇到问题先查看迁移指南
   - 参考快速了解API用法

3. **不要恢复旧文件**
   - 除非遇到无法解决的紧急情况
   - 恢复后应立即报告并重新评估

### 对于维护者

1. **定期清理归档**
   - 每6个月审查一次归档文件
   - 删除已过时且无参考价值的内容

2. **保持文档更新**
   - 如有新的迁移，及时更新归档
   - 确保README反映最新状态

3. **团队沟通**
   - 通知团队成员归档结构
   - 在代码审查中强调使用新系统

---

## 🔗 相关链接

- [Vue状态管理规范](memory://ed2a26f9-186c-472b-a3ad-ee3d86c48492)
- [布局状态管理规范](memory://5410fce7-a4b8-45dc-aaf2-fc07672cf903)
- [Tauri项目结构](../README.md)

---

*最后更新: 2026-04-23*  
*维护者: Development Team*  
*下次审查: 2026-10-23*
