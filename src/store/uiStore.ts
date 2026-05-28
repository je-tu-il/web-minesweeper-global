import { create } from "zustand";

type Panel = "lobby" | "game" | "admin";

interface UiStore {
  activePanel: Panel;
  selectedRoomId: string;
  setActivePanel: (panel: Panel) => void;
  setSelectedRoomId: (roomId: string) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  activePanel: "game",
  selectedRoomId: "global-alpha",
  setActivePanel: (activePanel) => set({ activePanel }),
  setSelectedRoomId: (selectedRoomId) => set({ selectedRoomId }),
}));
