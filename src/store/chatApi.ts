import { apiSlice } from './apiSlice';

export const chatApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    searchUsers: builder.query({
      query: (search) => `/users?search=${search}`,
    }),
    fetchChats: builder.query({
      query: () => '/chats',
      providesTags: ['Chat'],
    }),
    accessChat: builder.mutation({
      query: (userId) => ({
        url: '/chats',
        method: 'POST',
        body: { userId },
      }),
      invalidatesTags: ['Chat'],
    }),
    createGroupChat: builder.mutation({
      query: (groupData) => ({
        url: '/chats/group',
        method: 'POST',
        body: groupData,
      }),
      invalidatesTags: ['Chat'],
    }),
    renameGroup: builder.mutation({
      query: (data) => ({
        url: '/chats/rename',
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['Chat'],
    }),
    addToGroup: builder.mutation({
      query: (data) => ({
        url: '/chats/groupadd',
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['Chat'],
    }),
    removeFromGroup: builder.mutation({
      query: (data) => ({
        url: '/chats/groupremove',
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['Chat'],
    }),
    togglePinChat: builder.mutation({
      query: (data) => ({
        url: '/chats/pin',
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['Chat'],
    }),
    moveToFolder: builder.mutation({
      query: (data) => ({
        url: '/chats/folder',
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['Chat'],
    }),
    togglePinMessage: builder.mutation({
      query: (data) => ({
        url: '/chats/pin-message',
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['Chat'],
    }),
    toggleMuteChat: builder.mutation({
      query: (data) => ({
        url: '/chats/mute',
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['Chat'],
    }),
    summarizeChat: builder.mutation({
      query: (data) => ({
        url: '/ai/summarize',
        method: 'POST',
        body: data,
      }),
    }),
    suggestReplies: builder.mutation({
      query: (data) => ({
        url: '/ai/suggest-replies',
        method: 'POST',
        body: data,
      }),
    }),
    deleteChat: builder.mutation({
      query: (chatId) => ({
        url: `/chats/${chatId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Chat'],
    }),
  }),
});

export const {
  useSearchUsersQuery,
  useLazySearchUsersQuery,
  useFetchChatsQuery,
  useAccessChatMutation,
  useCreateGroupChatMutation,
  useRenameGroupMutation,
  useAddToGroupMutation,
  useRemoveFromGroupMutation,
  useTogglePinChatMutation,
  useMoveToFolderMutation,
  useTogglePinMessageMutation,
  useToggleMuteChatMutation,
  useSummarizeChatMutation,
  useSuggestRepliesMutation,
  useDeleteChatMutation,
} = chatApi;
