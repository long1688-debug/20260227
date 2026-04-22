import { defineStore } from 'pinia'

export const useTaskStore = defineStore('task', {
  state: () => ({
    tasks: []
  }),

  actions: {
    async fetchTasks() {
      this.tasks = [
        { id: 1, name: '第一章练习', type: '练习', status: 'published', deadline: '2026-04-20 23:59' },
        { id: 2, name: '期中测试', type: '测试', status: 'draft', deadline: '2026-04-25 23:59' },
        { id: 3, name: '实验报告', type: '报告', status: 'published', deadline: '2026-04-30 23:59' }
      ]
    },

    addTask(task) {
      const newTask = {
        id: Date.now(),
        ...task,
        status: 'draft',
        deadline: new Date().toISOString().slice(0, 16).replace('T', ' ')
      }
      this.tasks.push(newTask)
    },

    updateTask(id, updates) {
      const index = this.tasks.findIndex(t => t.id === id)
      if (index !== -1) {
        this.tasks[index] = { ...this.tasks[index], ...updates }
      }
    },

    deleteTask(id) {
      this.tasks = this.tasks.filter(t => t.id !== id)
    },

    publishTask(id) {
      const task = this.tasks.find(t => t.id === id)
      if (task) {
        task.status = 'published'
      }
    },

    closeTask(id) {
      const task = this.tasks.find(t => t.id === id)
      if (task) {
        task.status = 'closed'
      }
    }
  }
})
