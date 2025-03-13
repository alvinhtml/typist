export interface ElectronAPI {
  readData: (lesson: string) => Promise<Array<{
    word: string;
    code: string;
  }>>;
  importWords: (words: Array<{
    word: string;
    code: string;
  }>) => Promise<any>;
  exportWords: () => Promise<void>;
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
