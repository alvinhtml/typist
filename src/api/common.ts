import type { ElectronAPI } from '../electron'

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export async function apiReadData(lesson: string): Promise<any[]> {
  if (typeof window === 'undefined' || !window.electronAPI) {
    console.error('electronAPI is not available, window:', typeof window, 'electronAPI:', window?.electronAPI)
    throw new Error('electronAPI is not available')
  }
  
  try {
    console.log('Calling window.electronAPI.readData with lesson:', lesson)
    const result = await window.electronAPI.readData(lesson)
    console.log('Got result from readData:', result)
    return result
  } catch (error) {
    console.error('Error reading lesson data:', error)
    throw error
  }
}

export async function apiImportWords(words: any[]): Promise<void> {
  if (typeof window === 'undefined' || !window.electronAPI) {
    console.error('electronAPI is not available')
    throw new Error('electronAPI is not available')
  }
  
  try {
    await window.electronAPI.importWords(words)
  } catch (error) {
    console.error('Error importing words:', error)
    throw error
  }
}