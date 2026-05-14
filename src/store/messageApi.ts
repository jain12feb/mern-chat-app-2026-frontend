import { apiSlice } from './apiSlice';

export const messageApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    fetchMessages: builder.query<
      { messages: any[]; hasMore: boolean },
      { chatId: string; before?: string; limit?: number }
    >({
      query: ({ chatId, before, limit = 50 }) => ({
        url: `/messages/${chatId}`,
        params: { before, limit },
      }),
      // Ensure we keep the same cache for a chatId, even when 'before' changes
      serializeQueryArgs: ({ endpointName, queryArgs }) => {
        return `${endpointName}-${queryArgs.chatId}`;
      },
      // Merge strategy for infinite scroll
      merge: (currentCache, newResponse, { arg }) => {
        if (!arg.before) {
          // Fresh load (no cursor), replace cache
          return newResponse;
        }
        // Pagination load, prepend the older messages to the top
        return {
          ...newResponse,
          messages: [...newResponse.messages, ...currentCache.messages],
        };
      },
      // Refetch when the cursor changes (triggered by scroll)
      forceRefetch({ currentArg, previousArg }) {
        return (
          currentArg?.chatId !== previousArg?.chatId ||
          currentArg?.before !== previousArg?.before
        );
      },
      providesTags: (_result, _error, { chatId }) => [{ type: "Message", id: chatId }],
    }),
    sendMessage: builder.mutation({
      query: ({ content, chatId, replyToId, isForwarded }) => ({
        url: '/messages',
        method: 'POST',
        body: { content, chatId, replyToId, isForwarded },
      }),
    }),
    getUploadUrl: builder.mutation<{ uploadUrl: string; fileUrl: string; filename: string }, { fileType: string; fileName?: string }>({
      query: (body) => ({
        url: '/messages/upload-url',
        method: 'POST',
        body,
      }),
    }),
    sendMediaMessage: builder.mutation({
      query: (body) => ({
        url: '/messages/media',
        method: 'POST',
        body,
      }),
    }),
    generateAiImage: builder.mutation({
      query: (body) => ({
        url: '/ai/image',
        method: 'POST',
        body,
      }),
    }),
    votePoll: builder.mutation({
      query: ({ messageId, optionIndex }) => ({
        url: `/messages/${messageId}/poll-vote`,
        method: 'POST',
        body: { optionIndex },
      }),
    }),
    updateMessage: builder.mutation({
      query: ({ messageId, content }) => ({
        url: `/messages/${messageId}`,
        method: 'PUT',
        body: { content },
      }),
    }),
    deleteMessage: builder.mutation({
      query: ({ messageId, deleteType }) => ({
        url: `/messages/${messageId}`,
        method: 'DELETE',
        body: { deleteType }
      }),
    }),
    reactToMessage: builder.mutation({
      query: ({ messageId, emoji }) => ({
        url: `/messages/${messageId}/react`,
        method: 'POST',
        body: { emoji }
      }),
    }),
    searchMessages: builder.query({
      query: ({ q, chatId }) => ({
        url: `/messages/search`,
        params: { q, chatId },
      }),
    }),
  }),
});

export const { 
  useFetchMessagesQuery, 
  useSendMessageMutation,
  useGetUploadUrlMutation,
  useSendMediaMessageMutation,
  useGenerateAiImageMutation,
  useVotePollMutation,
  useUpdateMessageMutation, 
  useDeleteMessageMutation, 
  useReactToMessageMutation,
  useSearchMessagesQuery
} = messageApi;
