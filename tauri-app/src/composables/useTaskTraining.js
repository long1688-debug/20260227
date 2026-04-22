import { computed } from 'vue'
import { useTaskStore } from '@/stores/taskStore'
import { useTrainingStore } from '@/stores/trainingStore'

export function useTaskTraining() {
  const taskStore = useTaskStore()
  const trainingStore = useTrainingStore()

  const tasks = computed(() => taskStore.tasks)
  const trainings = computed(() => trainingStore.trainings)
  const publishedTasks = computed(() => taskStore.tasks.filter(t => t.status === 'published'))
  const draftTasks = computed(() => taskStore.tasks.filter(t => t.status === 'draft'))
  const activeTrainings = computed(() => trainingStore.trainings.filter(t => t.status === 'ongoing'))
  const pendingTrainings = computed(() => trainingStore.trainings.filter(t => t.status === 'pending'))

  const fetchTasks = async () => {
    await taskStore.fetchTasks()
  }

  const fetchTrainings = async () => {
    await trainingStore.fetchTrainings()
  }

  const fetchAll = async () => {
    await Promise.all([fetchTasks(), fetchTrainings()])
  }

  const addTask = async (taskData) => {
    await taskStore.addTask(taskData)
  }

  const updateTask = async (id, updates) => {
    await taskStore.updateTask(id, updates)
  }

  const deleteTask = async (id) => {
    await taskStore.deleteTask(id)
  }

  const publishTask = async (id) => {
    await taskStore.publishTask(id)
  }

  const addTraining = async (trainingData) => {
    await trainingStore.addTraining(trainingData)
  }

  const updateTraining = async (id, updates) => {
    await trainingStore.updateTraining(id, updates)
  }

  const deleteTraining = async (id) => {
    await trainingStore.deleteTraining(id)
  }

  const startTraining = async (id) => {
    await trainingStore.startTraining(id)
  }

  const completeTraining = async (id) => {
    await trainingStore.completeTraining(id)
  }

  const updateTrainingProgress = async (id, progress) => {
    await trainingStore.updateProgress(id, progress)
  }

  return {
    tasks,
    trainings,
    publishedTasks,
    draftTasks,
    activeTrainings,
    pendingTrainings,
    fetchTasks,
    fetchTrainings,
    fetchAll,
    addTask,
    updateTask,
    deleteTask,
    publishTask,
    addTraining,
    updateTraining,
    deleteTraining,
    startTraining,
    completeTraining,
    updateTrainingProgress
  }
}
