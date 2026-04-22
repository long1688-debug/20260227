import { ref, reactive } from "vue";

/**
 * 独立布局状态管理 - RenderCanvas 架构实现
 * 
 * 核心架构：布局与信号源分离（参考 RenderCanvas 架构）
 * 
 * RenderCanvas (画布)
 *     ├── layouts (map<string, RenderLayout>)  ← 多个布局对象
 *     │     ├─ layout_1 (单画面)
 *     │     ├─ layout_2 (双画面)
 *     │     ├─ layout_4 (四分屏)
 *     │     └─ ... (最多49分屏 + 4种特殊布局)
 *     │
 *     └─ curLayout (当前激活的布局ID)
 * 
 * 关键点：
 * ✅ 每个 Layout 独立存储：所有布局对象同时存在于内存中
 * ✅ 切换只是改变指针：switchLayout() 只改变 currentLayout 变量
 * ✅ 不销毁旧布局：切换时不会删除或清空任何布局
 * ✅ 每个 Box 独立：不同布局的 Box 互不影响
 * ✅ refId 持久化：每个 Box 记住自己绑定的信号源
 * 
 * 布局索引对应关系:
 * 1-1分屏、2-2分屏、3-3分屏、4-4分屏、5-6分屏、7-9分屏、10-16分屏、
 * 11-25分屏、12-36分屏、13-49分屏、14-特殊布局1、15-特殊布局2、
 * 16-特殊布局3、17-特殊布局4、18-自由布局
 */
