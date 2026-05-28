import { create } from "zustand";

type Panel = "lobby" | "game" | "profile";

interface UiStore {
  activePanel: Panel;
  selectedRoomId: string | null;
  showUsernameModal: boolean;
  showCreateRoomModal: boolean;
  setActivePanel: (panel: Panel) => void;
  setSelectedRoomId: (roomId: string | null) => void;
  setShowUsernameModal: (show: boolean) => void;
  setShowCreateRoomModal: (show: boolean) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  activePanel: "lobby",
  selectedRoomId: null,
  showUsernameModal: false,
  showCreateRoomModal: false,
  setActivePanel: (activePanel) => set({ activePanel }),
  setSelectedRoomId: (selectedRoomId) => set({ selectedRoomId }),
  setShowUsernameModal: (show) => set({ showUsernameModal: show }),
  setShowCreateRoomModal: (show) => set({ showCreateRoomModal: show }),
}));
