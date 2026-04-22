/**
 * 布局独立性测试脚本
 * 
 * 测试场景：
 * 1. 布局独立性测试：在不同分屏模式中切换，确认格子状态独立
 * 2. 信号源绑定测试：在不同布局中拖拽信号源，确认绑定独立
 * 3. 双击全屏测试：双击格子进行最大化/还原操作
 */

import { ElMessage } from 'element-plus';

export class LayoutIndependenceTest {
  constructor() {
    this.testResults = [];
    this.currentTest = null;
    this.delay = 1000; // 操作延迟时间（毫秒）
  }

  /**
   * 运行所有测试
   */
  async runAllTests() {
    console.log('🧪 开始运行布局独立性测试套件');
    
    try {
      // 1. 布局独立性测试
      await this.testLayoutIndependence();
      
      // 2. 信号源绑定测试
      await this.testSourceBindingIndependence();
      
      // 3. 双击全屏测试
      await this.testDoubleClickMaximize();
      
      // 4. 输出测试报告
      this.printTestReport();
      
      return this.testResults;
    } catch (error) {
      console.error('❌ 测试执行失败:', error);
      ElMessage.error('测试执行失败: ' + error.message);
      return null;
    }
  }

  /**
   * 测试1: 布局独立性测试
   * 在1分屏中拖拽信号源A到第1个格子
   * 切换到2、4、9、16、25、36、49分屏，确认所有格子都是空的
   */
  async testLayoutIndependence() {
    console.log('\n📋 测试1: 布局独立性测试');
    this.currentTest = 'layout-independence';
    
    try {
      // 获取测试所需的元素
      const layoutButtons = document.querySelectorAll('.layout-btn');
      const videoItems = document.querySelectorAll('.video-item');
      const sourceItems = document.querySelectorAll('.source-item');
      
      if (sourceItems.length === 0) {
        this.addTestResult('布局独立性', false, '没有可用的信号源');
        return;
      }
      
      // 步骤1: 在1分屏中拖拽信号源A到第1个格子
      console.log('  步骤1: 在1分屏中拖拽信号源A到第1个格子');
      
      // 切换到1分屏
      await this.switchToLayout(1);
      await this.sleep(this.delay);
      
      // 拖拽第一个信号源到第一个格子
      const sourceA = sourceItems[0];
      const targetCell = videoItems[0];
      
      if (sourceA && targetCell) {
        await this.dragAndDrop(sourceA, targetCell);
        await this.sleep(this.delay);
        
        // 验证第一个格子有信号源
        const hasSource = targetCell.classList.contains('has-source');
        console.log(`    1分屏第1个格子有信号源: ${hasSource}`);
        
        if (!hasSource) {
          this.addTestResult('1分屏拖拽信号源', false, '信号源未成功绑定到格子');
          return;
        }
      }
      
      // 步骤2: 切换到其他布局，验证所有格子都是空的
      const layouts = [2, 4, 9, 16, 25, 36, 49];
      let allPassed = true;
      
      for (const layout of layouts) {
        console.log(`  步骤2.${layouts.indexOf(layout) + 1}: 切换到${layout}分屏，验证格子为空`);
        
        // 切换布局
        await this.switchToLayout(layout);
        await this.sleep(this.delay);
        
        // 检查所有格子是否为空
        const currentVideoItems = document.querySelectorAll('.video-item');
        let emptyCount = 0;
        let hasSourceCount = 0;
        
        currentVideoItems.forEach((item, index) => {
          if (item.classList.contains('hidden')) return; // 跳过隐藏的格子
          
          if (item.classList.contains('has-source')) {
            hasSourceCount++;
            console.warn(`    ⚠️ ${layout}分屏第${index + 1}个格子有信号源！`);
          } else {
            emptyCount++;
          }
        });
        
        console.log(`    ${layout}分屏: ${emptyCount}个空格子, ${hasSourceCount}个有信号源的格子`);
        
        if (hasSourceCount > 0) {
          allPassed = false;
          this.addTestResult(`${layout}分屏独立性`, false, `发现${hasSourceCount}个非空格子`);
        } else {
          this.addTestResult(`${layout}分屏独立性`, true, `所有${emptyCount}个格子都为空`);
        }
      }
      
      this.addTestResult('布局独立性测试', allPassed, allPassed ? '所有布局都保持独立性' : '部分布局未保持独立性');
      
    } catch (error) {
      console.error('❌ 布局独立性测试失败:', error);
      this.addTestResult('布局独立性测试', false, error.message);
    }
  }