export function useLayoutStates(options) {
  // 布局类型列表 - 使用新布局索引
  // 包含所有标准分屏布局 + 特殊布局 + 自由布局
  const layoutTypes = [
    1, 2, 3, 4, 5,    // 1-6分屏
    7, 10, 11, 12, 13, // 9, 16, 25, 36, 49分屏
    14, 15, 16, 17,   // 特殊布局1-4
    18               // 自由布局
  ];

  // 为每个布局类型创建独立的槽位对象（使用对象而非数组，支持 1-based 索引）
  // 例如：layoutStates[1].slots 是 1 分屏的槽位对象 {1: "source_A"}
  //      layoutStates[4].slots 是 4 分屏的槽位对象 {1: "source_A", 2: "source_B", ...}
  const layoutStates = reactive(
    Object.fromEntries(
      layoutTypes.map(layout => [
        layout,
        {
          slots: {}, // 🎯 使用对象而非数组，键名为 1-based 画布索引
          maximizedIndex: null // 每个布局独立的最大化状态
        }
      ])
    )
  );

  // 当前布局
  const currentLayout = ref(1);

  /**
   * 切换布局
   * @param {number} newLayout - 新的布局类型
   */
  const switchLayout = (newLayout) => {
    const oldLayout = currentLayout.value;
    console.log(`[LayoutStates] 切换布局: ${oldLayout} -> ${newLayout}`);
    
    // 保存当前布局状态
    saveCurrentLayoutState();
    
    // 切换到新布局
    currentLayout.value = newLayout;
    
    // 如果新布局没有内容，尝试从预览区域克隆信号源
    if (Object.keys(layoutStates[newLayout].slots).length === 0) {
      console.log(`[LayoutStates] 新布局 ${newLayout} 为空，尝试从预览区域克隆信号源`);
      // 这里可以实现从预览区域或其他地方获取初始信号源的逻辑
    }
  };

  /**
   * 保存当前布局状态
   */
  const saveCurrentLayoutState = () => {
    const layout = currentLayout.value;
    console.log(`[LayoutStates] 保存布局${layout}的状态`);
    
    // 检查是否有外部传入的 sources 列表
    if (options && options.allSources) {
      const sourceList = options.allSources;
      const updatedSlots = {};
      
      // 检查每个槽位的源是否存在
      for (const [index, sourceId] of Object.entries(layoutStates[layout].slots)) {
        // 检查源是否在可用源列表中
        const sourceExists = sourceList.some(src => src.id === sourceId);
        if (sourceExists) {
          updatedSlots[index] = sourceId;
        } else {
          console.warn(`[布局切换] 找不到信号源 ${sourceId}，只保存ID`);
          updatedSlots[index] = sourceId; // 即使找不到也保存ID
        }
      }
      
      layoutStates[layout].slots = { ...updatedSlots };
    } else {
      // 如果没有传入 sources，保持原样
      // 但可以考虑验证这些ID是否有效
      console.log(`[LayoutStates] 保存布局${layout}的现有槽位状态`);
    }
    
    console.log(`[LayoutStates] 已保存布局 ${layout} 的状态:`, layoutStates[layout]);
  };

  /**
   * 分配信号源到指定槽位
   * 严格绑定到 currentLayout.value
   * 🎯 关键修复：直接使用 1-based 索引，无需转换
   * @param {number} slotIndex - 槽位索引（1-based）
   * @param {string} sourceId - 信号源ID
   */
  const assignSource = (slotIndex, sourceId) => {
    const layout = currentLayout.value;
    console.log(`[LayoutStates] 分配信号源: 布局${layout} 槽位${slotIndex} -> ${sourceId}`);
    // 🎯 直接写入对应布局的快照，使用 1-based 索引
    layoutStates[layout].slots[slotIndex] = sourceId;
  };

  /**
   * 获取指定槽位的信号源
   * 🎯 关键修复：直接使用 1-based 索引
   * @param {number} slotIndex - 槽位索引（1-based）
   * @returns {string|null} 信号源ID
   */
  const getSource = (slotIndex) => {
    const layout = currentLayout.value;
    return layoutStates[layout].slots[slotIndex] || null;
  };

  /**
   * 获取当前布局的所有槽位
   * @returns {Object} 槽位对象
   */
  const getCurrentSlots = () => {
    const layout = currentLayout.value;
    return layoutStates[layout].slots;
  };

  /**
   * 批量分配信号源到槽位
   * @param {Object} slots - 槽位对象，格式为 {index: sourceId}
   */
  const batchAssignSources = (slots) => {
    const layout = currentLayout.value;
    console.log(`[LayoutStates] 批量分配信号源到布局${layout}:`, slots);
    
    for (const [index, sourceId] of Object.entries(slots)) {
      layoutStates[layout].slots[index] = sourceId;
    }
  };

  /**
   * 清空指定布局的所有槽位
   * @param {number} layout - 布局类型
   */
  const clearLayoutSlots = (layout) => {
    console.log(`[LayoutStates] 清空布局${layout}的所有槽位`);
    layoutStates[layout].slots = {};
  };

  /**
   * 重置所有布局状态
   */
  const resetAllLayouts = () => {
    console.log('[LayoutStates] 重置所有布局状态');
    
    for (const layout of layoutTypes) {
      layoutStates[layout].slots = {};
      layoutStates[layout].maximizedIndex = null;
    }
    
    currentLayout.value = 1; // 重置为默认布局
  };

  /**
   * 获取所有布局状态
   * @returns {Object} 所有布局状态
   */
  const getAllLayoutStates = () => {
    return layoutStates;
  };

  /**
   * 从外部数据恢复布局状态
   * @param {Object} states - 布局状态对象
   */
  const restoreLayoutStates = (states) => {
    console.log('[LayoutStates] 从外部数据恢复布局状态');
    
    if (!states) {
      console.error('[LayoutStates] 无效的布局状态数据');
      return;
    }
    
    for (const layout of layoutTypes) {
      if (states[layout]) {
        layoutStates[layout].slots = { ...states[layout].slots } || {};
        layoutStates[layout].maximizedIndex = states[layout].maximizedIndex || null;
      }
    }
  };

  // 🎯 将 layoutStates 暴露到 window 对象，供其他模块访问
  if (typeof window !== 'undefined') {
    window.__layoutStates = layoutStates;
    console.log('[LayoutStates] 已将 layoutStates 暴露到 window.__layoutStates');
  }

  return {
    layoutStates,
    currentLayout,
    switchLayout,
    assignSource,
    getSource,
    clearLayoutSlots,
    resetAllLayouts,
    getCurrentSlots,
    batchAssignSources,
    getAllLayoutStates,
    restoreLayoutStates,
    saveCurrentLayoutState
  };
}
