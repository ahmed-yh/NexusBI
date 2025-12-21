import { create } from 'zustand';

interface DatasetState {
  datasets: Array<{
    id: string;
    name: string;
    type: string;
    size: number;
    uploadedAt: Date;
    status: 'processing' | 'ready' | 'error';
  }>;
  currentDataset: string | null;
  isProcessing: boolean;
  addDataset: (dataset: any) => void;
  setCurrentDataset: (id: string) => void;
  setProcessingStatus: (status: boolean) => void;
}

export const useDatasetStore = create<DatasetState>((set) => ({
  datasets: [],
  currentDataset: null,
  isProcessing: false,
  addDataset: (dataset) =>
    set((state) => ({
      datasets: [...state.datasets, dataset],
    })),
  setCurrentDataset: (id) =>
    set(() => ({
      currentDataset: id,
    })),
  setProcessingStatus: (status) =>
    set(() => ({
      isProcessing: status,
    })),
}));