  /**
   * 测试2: 信号源绑定测试
   * 在49分屏中拖拽不同的信号源到各个格子
   * 切换到36分屏，确认所有格子都是空的（不显示49分屏的状态）
   * 重新拖拽信号源到36分屏的格子
   * 再次切换到其他布局，验证独立性
   */
  async testSourceBindingIndependence() {
    console.log('\n📋 测试2: 信号源绑定测试');
    this.currentTest = 'source-binding-independence';
    
    try {
      const sourceItems = document.querySelectorAll('.source-item');
      
      if (sourceItems.length < 5) {
        console.warn('  ⚠️ 信号源数量不足，跳过测试');
        this.addTestResult('信号源绑定测试', false, '信号源数量不足');
        return;
      }
      
      // 步骤1: 在49分屏中拖拽不同的信号源到前5个格子
      console.log('  步骤1: 在49分屏中拖拽信号源到各个格子');
      await this.switchToLayout(49);
      await this.sleep(this.delay);
      
      const videoItems49 = document.querySelectorAll('.video-item');
      const usedSources = [];
      
      // 拖拽5个不同的信号源
      for (let i = 0; i < Math.min(5, sourceItems.length, videoItems49.length); i++) {
        const source = sourceItems[i];
        const targetCell = videoItems49[i];
        
        if (source && targetCell && !targetCell.classList.contains('hidden')) {
          await this.dragAndDrop(source, targetCell);
          usedSources.push(i);
          await this.sleep(this.delay * 0.5);
        }
      }
      
      console.log(`    已拖拽${usedSources.length}个信号源到49分屏`);
      
      // 验证49分屏中的格子有信号源
      let sourceCountIn49 = 0;
      videoItems49.forEach(item => {
        if (item.classList.contains('has-source') && !item.classList.contains('hidden')) {
          sourceCountIn49++;
        }
      });
      console.log(`    49分屏中有${sourceCountIn49}个格子有信号源`);
      
      // 步骤2: 切换到36分屏，确认所有格子都是空的
      console.log('  步骤2: 切换到36分屏，验证格子为空');
      await this.switchToLayout(36);
      await this.sleep(this.delay);
      
      const videoItems36 = document.querySelectorAll('.video-item');
      let emptyCount36 = 0;
      let hasSourceCount36 = 0;
      
      videoItems36.forEach((item, index) => {
        if (item.classList.contains('hidden')) return;
        
        if (item.classList.contains('has-source')) {
          hasSourceCount36++;
          console.warn(`    ⚠️ 36分屏第${index + 1}个格子有信号源！`);
        } else {
          emptyCount36++;
        }
      });
      
      console.log(`    36分屏: ${emptyCount36}个空格子, ${hasSourceCount36}个有信号源的格子`);
      
      if (hasSourceCount36 > 0) {
        this.addTestResult('36分屏验证49分屏隔离', false, `发现${hasSourceCount36}个非空格子`);
      } else {
        this.addTestResult('36分屏验证49分屏隔离', true, `所有${emptyCount36}个格子都为空`);
      }
      
      // 步骤3: 重新拖拽信号源到36分屏的格子
      console.log('  步骤3: 重新拖拽信号源到36分屏');
      
      // 使用不同的信号源
      for (let i = 0; i < Math.min(3, sourceItems.length, videoItems36.length); i++) {
        const source = sourceItems[(i + 2) % sourceItems.length]; // 使用不同的信号源
        const targetCell = videoItems36[i];
        
        if (source && targetCell && !targetCell.classList.contains('hidden')) {
          await this.dragAndDrop(source, targetCell);
          await this.sleep(this.delay * 0.5);
        }
      }
      
      // 验证36分屏中的格子有信号源
      let sourceCountIn36 = 0;
      videoItems36.forEach(item => {
        if (item.classList.contains('has-source') && !item.classList.contains('hidden')) {
          sourceCountIn36++;
        }
      });
      console.log(`    36分屏中有${sourceCountIn36}个格子有信号源`);
      
      // 步骤4: 再次切换到其他布局，验证独立性
      console.log('  步骤4: 切换到其他布局，验证独立性');
      
      const testLayouts = [16, 25];
      let allPassed = true;
      
      for (const layout of testLayouts) {
        await this.switchToLayout(layout);
        await this.sleep(this.delay);
        
        const currentVideoItems = document.querySelectorAll('.video-item');
        let emptyCount = 0;
        let hasSourceCount = 0;
        
        currentVideoItems.forEach((item, index) => {
          if (item.classList.contains('hidden')) return;
          
          if (item.classList.contains('has-source')) {
            hasSourceCount++;
            console.warn(`    ⚠️ ${layout}分屏第${index + 1}个格子有信号源！`);
          } else {
            emptyCount++;
          }
        });
        
        console.log(`    ${layout}分屏: ${emptyCount}个空格子, ${hasSourceCount}个有信号源的格子`);
        
        if (hasSourceCount > 0) {
          allPassed = false;
          this.addTestResult(`${layout}分屏验证36分屏隔离`, false, `发现${hasSourceCount}个非空格子`);
        } else {
          this.addTestResult(`${layout}分屏验证36分屏隔离`, true, `所有${emptyCount}个格子都为空`);
        }
      }
      
      this.addTestResult('信号源绑定测试', allPassed, allPassed ? '所有布局都保持信号源绑定独立性' : '部分布局未保持独立性');
      
    } catch (error) {
      console.error('❌ 信号源绑定测试失败:', error);
      this.addTestResult('信号源绑定测试', false, error.message);
    }
  }

