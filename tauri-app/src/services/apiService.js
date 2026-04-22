/**
 * API 服务 - 连接后端服务器
 */

// 动态获取基础URL，优先使用环境变量或构建时配置
// Vite 会在构建时将 import.meta.env 替换为静态值
const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL || 
                (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ?
                  `http://${window.location.hostname}:8080` :
                  `${window.location.protocol}//${window.location.hostname}:${window.location.port || 8080}`);

export default {
  async get(url) {
    const response = await fetch(`${BASE_URL}${url}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  },
  
  async post(url, data) {
    const response = await fetch(`${BASE_URL}${url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  },
  
  async put(url, data) {
    const response = await fetch(`${BASE_URL}${url}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  },
  
  async delete(url) {
    const response = await fetch(`${BASE_URL}${url}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }
};
