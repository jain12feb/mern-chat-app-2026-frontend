import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface ChatState {
  selectedChat: any | null;
  highlightedMessageId: string | null;
}

const initialState: ChatState = {
  selectedChat: null,
  highlightedMessageId: null,
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setSelectedChat: (state, action: PayloadAction<any>) => {
      state.selectedChat = action.payload;
    },
    setHighlightedMessage: (state, action: PayloadAction<string | null>) => {
      state.highlightedMessageId = action.payload;
    },
    clearSelectedChat: (state) => {
      state.selectedChat = null;
      state.highlightedMessageId = null;
    },
  },
});

export const { setSelectedChat, setHighlightedMessage, clearSelectedChat } = chatSlice.actions;
export default chatSlice.reducer;