  /**
   * 测试3: 双击全屏测试
   * 在任意布局中，双击有信号源的格子，确认可以最大化
   * 再次双击最大化的格子，确认可以取消最大化
   * 在没有信号源的格子上双击，确认显示友好提示
   */
  async testDoubleClickMaximize() {
    console.log('\n📋 测试3: 双击全屏测试');
    this.currentTest = 'double-click-maximize';
    
    try {
      const sourceItems = document.querySelectorAll('.source-item');
      
      // 步骤1: 切换到4分屏并拖拽信号源
      console.log('  步骤1: 切换到4分屏并拖拽信号源');
      await this.switchToLayout(4);
      await this.sleep(this.delay);
      
      if (sourceItems.length > 0) {
        const videoItems = document.querySelectorAll('.video-item');
        const sourceA = sourceItems[0];
        const targetCell = videoItems[0];
        
        if (targetCell && !targetCell.classList.contains('hidden')) {
          await this.dragAndDrop(sourceA, targetCell);
          await this.sleep(this.delay);
        }
      }
      
      const videoItems = document.querySelectorAll('.video-item');
      
      // 步骤2: 双击有信号源的格子，确认可以最大化
      console.log('  步骤2: 双击有信号源的格子，验证最大化');
      const sourceCell = Array.from(videoItems).find(item => 
        item.classList.contains('has-source') && !item.classList.contains('hidden')
      );
      
      if (sourceCell) {
        console.log(`    双击有信号源的格子（索引${Array.from(videoItems).indexOf(sourceCell) + 1}）`);
        sourceCell.dispatchEvent(new MouseEvent('dblclick', {
          bubbles: true,
          cancelable: true
        }));
        await this.sleep(this.delay);
        
        // 检查是否有最大化的格子
        const maximizedCell = document.querySelector('.video-item.maximized');
        
        if (maximizedCell) {
          console.log('    ✅ 格子已最大化');
          this.addTestResult('双击最大化', true, '格子成功最大化');
        } else {
          console.log('    ❌ 格子未最大化');
          this.addTestResult('双击最大化', false, '格子未最大化');
        }
        
        // 步骤3: 再次双击，确认可以取消最大化
        console.log('  步骤3: 再次双击，验证取消最大化');
        maximizedCell?.dispatchEvent(new MouseEvent('dblclick', {
          bubbles: true,
          cancelable: true
        }));
        await this.sleep(this.delay);
        
        // 检查是否还有最大化的格子
        const stillMaximized = document.querySelector('.video-item.maximized');
        
        if (!stillMaximized) {
          console.log('    ✅ 已取消最大化');
          this.addTestResult('双击取消最大化', true, '成功取消最大化');
        } else {
          console.log('    ❌ 仍处于最大化状态');
          this.addTestResult('双击取消最大化', false, '未取消最大化');
        }
      } else {
        console.log('    ⚠️ 未找到有信号源的格子');
        this.addTestResult('双击最大化', false, '未找到有信号源的格子');
      }
      
      // 步骤4: 在没有信号源的格子上双击，确认显示友好提示
      console.log('  步骤4: 双击空格子，验证友好提示');
      const emptyCell = Array.from(videoItems).find(item => 
        !item.classList.contains('has-source') && !item.classList.contains('hidden')
      );
      
      if (emptyCell) {
        console.log(`    双击空格子（索引${Array.from(videoItems).indexOf(emptyCell) + 1}）`);
        
        // 监听是否显示了提示消息
        let messageShown = false;
        const originalMessage = ElMessage.warning;
        
        ElMessage.warning = function(...args) {
          messageShown = true;
          console.log('    ✅ 显示提示消息:', args[0]);
          return originalMessage.apply(this, args);
        };
        
        emptyCell.dispatchEvent(new MouseEvent('dblclick', {
          bubbles: true,
          cancelable: true
        }));
        await this.sleep(this.delay * 2);
        
        // 恢复原始方法
        ElMessage.warning = originalMessage;
        
        if (messageShown) {
          this.addTestResult('空格子双击提示', true, '显示友好提示');
        } else {
          this.addTestResult('空格子双击提示', false, '未显示提示消息');
        }
      } else {
        console.log('    ⚠️ 未找到空格子');
        this.addTestResult('空格子双击提示', false, '未找到空格子');
      }
      
    } catch (error) {
      console.error('❌ 双击全屏测试失败:', error);
      this.addTestResult('双击全屏测试', false, error.message);
    }
  }

