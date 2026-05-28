import { create } from "zustand";

interface UiState {
  activePanel: "lobby" | "game" | "chat";
  selectedRoomId: string | null;
  showUsernameModal: boolean;
  showCreateRoomModal: boolean;
  activePrivateChat: { uid: string; username: string } | null;
}

interface UiActions {
  setActivePanel: (panel: UiState["activePanel"]) => void;
  setSelectedRoomId: (id: string | null) => void;
  setShowUsernameModal: (show: boolean) => void;
  setShowCreateRoomModal: (show: boolean) => void;
  setActivePrivateChat: (chat: { uid: string; username: string } | null) => void;
}

export const useUiStore = create<UiState & UiActions>((set) => ({
  activePanel: "lobby",
  selectedRoomId: null,
  showUsernameModal: false,
  showCreateRoomModal: false,
  activePrivateChat: null,

  setActivePanel: (panel) => set({ activePanel: panel }),
  setSelectedRoomId: (id) => set({ selectedRoomId: id }),
  setShowUsernameModal: (show) => set({ showUsernameModal: show }),
  setShowCreateRoomModal: (show) => set({ showCreateRoomModal: show }),
  setActivePrivateChat: (chat) => set({ activePrivateChat: chat }),
}));
