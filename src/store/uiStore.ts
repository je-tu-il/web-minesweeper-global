import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiState {
  activePanel: "lobby" | "game" | "chat";
  selectedRoomId: string | null;
  showUsernameModal: boolean;
  showCreateRoomModal: boolean;
  activePrivateChat: { uid: string; username: string } | null;
  isChatOpen: boolean;
  chatView: "list" | "global" | "room" | "private";
  unreadCount: number;
}

interface UiActions {
  setActivePanel: (panel: UiState["activePanel"]) => void;
  setSelectedRoomId: (id: string | null) => void;
  setShowUsernameModal: (show: boolean) => void;
  setShowCreateRoomModal: (show: boolean) => void;
  setActivePrivateChat: (chat: { uid: string; username: string } | null) => void;
  setIsChatOpen: (open: boolean) => void;
  setChatView: (view: UiState["chatView"]) => void;
  incrementUnreadCount: () => void;
  clearUnreadCount: () => void;
}

export const useUiStore = create<UiState & UiActions>()(
  persist(
    (set) => ({
      activePanel: "lobby",
      selectedRoomId: null,
      showUsernameModal: false,
      showCreateRoomModal: false,
      activePrivateChat: null,
      isChatOpen: false,
      chatView: "list",
      unreadCount: 0,

      setActivePanel: (panel) => set({ activePanel: panel }),
      setSelectedRoomId: (id) => set({ selectedRoomId: id }),
      setShowUsernameModal: (show) => set({ showUsernameModal: show }),
      setShowCreateRoomModal: (show) => set({ showCreateRoomModal: show }),
      setActivePrivateChat: (chat) => set({ activePrivateChat: chat }),
      setIsChatOpen: (open) => {
        set({ isChatOpen: open });
        if (open) set({ unreadCount: 0 });
      },
      setChatView: (view) => set({ chatView: view }),
      incrementUnreadCount: () => set((state) => ({ unreadCount: state.isChatOpen ? 0 : state.unreadCount + 1 })),
      clearUnreadCount: () => set({ unreadCount: 0 }),
    }),
    {
      name: "demineur-ui-store",
      // Only persist these keys (not modals which should reset)
      partialize: (state) => ({
        selectedRoomId: state.selectedRoomId,
        isChatOpen: state.isChatOpen,
        chatView: state.chatView,
      }),
    }
  )
);