  /**
   * 辅助方法：切换到指定布局
   */
  async switchToLayout(layout) {
    console.log(`    切换到${layout}分屏...`);
    
    // 查找并点击对应的布局按钮
    const layoutButtons = document.querySelectorAll('.layout-btn');
    
    for (const button of layoutButtons) {
      const layoutValue = button.getAttribute('data-layout') || button.textContent?.match(/\d+/)?.[0];
      if (parseInt(layoutValue) === layout) {
        button.click();
        return;
      }
    }
    
    // 如果找不到按钮，尝试通过 Vue 组件实例调用
    console.warn(`    未找到${layout}分屏按钮，尝试通过其他方式切换`);
  }

  /**
   * 辅助方法：拖拽操作
   */
  async dragAndDrop(sourceElement, targetElement) {
    console.log(`    拖拽 ${sourceElement.textContent || '信号源'} 到格子`);
    
    // 模拟鼠标事件
    const sourceRect = sourceElement.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();
    
    // mousedown
    sourceElement.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      clientX: sourceRect.left + sourceRect.width / 2,
      clientY: sourceRect.top + sourceRect.height / 2,
      button: 0
    }));
    
    await this.sleep(100);
    
    // mousemove (中间过程)
    for (let i = 0; i < 5; i++) {
      const progress = (i + 1) / 5;
      const x = sourceRect.left + (targetRect.left - sourceRect.left) * progress;
      const y = sourceRect.top + (targetRect.top - sourceRect.top) * progress;
      
      sourceElement.dispatchEvent(new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y
      }));
      
      await this.sleep(50);
    }
    
    // mouseup (在目标位置)
    targetElement.dispatchEvent(new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      clientX: targetRect.left + targetRect.width / 2,
      clientY: targetRect.top + targetRect.height / 2,
      button: 0
    }));
    
    await this.sleep(this.delay);
  }

  /**
   * 辅助方法：延迟
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 辅助方法：添加测试结果
   */
  addTestResult(testName, passed, message) {
    const result = {
      testName,
      passed,
      message,
      timestamp: new Date().toISOString(),
      testSuite: this.currentTest
    };
    
    this.testResults.push(result);
    
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${testName}: ${message}`);
  }

  /**
   * 输出测试报告
   */
  printTestReport() {
    console.log('\n==================== 测试报告 ====================');
    
    const passed = this.testResults.filter(r => r.passed).length;
    const failed = this.testResults.filter(r => !r.passed).length;
    const total = this.testResults.length;
    
    console.log(`总测试数: ${total}`);
    console.log(`通过: ${passed}`);
    console.log(`失败: ${failed}`);
    console.log(`通过率: ${((passed / total) * 100).toFixed(1)}%`);
    
    console.log('\n详细结果:');
    this.testResults.forEach((result, index) => {
      const icon = result.passed ? '✅' : '❌';
      console.log(`${icon} ${index + 1}. ${result.testName}`);
      console.log(`   ${result.message}`);
      console.log(`   时间: ${result.timestamp}`);
    });
    
    console.log('====================================================\n');
    
    // 显示总结消息
    if (failed === 0) {
      ElMessage.success(`所有测试通过！ (${total}/${total})`);
    } else {
      ElMessage.warning(`测试完成，${failed}个失败 (${passed}/${total} 通过)`);
    }
  }
}

// 导出单例实例
export const layoutIndependenceTest = new LayoutIndependenceTest();

/**
 * 在浏览器控制台中运行的快捷函数
 */
window.runLayoutTests = async () => {
  console.log('🧪 开始运行布局独立性测试...');
  await layoutIndependenceTest.runAllTests();
};
