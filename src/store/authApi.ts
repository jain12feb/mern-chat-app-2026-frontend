import { apiSlice } from './apiSlice';

export const authApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
    }),
    register: builder.mutation({
      query: (userData) => ({
        url: '/auth/register',
        method: 'POST',
        body: userData,
      }),
    }),
    refresh: builder.mutation({
      query: () => ({
        url: '/auth/refresh',
        method: 'POST',
      }),
    }),
    logoutApi: builder.mutation({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
    }),
    updateProfile: builder.mutation({
      query: (userData) => ({
        url: '/auth/profile',
        method: 'PUT',
        body: userData,
      }),
    }),
    checkUsername: builder.query({
      query: (username) => ({
        url: `/auth/check-username/${username}`,
        method: 'GET',
      }),
    }),
    deleteAccount: builder.mutation({
      query: () => ({
        url: '/auth/account',
        method: 'DELETE',
      }),
    }),
  }),
});

export const { 
  useLoginMutation, 
  useRegisterMutation, 
  useRefreshMutation, 
  useLogoutApiMutation, 
  useUpdateProfileMutation, 
  useLazyCheckUsernameQuery,
  useDeleteAccountMutation 
} = authApi;
