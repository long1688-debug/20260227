import { defineStore } from 'pinia'

export const useTrainingStore = defineStore('training', {
  state: () => ({
    trainings: []
  }),

  actions: {
    async fetchTrainings() {
      this.trainings = [
        { id: 1, name: '基础操作训练', status: 'ongoing', studentCount: 25, progress: 65 },
        { id: 2, name: '进阶技能训练', status: 'pending', studentCount: 20, progress: 0 },
        { id: 3, name: '综合实训', status: 'completed', studentCount: 30, progress: 100 }
      ]
    },

    addTraining(training) {
      const newTraining = {
        id: Date.now(),
        ...training,
        status: 'pending',
        studentCount: 0,
        progress: 0
      }
      this.trainings.push(newTraining)
    },

    updateTraining(id, updates) {
      const index = this.trainings.findIndex(t => t.id === id)
      if (index !== -1) {
        this.trainings[index] = { ...this.trainings[index], ...updates }
      }
    },

    deleteTraining(id) {
      this.trainings = this.trainings.filter(t => t.id !== id)
    },

    startTraining(id) {
      const training = this.trainings.find(t => t.id === id)
      if (training) {
        training.status = 'ongoing'
      }
    },

    completeTraining(id) {
      const training = this.trainings.find(t => t.id === id)
      if (training) {
        training.status = 'completed'
        training.progress = 100
      }
    },

    updateProgress(id, progress) {
      const training = this.trainings.find(t => t.id === id)
      if (training) {
        training.progress = progress
      }
    }
  }
})
