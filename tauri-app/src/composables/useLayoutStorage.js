import { ref, reactive } from "vue";

/**
 * 布局存储管理
 * 🎯 2026-04-20 更新：统一使用新布局索引方案
 * 
 * 布局索引对应关系:
 * 1-1分屏、2-2分屏、3-3分屏、4-4分屏、5-6分屏、7-9分屏、10-16分屏、
 * 11-25分屏、12-36分屏、13-49分屏、14-特殊布局1、15-特殊布局2、
 * 16-特殊布局3、17-特殊布局4、18-自由布局
 */
export function useLayoutStorage() {
  // 布局类型列表 - 使用新布局索引
  const layoutTypes = [1, 2, 3, 4, 5, 7, 10, 11, 12, 13];
  const layoutMap = reactive(
    Object.fromEntries(layoutTypes.map(n => [`${n}_normal`, {}]))
  );

  function saveLayoutMap() {
    localStorage.setItem("video_wall_layouts", JSON.stringify(layoutMap));
  }

  function loadLayoutMap() {
    const saved = localStorage.getItem("video_wall_layouts");
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.keys(parsed).forEach(key => {
        if (layoutMap[key]) layoutMap[key] = parsed[key];
      });
    }
  }

  function setSourceToCurrentLayout(layout, canvasIndex, sourceId) {
    const key = `${layout}_normal`;
    layoutMap[key][canvasIndex] = sourceId;
    saveLayoutMap();
  }

  function getSourceFromCurrentLayout(layout, canvasIndex) {
    const key = `${layout}_normal`;
    return layoutMap[key][canvasIndex] || null;
  }

  // 🎯 修复：移除 onMounted，由调用者自行决定何时加载
  // onMounted(() => loadLayoutMap());

  return {
    layoutMap,
    loadLayoutMap, // 🎯 导出 loadLayoutMap 供调用者使用
    setSourceToCurrentLayout,
    getSourceFromCurrentLayout,
    saveLayoutMap
  };
}