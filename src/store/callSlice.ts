import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type CallType = "audio" | "video";
export type CallStatus = "idle" | "ringing" | "connecting" | "connected";

export interface CallParticipant {
  id: string;
  name?: string;
  avatar?: string;
}

interface CallState {
  isReceivingCall: boolean;
  activeCallId: string | null; // Could be chatId or a unique call ID
  callStatus: CallStatus;
  callType: CallType | null;
  caller: CallParticipant | null; // The person who called (if incoming)
  participants: CallParticipant[]; // All participants in the current call
  isMuted: boolean;
  isVideoOff: boolean;
}

const initialState: CallState = {
  isReceivingCall: false,
  activeCallId: null,
  callStatus: "idle",
  callType: null,
  caller: null,
  participants: [],
  isMuted: false,
  isVideoOff: false,
};

export const callSlice = createSlice({
  name: "call",
  initialState,
  reducers: {
    setIncomingCall: (
      state,
      action: PayloadAction<{
        caller: CallParticipant;
        type: CallType;
        chatId: string;
      }>,
    ) => {
      // Don't show incoming call if we are already in one
      if (state.callStatus !== "idle") return;

      state.isReceivingCall = true;
      state.caller = action.payload.caller;
      state.callType = action.payload.type;
      state.activeCallId = action.payload.chatId;
      state.callStatus = "ringing";
    },
    acceptIncomingCall: (state) => {
      state.isReceivingCall = false;
      state.callStatus = "connecting";
      if (
        state.caller &&
        !state.participants.some((p) => p.id === state.caller?.id)
      ) {
        state.participants.push(state.caller);
      }
    },
    rejectIncomingCall: () => {
      return initialState;
    },
    initiateCall: (
      state,
      action: PayloadAction<{
        chatId: string;
        type: CallType;
        participants: CallParticipant[];
      }>,
    ) => {
      state.activeCallId = action.payload.chatId;
      state.callType = action.payload.type;
      state.callStatus = "connecting";
      state.participants = action.payload.participants;
      state.isReceivingCall = false;
    },
    setCallConnected: (state) => {
      state.callStatus = "connected";
    },
    addParticipant: (state, action: PayloadAction<CallParticipant>) => {
      if (!state.participants.some((p) => p.id === action.payload.id)) {
        state.participants.push(action.payload);
      }
    },
    removeParticipant: (state, action: PayloadAction<string>) => {
      state.participants = state.participants.filter(
        (p) => p.id !== action.payload,
      );
      // Optional: Auto-end if less than 2 participants (unless it's a group room waiting)
    },
    endCall: () => {
      return initialState;
    },
    toggleMuteState: (state) => {
      state.isMuted = !state.isMuted;
    },
    toggleVideoState: (state) => {
      state.isVideoOff = !state.isVideoOff;
    },
  },
});

export const {
  setIncomingCall,
  acceptIncomingCall,
  rejectIncomingCall,
  initiateCall,
  setCallConnected,
  addParticipant,
  removeParticipant,
  endCall,
  toggleMuteState,
  toggleVideoState,
} = callSlice.actions;

export default callSlice.reducer;
