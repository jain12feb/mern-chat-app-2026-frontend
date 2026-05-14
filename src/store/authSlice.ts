import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface AuthState {
  userInfo: any | null;
  token: string | null;
}

const initialState: AuthState = {
  userInfo: localStorage.getItem("userInfo")
    ? JSON.parse(localStorage.getItem("userInfo")!)
    : null,
  token: null, // Token is strictly in memory
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ user: any; accessToken: string }>,
    ) => {
      const { user, accessToken } = action.payload;
      state.userInfo = user;
      state.token = accessToken;
      localStorage.setItem("userInfo", JSON.stringify(user));
    },
    logout: (state) => {
      state.userInfo = null;
      state.token = null;
      localStorage.removeItem("userInfo");
    },
    updateUserInfo: (state, action: PayloadAction<any>) => {
      state.userInfo = { ...state.userInfo, ...action.payload };
      localStorage.setItem("userInfo", JSON.stringify(state.userInfo));
    },
  },
});

export const { setCredentials, logout, updateUserInfo } = authSlice.actions;
export default authSlice.reducer;
