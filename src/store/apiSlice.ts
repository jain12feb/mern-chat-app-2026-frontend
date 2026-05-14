import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { type RootState } from "./index";
import { setCredentials, logout } from "./authSlice";

const backendUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
const baseQuery = fetchBaseQuery({
  baseUrl: `${backendUrl}/api`,
  credentials: "include",
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.token;
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    headers.set("Cache-Control", "no-cache");
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");
    return headers;
  },
});

const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await baseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    // try to get a new token
    const refreshResult = await baseQuery(
      { url: "/auth/refresh", method: "POST" },
      api,
      extraOptions,
    );

    if (refreshResult.data) {
      const data = refreshResult.data as { accessToken: string };
      const userInfo = (api.getState() as RootState).auth.userInfo;

      // store the new token
      api.dispatch(
        setCredentials({ user: userInfo, accessToken: data.accessToken }),
      );

      // retry the initial query
      result = await baseQuery(args, api, extraOptions);
    } else {
      api.dispatch(logout());
    }
  }
  return result;
};

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["User", "Chat", "Message"],
  endpoints: () => ({}),
});
