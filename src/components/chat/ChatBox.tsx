import { useState, useEffect, useRef, Fragment } from "react";
import { useSelector, useDispatch } from "react-redux";
import { type RootState, type AppDispatch } from "../../store";
import {
  Send,
  Loader2,
  MessageSquare,
  PanelLeftOpen,
  Check,
  CheckCheck,
  MoreVertical,
  Edit2,
  Trash2,
  X,
  CornerDownLeft,
  Reply,
  Forward,
  Bell,
  BellOff,
  ChevronDown,
  Smile,
  Sparkles,
  Pin,
  PinOff,
  Users,
  Phone,
  Video,
} from "lucide-react";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { useTheme } from "next-themes";
import {
  useDeleteMessageMutation,
  useReactToMessageMutation,
  messageApi,
  useFetchMessagesQuery,
  useSendMessageMutation,
  useUpdateMessageMutation,
  useSendMediaMessageMutation,
  useGetUploadUrlMutation,
} from "../../store/messageApi";
import {
  chatApi,
  useFetchChatsQuery,
  useSuggestRepliesMutation,
  useTogglePinMessageMutation,
  useToggleMuteChatMutation,
  useDeleteChatMutation,
  useSummarizeChatMutation,
  useRemoveFromGroupMutation,
} from "../../store/chatApi";
import { setHighlightedMessage, setSelectedChat } from "../../store/chatSlice";
import { useSocket } from "../../context/SocketContext";
import { useWebRTC } from "../../context/WebRTCContext";
import GroupSettingsModal from "./GroupSettingsModal";
import AttachmentMenu from "./AttachmentMenu";
import MediaRenderer from "./MediaRenderer";
import AudioRecorder from "./AudioRecorder";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Skeleton } from "../ui/skeleton";

interface ChatBoxProps {
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

// Global Admin Settings Mock (Will be fetched from DB/Redux in the future)
const adminEditConfig = {
  rule: "both", // 'time', 'read', 'both', 'none'
  timeLimitMinutes: 15,
};

const formatDateDivider = (date: Date) => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return "Today";
  } else if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  } else {
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
};

const ChatBox = ({ isSidebarOpen, onToggleSidebar }: ChatBoxProps) => {
  const { theme } = useTheme();
  const { onlineUsers } = useSocket();
  const { startCall } = useWebRTC();
  const [newMessage, setNewMessage] = useState("");
  const [typing, setTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<
    { userId: string; username: string }[]
  >([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [replyingToMessage, setReplyingToMessage] = useState<any | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<any | null>(null);
  const [selectedForwardChatIds, setSelectedForwardChatIds] = useState<
    string[]
  >([]);
  const [forwardSearch, setForwardSearch] = useState("");
  const [isForwarding, setIsForwarding] = useState(false);
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isLeaveGroupDialogOpen, setIsLeaveGroupDialogOpen] = useState(false);
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const [userSettings, setUserSettings] = useState(() => {
    const saved = localStorage.getItem("nexus_user_settings");
    return saved
      ? JSON.parse(saved)
      : {
          smartReplies: true,
          enterToSend: true,
          soundNotifications: true,
          desktopNotifications: false,
          aiSummarization: true,
          readReceipts: true,
        };
  });
  const { userInfo } = useSelector((state: RootState) => state.auth);
  const { selectedChat, highlightedMessageId: reduxHighlightedId } =
    useSelector((state: RootState) => state.chat);
  const dispatch = useDispatch<AppDispatch>();

  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Use skip: !selectedChat to avoid fetching when no chat is selected
  const {
    data: messagesData,
    isLoading: messagesLoading,
    isFetching: messagesFetching,
  } = useFetchMessagesQuery(
    { chatId: selectedChat?._id as string, before: cursor },
    { skip: !selectedChat },
  );

  const messages = messagesData?.messages || [];
  const hasMore = messagesData?.hasMore || false;

  // Reset cursor when switching chats
  useEffect(() => {
    setCursor(undefined);
  }, [selectedChat?._id]);

  // Load more messages when intersection observer is triggered
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || messagesFetching || !selectedChat)
      return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasMore &&
          !messagesFetching &&
          messages.length > 0
        ) {
          // Use the timestamp of the oldest message as the cursor
          setCursor(messages[0].createdAt);
        }
      },
      { threshold: 0.1, rootMargin: "100px 0px 0px 0px" }, // Load a bit earlier
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, messagesFetching, messages.length, selectedChat?._id]);
  const { data: chats = [] } = useFetchChatsQuery(undefined);

  const [sendMessage, { isLoading: sending }] = useSendMessageMutation();
  const [updateMessage] = useUpdateMessageMutation();
  const [deleteMessage] = useDeleteMessageMutation();
  const [reactToMessage] = useReactToMessageMutation();
  const [togglePinMessage] = useTogglePinMessageMutation();
  const [toggleMuteChat] = useToggleMuteChatMutation();
  const [deleteChat] = useDeleteChatMutation();
  const [summarizeChat, { isLoading: summarizationLoading }] =
    useSummarizeChatMutation();
  const [removeFromGroup] = useRemoveFromGroupMutation();
  const [suggestReplies, { isLoading: suggestionsLoading }] =
    useSuggestRepliesMutation();
  const [sendMediaMessage] = useSendMediaMessageMutation();
  const [getUploadUrl] = useGetUploadUrlMutation();

  const { socket, isConnected } = useSocket();

  // Jump to highlighted message from search
  useEffect(() => {
    if (
      reduxHighlightedId &&
      messageRefs.current[reduxHighlightedId] &&
      messages
    ) {
      setTimeout(() => {
        messageRefs.current[reduxHighlightedId]?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        setHighlightedMessageId(reduxHighlightedId);

        // Remove highlight after 2 seconds
        setTimeout(() => {
          setHighlightedMessageId(null);
          // Only clear if it hasn't been changed to another ID
          dispatch(setHighlightedMessage(null));
        }, 2000);
      }, 400);
    }
  }, [reduxHighlightedId, messages]);

  const scrollToBottom = () => {
    // A small timeout ensures the DOM has completely finished painting all message heights
    // before the browser calculates the scroll position. This fixes the "stuck at top" bug.
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, selectedChat]);

  const updateChatListCache = (msg: any, isCurrentChat: boolean) => {
    dispatch(
      chatApi.util.updateQueryData(
        "fetchChats" as any,
        undefined as any,
        (draft: any) => {
          const msgChatId = msg.chatId?._id || msg.chatId;
          const chatIndex = draft.findIndex(
            (c: any) => c._id === msgChatId,
          );
          if (chatIndex !== -1) {
            draft[chatIndex].latestMessage = msg;

            // Increment unread count if it's not the currently open chat and the sender is not us
            const msgSenderId = msg.senderId?._id || msg.senderId;
            if (!isCurrentChat && msgSenderId !== userInfo._id) {
              const userCount = draft[chatIndex].unreadCounts?.find(
                (uc: any) => uc.user === userInfo._id,
              );
              if (userCount) {
                userCount.count += 1;
              } else {
                if (!draft[chatIndex].unreadCounts)
                  draft[chatIndex].unreadCounts = [];
                draft[chatIndex].unreadCounts.push({
                  user: userInfo._id,
                  count: 1,
                });
              }
            }

            // Move chat to top of the list
            const [chat] = draft.splice(chatIndex, 1);
            draft.unshift(chat);
          } else {
            // Chat not in cache (new chat/group), add it to the top
            const newChat = { ...msg.chatId };
            newChat.latestMessage = msg;
            if (!isCurrentChat) {
              newChat.unreadCounts = [
                {
                  user: userInfo._id,
                  count: 1,
                },
              ];
            }
            draft.unshift(newChat);
          }
        },
      ) as any,
    );
  };

  // Join the socket room for the current chat
  useEffect(() => {
    setTypingUsers([]); // Clear typing status when switching chats
    if (socket && selectedChat && isConnected) {
      socket.emit("join_chat", selectedChat._id);
      if (userSettings.readReceipts) {
        socket.emit("mark_as_read", {
          chatId: selectedChat._id,
          userId: userInfo._id,
        });
      }
    }
  }, [
    socket,
    selectedChat,
    isConnected,
    userInfo._id,
    userSettings.readReceipts,
  ]);

  const selectedChatRef = useRef(selectedChat);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  // Listen for settings updates
  useEffect(() => {
    const handleSettingsUpdate = () => {
      const saved = localStorage.getItem("nexus_user_settings");
      if (saved) setUserSettings(JSON.parse(saved));
    };
    window.addEventListener("nexus_settings_updated", handleSettingsUpdate);
    return () =>
      window.removeEventListener(
        "nexus_settings_updated",
        handleSettingsUpdate,
      );
  }, []);

  // Listen for incoming messages
  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (newMessageRecv: any) => {
      const currentChat = selectedChatRef.current;
      const msgChatId = newMessageRecv.chatId?._id || newMessageRecv.chatId;
      const isCurrentChat =
        currentChat && String(currentChat._id) === String(msgChatId);

      // Always update the sidebar cache
      updateChatListCache(newMessageRecv, isCurrentChat);

      // Always update RTK Query cache for the chat, even if not open
      dispatch(
        messageApi.util.updateQueryData(
          "fetchMessages",
          { chatId: String(msgChatId) },
          (draft) => {
            if (!draft.messages.find((m: any) => m._id === newMessageRecv._id)) {
              draft.messages.push(newMessageRecv);
            }
          },
        ) as any,
      );

      if (isCurrentChat) {
        if (userSettings.readReceipts) {
          socket.emit("mark_as_read", {
            chatId: currentChat._id,
            userId: userInfo._id,
          });
        }
      } else if (newMessageRecv.senderId?._id !== userInfo._id) {
        // Check if chat is muted
        const chatInCache = chats.find((c: any) => c._id === String(msgChatId));
        const isMuted = chatInCache?.mutedBy?.includes(userInfo._id);

        if (!isMuted) {
          // Show notification for message in other chat
          const senderName = newMessageRecv.senderId?.username || "Someone";
          const chatName = newMessageRecv.chatId?.chatName || senderName;

          toast(chatName, {
            description: `${senderName}: ${newMessageRecv.content.length > 50 ? newMessageRecv.content.substring(0, 50) + "..." : newMessageRecv.content}`,
            action: {
              label: "View",
              onClick: () => {
                dispatch(setSelectedChat(newMessageRecv.chatId));
              },
            },
          });
        }
      }

      // Fetch smart replies if message is from others and setting is enabled
      if (
        newMessageRecv.senderId?._id !== userInfo._id &&
        isCurrentChat &&
        userSettings.smartReplies
      ) {
        handleFetchSuggestions(msgChatId);
      }
    };

    const handleFetchSuggestions = async (chatId: string) => {
      try {
        const result = await suggestReplies({ chatId }).unwrap();
        setSmartReplies(result.suggestions || []);
      } catch (err) {
        console.error("Failed to fetch suggestions:", err);
      }
    };

    const handleMessagesRead = ({
      chatId,
      readerId,
    }: {
      chatId: string;
      readerId: string;
    }) => {
      const currentChat = selectedChatRef.current;
      if (currentChat && String(currentChat._id) === String(chatId)) {
        dispatch(
          messageApi.util.updateQueryData(
            "fetchMessages",
            { chatId: String(chatId) },
            (draft) => {
              for (let i = 0; i < draft.messages.length; i++) {
                const msg = draft.messages[i];
                const msgSenderId = String(msg.senderId?._id || msg.senderId);

                if (msgSenderId === String(userInfo._id)) {
                  const currentReadBy = msg.readBy || [];
                  const readerIdStr = String(readerId);
                  const alreadyRead = currentReadBy.some(
                    (r: any) => String(r) === readerIdStr,
                  );

                  if (!alreadyRead) {
                    draft.messages[i] = {
                      ...msg,
                      readBy: [...currentReadBy, readerIdStr],
                    };
                  }
                }
              }
            },
          ) as any,
        );
      }
    };

    const handleTyping = (data: any) => {
      const currentChat = selectedChatRef.current;
      if (
        currentChat &&
        String(currentChat._id) === String(data.chatId) &&
        String(data.userId) !== String(userInfo._id)
      ) {
        setTypingUsers((prev) => {
          if (prev.find((u) => String(u.userId) === String(data.userId)))
            return prev;
          return [...prev, { userId: data.userId, username: data.username }];
        });
      }
    };

    const handleStopTyping = (data: any) => {
      const currentChat = selectedChatRef.current;
      if (currentChat && String(currentChat._id) === String(data.chatId)) {
        setTypingUsers((prev) =>
          prev.filter((u) => String(u.userId) !== String(data.userId)),
        );
      }
    };

    const handleGroupUpdate = (updatedChat: any) => {
      // 1. Update the sidebar cache
      dispatch(
        chatApi.util.updateQueryData(
          "fetchChats" as any,
          undefined as any,
          (draft: any) => {
            const chatIndex = draft.findIndex(
              (c: any) => String(c._id) === String(updatedChat._id),
            );
            if (chatIndex !== -1) {
              draft[chatIndex] = { ...draft[chatIndex], ...updatedChat };
            }
          },
        ) as any,
      );

      // 2. Update the selected chat if it's the one being updated
      const currentChat = selectedChatRef.current;
      if (currentChat && String(currentChat._id) === String(updatedChat._id)) {
        dispatch(setSelectedChat(updatedChat));
      }
    };

    const handleAddedToGroup = (newChat: any) => {
      dispatch(
        chatApi.util.updateQueryData(
          "fetchChats" as any,
          undefined as any,
          (draft: any) => {
            const exists = draft.find(
              (c: any) => String(c._id) === String(newChat._id),
            );
            if (!exists) {
              draft.unshift(newChat);
            }
          },
        ) as any,
      );
    };

    const handleRemovedFromGroup = ({ chatId }: { chatId: string }) => {
      // 1. Update sidebar cache
      dispatch(
        chatApi.util.updateQueryData(
          "fetchChats" as any,
          undefined as any,
          (draft: any) => {
            return draft.filter((c: any) => String(c._id) !== String(chatId));
          },
        ) as any,
      );

      // 2. If it's the current chat, close it
      const currentChat = selectedChatRef.current;
      if (currentChat && String(currentChat._id) === String(chatId)) {
        dispatch(setSelectedChat(null));
      }
    };

    const handleMessageUpdated = (updatedMsg: any) => {
      const chatId = String(updatedMsg.chatId?._id || updatedMsg.chatId);
      dispatch(
        messageApi.util.updateQueryData(
          "fetchMessages",
          { chatId },
          (draft) => {
            const index = draft.messages.findIndex(
              (m: any) => m._id === updatedMsg._id,
            );
            if (index !== -1) draft.messages[index] = updatedMsg;
          },
        ) as any,
      );

      // Also update pinned messages in selectedChat if it matches
      if (
        selectedChatRef.current &&
        String(selectedChatRef.current._id) === chatId
      ) {
        const updatedPinned = selectedChatRef.current.pinnedMessages?.map(
          (pm: any) =>
            pm._id === updatedMsg._id ? { ...pm, ...updatedMsg } : pm,
        );
        if (updatedPinned) {
          dispatch(
            setSelectedChat({
              ...selectedChatRef.current,
              pinnedMessages: updatedPinned,
            }),
          );
        }
      }
    };

    const handleMessageDeleted = (deletedMsg: any) => {
      const chatId = String(deletedMsg.chatId?._id || deletedMsg.chatId);
      dispatch(
        messageApi.util.updateQueryData(
          "fetchMessages",
          { chatId },
          (draft) => {
            const index = draft.messages.findIndex(
              (m: any) => m._id === deletedMsg._id,
            );
            if (index !== -1) draft.messages[index] = deletedMsg;
          },
        ) as any,
      );

      // Also update pinned messages in selectedChat (remove if deleted for everyone)
      if (
        selectedChatRef.current &&
        String(selectedChatRef.current._id) === chatId
      ) {
        if (deletedMsg.isDeleted) {
          const updatedPinned = selectedChatRef.current.pinnedMessages?.filter(
            (pm: any) => pm._id !== deletedMsg._id,
          );
          if (updatedPinned) {
            dispatch(
              setSelectedChat({
                ...selectedChatRef.current,
                pinnedMessages: updatedPinned,
              }),
            );
          }
        } else {
          // If just deleted for someone, update the content if needed
          const updatedPinned = selectedChatRef.current.pinnedMessages?.map(
            (pm: any) =>
              pm._id === deletedMsg._id ? { ...pm, ...deletedMsg } : pm,
          );
          if (updatedPinned) {
            dispatch(
              setSelectedChat({
                ...selectedChatRef.current,
                pinnedMessages: updatedPinned,
              }),
            );
          }
        }
      }
    };

    const handleReactionUpdated = (updatedMsg: any) => {
      const chatId = String(updatedMsg.chatId?._id || updatedMsg.chatId);
      console.log("Reaction update received for chat:", chatId, updatedMsg);
      dispatch(
        messageApi.util.updateQueryData(
          "fetchMessages",
          { chatId },
          (draft) => {
            const index = draft.messages.findIndex(
              (m: any) => m._id === updatedMsg._id,
            );
            if (index !== -1) draft.messages[index] = updatedMsg;
          },
        ) as any,
      );

      // Update pinned messages reactions if needed
      if (
        selectedChatRef.current &&
        String(selectedChatRef.current._id) === chatId
      ) {
        const updatedPinned = selectedChatRef.current.pinnedMessages?.map(
          (pm: any) =>
            pm._id === updatedMsg._id
              ? { ...pm, reactions: updatedMsg.reactions }
              : pm,
        );
        if (updatedPinned) {
          dispatch(
            setSelectedChat({
              ...selectedChatRef.current,
              pinnedMessages: updatedPinned,
            }),
          );
        }
      }
    };

    socket.on("receive_message", handleReceiveMessage);
    socket.on("messages_read", handleMessagesRead);
    socket.on("typing", handleTyping);
    socket.on("stop_typing", handleStopTyping);
    socket.on("group_updated_rec", handleGroupUpdate);
    socket.on("added_to_group_rec", handleAddedToGroup);
    socket.on("removed_from_group_rec", handleRemovedFromGroup);
    socket.on("message_updated", handleMessageUpdated);
    socket.on("message_deleted", handleMessageDeleted);
    socket.on("message_reaction_updated", handleReactionUpdated);

    socket.on("pin_updated", (updatedChat: any) => {
      const currentChat = selectedChatRef.current;
      if (currentChat && String(currentChat._id) === String(updatedChat._id)) {
        dispatch(setSelectedChat(updatedChat));
      }

      // Also update the chat list cache
      dispatch(
        chatApi.util.updateQueryData(
          "fetchChats" as any,
          undefined as any,
          (draft: any) => {
            const index = draft.findIndex(
              (c: any) => c._id === updatedChat._id,
            );
            if (index !== -1) {
              draft[index].pinnedMessages = updatedChat.pinnedMessages;
            }
          },
        ) as any,
      );
    });

    return () => {
      socket.off("receive_message", handleReceiveMessage);
      socket.off("messages_read", handleMessagesRead);
      socket.off("typing", handleTyping);
      socket.off("stop_typing", handleStopTyping);
      socket.off("group_updated_rec", handleGroupUpdate);
      socket.off("added_to_group_rec", handleAddedToGroup);
      socket.off("removed_from_group_rec", handleRemovedFromGroup);
      socket.off("message_updated", handleMessageUpdated);
      socket.off("message_deleted", handleMessageDeleted);
      socket.off("message_reaction_updated", handleReactionUpdated);
    };
  }, [socket, dispatch, userInfo._id]);

  const getChatDisplayName = (chat: any) => {
    if (!chat) return "Chat";
    if (chat.isGroupChat) return chat.chatName || "Group Chat";
    const otherUser = chat.participants?.find(
      (p: any) => p._id !== userInfo._id,
    );
    return otherUser ? otherUser.username : "Unknown User";
  };

  const getChatName = () => getChatDisplayName(selectedChat);

  const getMessageSenderName = (message: any) => {
    const senderId = String(message?.senderId?._id || message?.senderId || "");
    return senderId === String(userInfo._id)
      ? "You"
      : message?.senderId?.username || "Unknown";
  };

  const getMessagePreview = (message: any) => {
    if (!message) return "";
    if (message.isDeleted) return "This message was deleted";
    if (message.type === "image") return "Photo";
    if (message.type === "file") return "File";
    return message.content || "";
  };

  const truncateText = (value: string, maxLength = 90) => {
    if (value.length <= maxLength) return value;
    return `${value.slice(0, maxLength)}...`;
  };

  const handleScroll = (viewport: HTMLDivElement) => {
    const { scrollTop, scrollHeight, clientHeight } = viewport;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 300;
    setShowScrollBottom(!isAtBottom);
  };

  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    // The viewport is typically the first child of the ScrollArea root in Radix UI
    const viewport = scrollArea.querySelector(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLDivElement;
    if (!viewport) return;

    const onScroll = () => handleScroll(viewport);
    viewport.addEventListener("scroll", onScroll);

    // Initial check
    onScroll();

    return () => viewport.removeEventListener("scroll", onScroll);
  }, [messages, selectedChat]);

  const jumpToMessage = (messageId?: string) => {
    if (!messageId) return;
    const target = messageRefs.current[messageId];
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedMessageId(messageId);
    window.setTimeout(() => {
      setHighlightedMessageId((current) =>
        current === messageId ? null : current,
      );
    }, 1800);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      socket?.emit("stop_typing", {
        chatId: selectedChat._id,
        userId: userInfo._id,
        username: userInfo.username,
      });
      setTyping(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      const messageData = await sendMessage({
        content: newMessage,
        chatId: selectedChat._id,
        replyToId: replyingToMessage?._id,
      }).unwrap();

      setNewMessage("");
      setReplyingToMessage(null);

      // Optimistically update the message list for the sender
      dispatch(
        messageApi.util.updateQueryData(
          "fetchMessages",
          { chatId: selectedChat._id },
          (draft) => {
            draft.messages.push(messageData);
          },
        ) as any,
      );

      // Update sidebar for sender too
      updateChatListCache(messageData, true);

      // Emit through socket so other users receive it instantly
      if (socket && messageData) {
        socket.emit("send_message", messageData);
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      toast.error("Failed to send message");
    }
  };

  const handleEmojiClick = (emojiData: any) => {
    setNewMessage((prev) => prev + emojiData.emoji);
  };

  const handleReplyMessage = (message: any) => {
    setReplyingToMessage(message);
    setEditingMessageId(null);
  };

  const handleForwardSelection = (chatId: string) => {
    setSelectedForwardChatIds((current) =>
      current.includes(chatId)
        ? current.filter((id) => id !== chatId)
        : [...current, chatId],
    );
  };

  const openForwardModal = (message: any) => {
    setForwardingMessage(message);
    setSelectedForwardChatIds([]);
    setForwardSearch("");
  };

  const closeForwardModal = () => {
    setForwardingMessage(null);
    setSelectedForwardChatIds([]);
    setForwardSearch("");
  };

  const handleSendAudio = async (blob: Blob) => {
    if (!selectedChat) return;

    try {
      // 1. Get Presigned URL
      const { uploadUrl, fileUrl } = await getUploadUrl({
        fileType: "audio/webm",
        fileName: "voice-note.webm"
      }).unwrap();

      // 2. Upload directly to R2
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: blob,
        headers: {
          "Content-Type": "audio/webm",
        },
      });

      if (!uploadRes.ok) throw new Error("Audio upload failed");

      // 3. Send message metadata
      const payload = {
        chatId: selectedChat._id,
        type: "audio",
        mediaUrl: fileUrl,
        replyToId: replyingToMessage?._id,
      };

      const messageData = await sendMediaMessage(payload).unwrap();

      dispatch(
        messageApi.util.updateQueryData(
          "fetchMessages",
          { chatId: selectedChat._id },
          (draft) => {
            draft.messages.push(messageData);
          },
        ) as any,
      );

      updateChatListCache(messageData, true);

      if (socket && messageData) {
        socket.emit("send_message", messageData);
      }
    } catch (err) {
      console.error("Audio send error:", err);
      toast.error("Failed to send audio message");
    }
  };

  const handleForwardMessage = async () => {
    if (!forwardingMessage || selectedForwardChatIds.length === 0) return;

    setIsForwarding(true);

    try {
      for (const chatId of selectedForwardChatIds) {
        const forwardedMsg = await sendMessage({
          content: getMessagePreview(forwardingMessage),
          chatId,
          isForwarded: true,
        }).unwrap();

        const isCurrentChat = String(chatId) === String(selectedChat._id);

        if (isCurrentChat) {
          dispatch(
            messageApi.util.updateQueryData(
              "fetchMessages",
              { chatId },
              (draft) => {
                if (!draft.messages.find((m: any) => m._id === forwardedMsg._id)) {
                  draft.messages.push(forwardedMsg);
                }
              },
            ) as any,
          );
        }

        updateChatListCache(forwardedMsg, isCurrentChat);

        if (socket && forwardedMsg) {
          socket.emit("send_message", forwardedMsg);
        }
      }

      closeForwardModal();
    } catch (err) {
      console.error("Failed to forward message:", err);
    } finally {
      setIsForwarding(false);
    }
  };

  const handleUpdateMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editContent.trim() || !editingMessageId) return;

    try {
      const updatedMsg = await updateMessage({
        messageId: editingMessageId,
        content: editContent,
      }).unwrap();

      // Update the cache locally
      dispatch(
        messageApi.util.updateQueryData(
          "fetchMessages",
          { chatId: selectedChat._id },
          (draft) => {
            const index = draft.messages.findIndex(
              (m: any) => m._id === editingMessageId,
            );
            if (index !== -1) draft.messages[index] = updatedMsg;
          },
        ) as any,
      );

      // Also update pinned messages in selectedChat if it matches
      if (selectedChat?.pinnedMessages?.length > 0) {
        const updatedPinned = selectedChat.pinnedMessages.map((pm: any) =>
          pm._id === editingMessageId ? { ...pm, ...updatedMsg } : pm,
        );
        dispatch(
          setSelectedChat({ ...selectedChat, pinnedMessages: updatedPinned }),
        );
      }

      if (socket && updatedMsg) {
        socket.emit("update_message", updatedMsg);
      }
      setEditingMessageId(null);
      setEditContent("");
    } catch (err) {
      console.error("Failed to update message:", err);
    }
  };

  const handleDeleteMessage = async (
    messageId: string,
    deleteType: "me" | "all",
  ) => {
    try {
      const deletedMsg = await deleteMessage({
        messageId,
        deleteType,
      }).unwrap();

      dispatch(
        messageApi.util.updateQueryData(
          "fetchMessages",
          { chatId: selectedChat._id },
          (draft) => {
            const index = draft.messages.findIndex(
              (m: any) => m._id === messageId,
            );
            if (index !== -1) {
              if (deleteType === "me") {
                draft.messages[index] = deletedMsg;
              } else {
                draft.messages[index] = deletedMsg;
              }
            }
          },
        ) as any,
      );

      // Also update pinned messages in selectedChat (remove if deleted for everyone)
      if (selectedChat?.pinnedMessages?.length > 0) {
        if (deleteType === "all" && deletedMsg.isDeleted) {
          const updatedPinned = selectedChat.pinnedMessages.filter(
            (pm: any) => pm._id !== messageId,
          );
          dispatch(
            setSelectedChat({ ...selectedChat, pinnedMessages: updatedPinned }),
          );
        } else {
          // Update the content (e.g. if it's now marked as deleted for me)
          const updatedPinned = selectedChat.pinnedMessages.map((pm: any) =>
            pm._id === messageId ? { ...pm, ...deletedMsg } : pm,
          );
          dispatch(
            setSelectedChat({ ...selectedChat, pinnedMessages: updatedPinned }),
          );
        }
      }

      if (deleteType === "all" && socket && deletedMsg) {
        socket.emit("delete_message", deletedMsg);
      }
    } catch (err) {
      console.error("Failed to delete message:", err);
    }
  };

  const handleReact = async (messageId: string, emoji: string) => {
    try {
      const updatedMsg = await reactToMessage({ messageId, emoji }).unwrap();

      // Update the cache locally
      dispatch(
        messageApi.util.updateQueryData(
          "fetchMessages",
          { chatId: selectedChat._id },
          (draft) => {
            const index = draft.messages.findIndex(
              (m: any) => m._id === messageId,
            );
            if (index !== -1) draft.messages[index] = updatedMsg;
          },
        ) as any,
      );

      // Update pinned messages reactions if needed
      if (selectedChat?.pinnedMessages?.length > 0) {
        const updatedPinned = selectedChat.pinnedMessages.map((pm: any) =>
          pm._id === messageId
            ? { ...pm, reactions: updatedMsg.reactions }
            : pm,
        );
        dispatch(
          setSelectedChat({ ...selectedChat, pinnedMessages: updatedPinned }),
        );
      }

      if (socket && updatedMsg) {
        socket.emit("send_reaction", updatedMsg);
      }
    } catch (err) {
      console.error("Failed to react to message:", err);
    }
  };

  const handlePinMessage = async (messageId: string) => {
    try {
      const updatedChat = await togglePinMessage({
        chatId: selectedChat._id,
        messageId,
      }).unwrap();

      // Update local Redux state
      dispatch(setSelectedChat(updatedChat));

      // Notify others
      if (socket && updatedChat) {
        socket.emit("pin_message", updatedChat);
      }

      toast.success("Pin status updated");
    } catch (err) {
      console.error("Failed to pin message:", err);
      toast.error("Failed to update pin status");
    }
  };

  const handleToggleMute = async () => {
    try {
      const updatedChat = await toggleMuteChat({
        chatId: selectedChat._id,
      }).unwrap();
      dispatch(setSelectedChat(updatedChat));
      toast.success(
        updatedChat.mutedBy.includes(userInfo._id)
          ? "Chat muted"
          : "Chat unmuted",
      );
    } catch (err) {
      console.error("Failed to toggle mute:", err);
      toast.error("Failed to update mute status");
    }
  };

  const handleDeleteChat = async () => {
    if (!selectedChat) return;
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteChat = async () => {
    try {
      await deleteChat(selectedChat._id).unwrap();
      dispatch(setSelectedChat(null));
      toast.success("Chat deleted successfully");
      setIsDeleteDialogOpen(false);
    } catch (err: any) {
      console.error("Failed to delete chat:", err);
      toast.error(err.data?.message || "Failed to delete chat");
    }
  };

  const handleSummarize = async () => {
    if (!selectedChat) {
      toast.error("Select a chat to summarize");
      return;
    }

    try {
      setIsAIPanelOpen(true);
      setAiSummary(""); // Reset previous summary
      const result = await summarizeChat({ chatId: selectedChat._id }).unwrap();
      setAiSummary(result.summary);
    } catch (err) {
      console.error("Summarization failed:", err);
      toast.error("Failed to summarize chat. Try again later.");
      setIsAIPanelOpen(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!selectedChat) return;
    setIsLeaveGroupDialogOpen(true);
  };

  const confirmLeaveGroup = async () => {
    try {
      await removeFromGroup({
        chatId: selectedChat._id,
        userId: userInfo._id,
      }).unwrap();
      dispatch(setSelectedChat(null));
      toast.success("You have left the group");
      setIsLeaveGroupDialogOpen(false);
    } catch (err: any) {
      console.error("Failed to leave group:", err);
      toast.error(err.data?.message || "Failed to leave group");
    }
  };

  const typingHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);

    if (!socket || !isConnected) return;

    if (!typing) {
      setTyping(true);
      socket.emit("typing", {
        chatId: selectedChat._id,
        userId: userInfo._id,
        username: userInfo.username,
      });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stop_typing", {
        chatId: selectedChat._id,
        userId: userInfo._id,
        username: userInfo.username,
      });
      setTyping(false);
    }, 3000);
  };

  if (!selectedChat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#fafafa] dark:bg-[#121212] p-8 text-center relative z-0">
        {!isSidebarOpen && onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="absolute top-6 left-6 p-2 bg-white dark:bg-zinc-800 text-gray-500 hover:text-primary rounded-lg shadow-md border border-gray-100 dark:border-zinc-700 transition-all"
            title="Open Sidebar"
          >
            <PanelLeftOpen size={24} />
          </button>
        )}
        <div className="w-20 h-20 bg-gray-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6 shadow-sm">
          <MessageSquare
            size={40}
            className="text-gray-300 dark:text-zinc-600"
          />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Nexus AI Collaboration
        </h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-sm">
          Select a colleague from the sidebar to start a conversation or search
          for someone new.
        </p>
      </div>
    );
  }

  const filteredForwardChats = chats.filter((chat: any) => {
    const chatName = getChatDisplayName(chat).toLowerCase();
    return chatName.includes(forwardSearch.toLowerCase());
  });

  return (
    <div className="flex flex-col h-full bg-slate-50/50 dark:bg-[#121212] relative z-0">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar className="w-11 h-11 shadow-inner ring-1 ring-border">
              <AvatarFallback
                className={`text-white font-bold text-lg ${
                  selectedChat.isGroupChat
                    ? "bg-gradient-to-tr from-purple-500 to-indigo-500"
                    : "bg-gradient-to-tr from-gray-300 to-gray-400 dark:from-zinc-600 dark:to-zinc-500"
                }`}
              >
                {getChatName()?.charAt(0)?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            {!selectedChat.isGroupChat && (
              <div
                className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-white dark:border-zinc-900 rounded-full z-10 ${
                  onlineUsers.includes(
                    selectedChat.participants.find(
                      (p: any) => p._id !== userInfo._id,
                    )?._id,
                  )
                    ? "bg-green-500"
                    : "bg-gray-400"
                }`}
              ></div>
            )}
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-gray-100 text-[17px]">
              {getChatName()}
            </h3>
            {selectedChat.isGroupChat ? (
              <p className="text-xs text-gray-500 font-medium">
                {selectedChat.participants.length} members
              </p>
            ) : (
              <p
                className={`text-xs font-medium ${
                  onlineUsers.includes(
                    selectedChat.participants.find(
                      (p: any) => p._id !== userInfo._id,
                    )?._id,
                  )
                    ? "text-green-600 dark:text-green-500"
                    : "text-gray-500"
                }`}
              >
                {onlineUsers.includes(
                  selectedChat.participants.find(
                    (p: any) => p._id !== userInfo._id,
                  )?._id,
                )
                  ? "Online"
                  : "Offline"}
              </p>
            )}
          </div>
        </div>

        {/* Right side header actions */}
        <div className="flex items-center gap-2">
          
          {/* WebRTC Call Buttons */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => startCall(selectedChat._id, selectedChat.participants, 'audio')}
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-green-600 hover:bg-green-600/10 transition-all"
              >
                <Phone size={18} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Voice Call</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => startCall(selectedChat._id, selectedChat.participants, 'video')}
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-blue-600 hover:bg-blue-600/10 transition-all"
              >
                <Video size={18} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Video Call</TooltipContent>
          </Tooltip>

          {selectedChat.pinnedMessages?.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 px-2 text-primary hover:bg-primary/10 rounded-lg font-bold transition-all animate-in fade-in slide-in-from-right-2 duration-300"
                >
                  <Pin size={14} fill="currentColor" className="rotate-45" />
                  <span className="text-xs">
                    {selectedChat.pinnedMessages.length} Pinned
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                className="max-w-xs p-0 border border-border/50 shadow-2xl overflow-hidden z-50 rounded-lg"
              >
                <div className="bg-card rounded-lg overflow-hidden w-64">
                  <div className="px-3 py-2 bg-primary/5 border-b border-border/50 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                      Pinned Messages
                    </span>
                  </div>
                  <ScrollArea className="max-h-[300px]">
                    <div className="p-2 space-y-1">
                      {selectedChat.pinnedMessages.map((pm: any) => (
                        <button
                          key={pm._id}
                          onClick={() => jumpToMessage(pm._id)}
                          className="w-full text-left p-2 hover:bg-accent rounded-lg transition-all border border-transparent hover:border-border/50 group"
                        >
                          <p className="text-[10px] font-bold text-primary mb-0.5 group-hover:text-primary/80">
                            {pm.senderId?.username || "User"}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-2 italic leading-relaxed">
                            "{pm.content}"
                          </p>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                // size="icon"
                onClick={handleToggleMute}
                className={`h-8 px-3 rounded-lg transition-all ${
                  selectedChat.mutedBy?.includes(userInfo._id)
                    ? "text-red-500 hover:bg-red-500/10"
                    : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                }`}
              >
                {selectedChat.mutedBy?.includes(userInfo._id) ? (
                  <BellOff size={16} className="mr-2" />
                ) : (
                  <Bell size={16} className="mr-2" />
                )}
                Mute
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {selectedChat.mutedBy?.includes(userInfo._id)
                ? "Unmute Chat"
                : "Mute Chat"}
            </TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
              >
                <MoreVertical size={18} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Chat Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={handleSummarize}
                disabled={summarizationLoading}
              >
                <Sparkles className="mr-2 h-4 w-4 text-primary" />
                <span>Summarize Chat</span>
              </DropdownMenuItem>

              {selectedChat.isGroupChat && (
                <DropdownMenuItem onClick={() => setIsSettingsOpen(true)}>
                  <Users className="mr-2 h-4 w-4" />
                  <span>Group Settings</span>
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              {(!selectedChat.isGroupChat ||
                (typeof selectedChat.groupAdmin === "string"
                  ? selectedChat.groupAdmin === userInfo._id
                  : selectedChat.groupAdmin?._id === userInfo._id)) && (
                <DropdownMenuItem
                  onClick={handleDeleteChat}
                  className="text-destructive focus:bg-destructive focus:text-destructive-foreground"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  <span>Delete Chat</span>
                </DropdownMenuItem>
              )}

              {selectedChat.isGroupChat &&
                (typeof selectedChat.groupAdmin === "string"
                  ? selectedChat.groupAdmin !== userInfo._id
                  : selectedChat.groupAdmin?._id !== userInfo._id) && (
                  <DropdownMenuItem
                    onClick={handleLeaveGroup}
                    className="text-destructive focus:bg-destructive focus:text-destructive-foreground"
                  >
                    <CornerDownLeft className="mr-2 h-4 w-4" />
                    <span>Leave Group</span>
                  </DropdownMenuItem>
                )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 min-h-0 relative">
        <ScrollArea
          ref={scrollAreaRef}
          className="h-full w-full bg-transparent"
        >
          <div className="p-6 space-y-6">
            {messagesLoading ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="animate-spin text-primary" size={32} />
              </div>
            ) : (
              <div className="space-y-0">
                {/* Infinite Scroll Trigger */}
                <div
                  ref={loadMoreRef}
                  className="h-10 flex justify-center items-center py-4"
                >
                  {hasMore && (
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400">
                      <Loader2
                        className="animate-spin text-primary"
                        size={16}
                      />
                      <span>Loading older messages...</span>
                    </div>
                  )}
                </div>

                {(() => {
                  const filteredMsgs =
                    messages?.filter(
                      (msg: any) =>
                        !msg.deletedFor?.some(
                          (id: any) =>
                            String(id?._id || id) === String(userInfo._id),
                        ),
                    ) ?? [];

                  type DateGroup = {
                    dateKey: string;
                    date: Date;
                    msgs: { msg: any; idx: number }[];
                  };
                  const groups: DateGroup[] = [];
                  filteredMsgs.forEach((msg: any, i: number) => {
                    const dk = new Date(msg.createdAt).toDateString();
                    const last = groups[groups.length - 1];
                    if (!last || last.dateKey !== dk) {
                      groups.push({
                        dateKey: dk,
                        date: new Date(msg.createdAt),
                        msgs: [{ msg, idx: i }],
                      });
                    } else {
                      last.msgs.push({ msg, idx: i });
                    }
                  });

                  return groups.map((group) => (
                    <div key={group.dateKey} className="relative">
                      <div className="flex justify-center py-3 sticky top-0 z-20">
                        <span className="px-3 py-1 bg-gray-100/95 dark:bg-zinc-800/95 backdrop-blur-sm text-gray-500 dark:text-zinc-400 text-xs font-semibold rounded-full shadow-sm border border-gray-200 dark:border-zinc-700/50 select-none">
                          {formatDateDivider(group.date)}
                        </span>
                      </div>
                      {group.msgs.map(({ msg, idx: index }) => {
                        const msgSenderId = msg.senderId?._id || msg.senderId;
                        const isMine = msgSenderId === userInfo._id;
                        const prevMsg =
                          index > 0 ? filteredMsgs[index - 1] : null;
                        const prevSenderId = prevMsg?.senderId?._id || prevMsg?.senderId;
                        const isFirstInGroup =
                          !prevMsg || prevSenderId !== msgSenderId;

                        const minutesSinceSent =
                          (new Date().getTime() -
                            new Date(msg.createdAt).getTime()) /
                          (1000 * 60);

                        let canEdit = isMine && !msg.isDeleted;
                        if (canEdit) {
                          switch (adminEditConfig.rule) {
                            case "time":
                              canEdit =
                                minutesSinceSent <=
                                adminEditConfig.timeLimitMinutes;
                              break;
                            case "read":
                              canEdit = !msg.readBy || msg.readBy.length === 0;
                              break;
                            case "both":
                              canEdit =
                                minutesSinceSent <=
                                  adminEditConfig.timeLimitMinutes &&
                                (!msg.readBy || msg.readBy.length === 0);
                              break;
                            case "none":
                              break;
                          }
                        }

                        if (msg.type === "system") {
                          return (
                            <Fragment key={msg._id}>
                              <div className="flex justify-center my-4 px-4">
                                <Badge
                                  variant="outline"
                                  className="bg-gray-100/50 dark:bg-zinc-800/30 border-gray-200/50 dark:border-zinc-700/30 px-4 py-1.5 font-medium text-gray-500 dark:text-zinc-400"
                                >
                                  {msg.content}
                                </Badge>
                              </div>
                            </Fragment>
                          );
                        }

                        return (
                          <Fragment key={msg._id}>
                            <div
                              ref={(element) => {
                                messageRefs.current[msg._id] = element;
                              }}
                              className={`flex ${isMine ? "justify-end" : "justify-start"} ${!isFirstInGroup ? "mt-1" : "mt-4"} group relative px-4`}
                            >
                              <div
                                className={`message-bubble relative max-w-[75%] px-5 py-3 transition-all ${
                                  isMine
                                    ? "bg-primary text-white rounded-[20px] rounded-br-[4px] message-bubble-mine"
                                    : "bg-gray-300 dark:bg-zinc-800 text-gray-800 dark:text-gray-100 rounded-[20px] rounded-bl-[4px] message-bubble-other"
                                } ${msg.isDeleted ? "italic opacity-70" : ""} ${highlightedMessageId === msg._id ? "ring-2 ring-primary/60 ring-offset-2 ring-offset-slate-50 dark:ring-offset-[#121212]" : ""}`}
                              >
                                {!isMine &&
                                  selectedChat.isGroupChat &&
                                  isFirstInGroup && (
                                    <p className="text-xs font-bold mb-1 tracking-wide text-indigo-500 dark:text-indigo-400">
                                      {msg.senderId.username}
                                    </p>
                                  )}

                                {editingMessageId === msg._id ? (
                                  <form
                                    onSubmit={handleUpdateMessage}
                                    className="flex flex-col gap-2 min-w-50"
                                  >
                                    <textarea
                                      autoFocus
                                      value={editContent}
                                      onChange={(e) =>
                                        setEditContent(e.target.value)
                                      }
                                      className="w-full bg-black/10 dark:bg-white/10 border-none focus:ring-0 rounded-lg p-2 text-[15px] resize-none"
                                      rows={2}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                          e.preventDefault();
                                          handleUpdateMessage(e as any);
                                        }
                                        if (e.key === "Escape") {
                                          setEditingMessageId(null);
                                        }
                                      }}
                                    />
                                    <div className="flex justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setEditingMessageId(null)
                                        }
                                        className="p-1 hover:bg-white/10 rounded text-xs transition-all flex items-center gap-1"
                                      >
                                        <X size={12} /> Cancel
                                      </button>
                                      <button
                                        type="submit"
                                        className="p-1 bg-white/20 hover:bg-white/30 rounded text-xs transition-all flex items-center gap-1"
                                      >
                                        <CornerDownLeft size={12} /> Save
                                      </button>
                                    </div>
                                  </form>
                                ) : (
                                  <>
                                    {msg.isForwarded && !msg.isDeleted && (
                                      <Badge
                                        variant="secondary"
                                        className="mb-2 h-5 text-[10px] font-bold uppercase tracking-tight"
                                      >
                                        Forwarded
                                      </Badge>
                                    )}

                                    {selectedChat.pinnedMessages?.some(
                                      (m: any) => (m._id || m) === msg._id,
                                    ) && (
                                      <div
                                        className={`absolute -top-1 ${isMine ? "-left-1" : "-right-1"} bg-primary/20 dark:bg-primary/30 p-1 rounded-full shadow-sm backdrop-blur-sm z-20 border border-primary/20`}
                                      >
                                        <Pin
                                          size={12}
                                          className="text-primary rotate-45"
                                          fill="currentColor"
                                        />
                                      </div>
                                    )}

                                    {msg.replyTo && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          jumpToMessage(msg.replyTo._id)
                                        }
                                        className={`w-full text-left rounded-xl px-3 py-2 mb-2 border-l-3 ${
                                          isMine
                                            ? "bg-white/15 border-white/80 hover:bg-white/20"
                                            : "bg-gray-100 dark:bg-zinc-900/80 border-primary/70 hover:bg-gray-200/80 dark:hover:bg-zinc-900"
                                        } transition-colors`}
                                      >
                                        <p
                                          className={`text-[11px] font-semibold ${isMine ? "text-primary-50" : "text-primary"}`}
                                        >
                                          {getMessageSenderName(msg.replyTo)}
                                        </p>
                                        <p
                                          className={`text-xs mt-0.5 ${isMine ? "text-primary-100" : "text-gray-500 dark:text-gray-400"}`}
                                        >
                                          {truncateText(
                                            getMessagePreview(msg.replyTo),
                                            80,
                                          )}
                                        </p>
                                      </button>
                                    )}

                                    <div className="flex flex-wrap items-end gap-2">
                                      <MediaRenderer
                                        message={msg}
                                        isMine={isMine}
                                      />

                                      {msg.isEdited && !msg.isDeleted && (
                                        <span
                                          className={`text-[9px] uppercase tracking-wider font-bold mb-0.5 ${isMine ? "text-primary-200" : "text-gray-400"}`}
                                        >
                                          (edited)
                                        </span>
                                      )}
                                    </div>

                                    <div
                                      className={`flex items-center justify-end gap-1 text-[10px] mt-1 font-medium ${isMine ? "text-primary-100/90" : "text-gray-400"}`}
                                    >
                                      <span>
                                        {new Date(
                                          msg.createdAt,
                                        ).toLocaleTimeString([], {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </span>
                                      {isMine && (
                                        <span className="ml-0.5">
                                          {msg.readBy &&
                                          msg.readBy.length > 0 ? (
                                            <CheckCheck
                                              size={14}
                                              className="text-blue-300 dark:text-blue-400"
                                            />
                                          ) : (
                                            <Check
                                              size={14}
                                              className="opacity-70"
                                            />
                                          )}
                                        </span>
                                      )}
                                    </div>

                                    {/* Reactions Display */}
                                    {msg.reactions?.length > 0 && (
                                      <div
                                        className={`flex flex-wrap gap-1 mt-2 ${isMine ? "justify-end" : "justify-start"}`}
                                      >
                                        {Object.entries(
                                          msg.reactions.reduce(
                                            (acc: any, curr: any) => {
                                              acc[curr.emoji] =
                                                (acc[curr.emoji] || 0) + 1;
                                              return acc;
                                            },
                                            {},
                                          ),
                                        ).map(
                                          ([emoji, count]: [string, any]) => {
                                            const hasMyReaction =
                                              msg.reactions.some(
                                                (r: any) =>
                                                  String(
                                                    r.user?._id || r.user,
                                                  ) === String(userInfo._id) &&
                                                  r.emoji === emoji,
                                              );

                                            const reactors = msg.reactions
                                              .filter(
                                                (r: any) => r.emoji === emoji,
                                              )
                                              .map(
                                                (r: any) =>
                                                  r.user?.username || "Unknown",
                                              )
                                              .join(", ");

                                            return (
                                              <Tooltip key={emoji}>
                                                <TooltipTrigger asChild>
                                                  <button
                                                    onClick={() =>
                                                      handleReact(
                                                        msg._id,
                                                        emoji,
                                                      )
                                                    }
                                                    className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold transition-all shadow-sm active:scale-90 ${
                                                      hasMyReaction
                                                        ? "bg-white/15 border-white/80 hover:bg-white/20"
                                                        : "bg-gray-100/0 dark:bg-zinc-700/50 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700"
                                                    }`}
                                                  >
                                                    <span>{emoji}</span>
                                                    <span className="text-[10px]">
                                                      {count}
                                                    </span>
                                                  </button>
                                                </TooltipTrigger>
                                                <TooltipContent
                                                  side="top"
                                                  className="bg-zinc-900 border-zinc-800 text-white"
                                                >
                                                  <p className="text-xs">
                                                    {reactors}
                                                  </p>
                                                </TooltipContent>
                                              </Tooltip>
                                            );
                                          },
                                        )}
                                      </div>
                                    )}
                                  </>
                                )}

                                {/* Message Options Menu */}
                                {!msg.isDeleted &&
                                  editingMessageId !== msg._id && (
                                    <div
                                      className={`absolute top-0 ${isMine ? "-left-12" : "-right-12"} opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity z-30`}
                                    >
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <button
                                            className="p-1.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-500 hover:text-primary rounded-lg shadow-sm transition-all"
                                            title="More actions"
                                          >
                                            <MoreVertical size={14} />
                                          </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                          align={isMine ? "end" : "start"}
                                          side={isMine ? "left" : "right"}
                                          className="min-w-44"
                                        >
                                          {!msg.isDeleted && (
                                            <DropdownMenuSub>
                                              <DropdownMenuSubTrigger>
                                                <Smile size={13} />
                                                Add Reaction
                                              </DropdownMenuSubTrigger>
                                              <DropdownMenuSubContent
                                                sideOffset={10}
                                              >
                                                <EmojiPicker
                                                  reactionsDefaultOpen
                                                  theme={
                                                    theme === "dark"
                                                      ? Theme.DARK
                                                      : Theme.LIGHT
                                                  }
                                                  onEmojiClick={(data) =>
                                                    handleReact(
                                                      msg._id,
                                                      data.emoji,
                                                    )
                                                  }
                                                  autoFocusSearch={false}
                                                  previewConfig={{
                                                    showPreview: false,
                                                  }}
                                                />
                                                {/* <div className="flex flex-wrap gap-1 justify-between">
                                          {commonEmojis.map((emoji) => (
                                            <button
                                              key={emoji}
                                              onClick={() =>
                                                handleReact(msg._id, emoji)
                                              }
                                              className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-xl transition-all hover:scale-110 text-xl"
                                            >
                                              {emoji}
                                            </button>
                                          ))}
                                          <Popover>
                                            <PopoverTrigger asChild>
                                              <button className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-xl transition-all hover:scale-110 text-muted-foreground flex items-center justify-center">
                                                <Plus size={20} />
                                              </button>
                                            </PopoverTrigger>
                                            <PopoverContent
                                              className="p-0 border-none bg-transparent shadow-none"
                                              side="right"
                                              align="start"
                                              sideOffset={10}
                                            >
                                              <EmojiPicker
                                                reactionsDefaultOpen
                                                theme={
                                                  theme === "dark"
                                                    ? Theme.DARK
                                                    : Theme.LIGHT
                                                }
                                                onEmojiClick={(data) =>
                                                  handleReact(
                                                    msg._id,
                                                    data.emoji,
                                                  )
                                                }
                                                autoFocusSearch={false}
                                                previewConfig={{
                                                  showPreview: false,
                                                }}
                                              />
                                            </PopoverContent>
                                          </Popover>
                                        </div> */}
                                              </DropdownMenuSubContent>
                                            </DropdownMenuSub>
                                          )}

                                          {!msg.isDeleted && (
                                            <DropdownMenuItem
                                              onClick={() =>
                                                handleReplyMessage(msg)
                                              }
                                            >
                                              <Reply size={13} />
                                              Reply
                                            </DropdownMenuItem>
                                          )}

                                          {!msg.isDeleted && (
                                            <DropdownMenuItem
                                              onClick={() =>
                                                openForwardModal(msg)
                                              }
                                            >
                                              <Forward size={13} />
                                              Forward
                                            </DropdownMenuItem>
                                          )}

                                          {!msg.isDeleted && (
                                            <DropdownMenuItem
                                              onClick={() =>
                                                handlePinMessage(msg._id)
                                              }
                                            >
                                              {selectedChat.pinnedMessages?.some(
                                                (m: any) =>
                                                  (m._id || m) === msg._id,
                                              ) ? (
                                                <>
                                                  <PinOff
                                                    size={13}
                                                    className="text-destructive"
                                                  />
                                                  Unpin Message
                                                </>
                                              ) : (
                                                <>
                                                  <Pin size={13} />
                                                  Pin Message
                                                </>
                                              )}
                                            </DropdownMenuItem>
                                          )}

                                          {canEdit && (
                                            <DropdownMenuItem
                                              onClick={() => {
                                                setEditingMessageId(msg._id);
                                                setEditContent(msg.content);
                                                setReplyingToMessage(null);
                                              }}
                                            >
                                              <Edit2 size={13} />
                                              Edit
                                            </DropdownMenuItem>
                                          )}

                                          {isMine && (
                                            <DropdownMenuSub>
                                              <DropdownMenuSubTrigger className="text-red-500 focus:text-red-500 dark:focus:text-red-400">
                                                <Trash2 size={13} />
                                                Delete
                                              </DropdownMenuSubTrigger>
                                              <DropdownMenuSubContent
                                                sideOffset={10}
                                              >
                                                <DropdownMenuItem
                                                  onClick={() =>
                                                    handleDeleteMessage(
                                                      msg._id,
                                                      "me",
                                                    )
                                                  }
                                                >
                                                  Delete for me
                                                </DropdownMenuItem>
                                                {!msg.isDeleted && (
                                                  <DropdownMenuItem
                                                    onClick={() =>
                                                      handleDeleteMessage(
                                                        msg._id,
                                                        "all",
                                                      )
                                                    }
                                                    className="text-red-500 focus:text-red-500 dark:focus:text-red-400"
                                                  >
                                                    Delete for everyone
                                                  </DropdownMenuItem>
                                                )}
                                              </DropdownMenuSubContent>
                                            </DropdownMenuSub>
                                          )}
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  )}
                              </div>
                            </div>
                          </Fragment>
                        );
                      })}
                    </div>
                  ));
                })()}

                {typingUsers.length > 0 && (
                  <div className="flex justify-start mt-4 px-4">
                    <div className="bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700/50 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex flex-col gap-1 w-fit">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
                          style={{ animationDelay: "0ms" }}
                        ></span>
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
                          style={{ animationDelay: "150ms" }}
                        ></span>
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
                          style={{ animationDelay: "300ms" }}
                        ></span>
                      </div>
                      <p className="text-[10px] font-medium text-gray-500 dark:text-zinc-400">
                        {typingUsers.length === 1
                          ? `${typingUsers[0].username} is typing...`
                          : typingUsers.length === 2
                            ? `${typingUsers[0].username} and ${typingUsers[1].username} are typing...`
                            : `${typingUsers[0].username} and ${typingUsers.length - 1} others are typing...`}
                      </p>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} className="h-1" />
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Scroll to Bottom Button */}
        {showScrollBottom && (
          <Button
            onClick={() => scrollToBottom()}
            size="icon"
            className="absolute bottom-6 right-8 rounded-full shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-300 z-20 bg-primary/90 hover:bg-primary"
          >
            <ChevronDown size={20} />
          </Button>
        )}
      </div>

      {/* AI Smart Replies */}
      {(suggestionsLoading || smartReplies.length > 0) && (
        <div className="px-6 py-2 flex items-center flex-wrap gap-2 animate-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-2 mr-2">
            <Sparkles
              size={14}
              className={`text-primary ${suggestionsLoading ? "animate-pulse" : ""}`}
            />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              {suggestionsLoading ? "AI Thinking..." : "Nexus Suggestions"}
            </span>
          </div>

          {suggestionsLoading ? (
            <div className="flex gap-2">
              <Skeleton className="h-7 w-20 rounded-full" />
              <Skeleton className="h-7 w-24 rounded-full" />
              <Skeleton className="h-7 w-16 rounded-full" />
            </div>
          ) : (
            <>
              {smartReplies.map((suggestion, idx) => (
                <Badge
                  key={idx}
                  variant="secondary"
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors px-3 py-1.5 text-xs font-medium border-primary/20 bg-primary/5 text-primary"
                  onClick={() => {
                    setNewMessage(suggestion);
                    setSmartReplies([]); // Clear suggestions after picking one
                  }}
                >
                  {suggestion}
                </Badge>
              ))}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setSmartReplies([])}
                title="Dismiss suggestions"
              >
                <X size={12} />
              </Button>
            </>
          )}
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border-t border-gray-200/80 dark:border-zinc-800">
        {replyingToMessage && (
          <div className="max-w-4xl mx-auto mb-3 rounded-2xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/80 px-4 py-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-primary">
                Replying to {getMessageSenderName(replyingToMessage)}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
                {truncateText(getMessagePreview(replyingToMessage), 120)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReplyingToMessage(null)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg transition-colors"
              title="Cancel reply"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <form
          onSubmit={handleSend}
          className="flex gap-3 max-w-4xl mx-auto items-end"
        >
          <div className="flex-1 relative">
            <Input
              value={newMessage}
              onChange={typingHandler}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  userSettings.enterToSend
                ) {
                  handleSend(e);
                }
              }}
              placeholder="Type your message..."
              className="w-full pl-5 pr-12 py-6 bg-gray-100/80 dark:bg-zinc-800/80 border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:bg-white dark:focus:bg-zinc-900 transition-all shadow-inner text-[15px]"
            />
            <div className="absolute right-12 top-1/2 -translate-y-1/2">
              <AttachmentMenu
                chatId={selectedChat._id}
                replyToId={replyingToMessage?._id}
              />
            </div>
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="p-2 text-gray-500 hover:text-primary transition-colors rounded-full hover:bg-gray-200 dark:hover:bg-zinc-700"
                  >
                    <Smile size={22} />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-full p-0 border-none bg-transparent shadow-none"
                  align="end"
                  side="top"
                >
                  <EmojiPicker
                    theme={theme === "dark" ? Theme.DARK : Theme.LIGHT}
                    onEmojiClick={handleEmojiClick}
                    autoFocusSearch={false}
                    previewConfig={{
                      showPreview: false,
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {newMessage.trim() ? (
            <button
              type="submit"
              disabled={sending}
              className="p-3.5 bg-primary text-white rounded-2xl hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-0.5 active:translate-y-0"
            >
              {sending ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <Send size={20} className="ml-0.5" />
              )}
            </button>
          ) : (
            <AudioRecorder onSendAudio={handleSendAudio} />
          )}
        </form>
      </div>

      {selectedChat?.isGroupChat && (
        <GroupSettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      <Dialog
        open={Boolean(forwardingMessage)}
        onOpenChange={(open) => !open && closeForwardModal()}
      >
        <DialogContent className="max-w-md overflow-hidden p-0">
          <DialogHeader className="border-b border-gray-200 dark:border-zinc-800 pr-14">
            <DialogTitle>Forward message</DialogTitle>
            <DialogDescription>Select one or more chats</DialogDescription>
          </DialogHeader>

          <div className="px-5 pt-4">
            {forwardingMessage && (
              <div className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/60 px-4 py-3">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Message preview
                </p>
                <p className="text-sm text-gray-800 dark:text-gray-100 mt-1">
                  {truncateText(getMessagePreview(forwardingMessage), 160)}
                </p>
              </div>
            )}

            <Input
              value={forwardSearch}
              onChange={(e) => setForwardSearch(e.target.value)}
              placeholder="Search chats..."
              className="w-full mt-4 px-4 py-6 rounded-2xl bg-gray-100 dark:bg-zinc-800 border border-transparent focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
            />
          </div>

          <div className="px-3 py-3 max-h-80 overflow-y-auto">
            {filteredForwardChats.length > 0 ? (
              filteredForwardChats.map((chat: any) => {
                const chatId = String(chat._id);
                const isSelected = selectedForwardChatIds.includes(chatId);

                return (
                  <button
                    key={chatId}
                    type="button"
                    onClick={() => handleForwardSelection(chatId)}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-3 rounded-2xl text-left transition-colors ${
                      isSelected
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-gray-100 dark:hover:bg-zinc-800 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="w-10 h-10 ring-1 ring-border">
                        <AvatarFallback className="bg-primary/10 text-primary font-bold">
                          {getChatDisplayName(chat).charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                          {getChatDisplayName(chat)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {chat.isGroupChat
                            ? `${chat.participants.length} members`
                            : "Direct chat"}
                        </p>
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        isSelected
                          ? "border-primary bg-primary text-white"
                          : "border-gray-300 dark:border-zinc-600"
                      }`}
                    >
                      {isSelected && <Check size={12} />}
                    </div>
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                No chats found
              </p>
            )}
          </div>

          <DialogFooter className="border-t border-gray-200 dark:border-zinc-800 justify-between">
            <p className="mr-auto text-sm text-gray-500 dark:text-gray-400">
              {selectedForwardChatIds.length} chat
              {selectedForwardChatIds.length === 1 ? "" : "s"} selected
            </p>
            <button
              type="button"
              onClick={closeForwardModal}
              className="px-4 py-2 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleForwardMessage}
              disabled={selectedForwardChatIds.length === 0 || isForwarding}
              className="px-4 py-2 rounded-xl text-sm bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isForwarding ? "Forwarding..." : "Forward"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Chat Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-[400px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
          <div className="bg-gradient-to-br from-red-50 to-white dark:from-red-950/20 dark:to-zinc-900 p-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-2 animate-bounce">
                <Trash2 className="w-8 h-8 text-red-600 dark:text-red-500" />
              </div>
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Delete Conversation?
                </DialogTitle>
                <DialogDescription className="text-gray-500 dark:text-gray-400 mt-2 text-[15px] leading-relaxed">
                  This action is permanent and will delete all messages for
                  everyone.
                  <span className="block mt-1 font-bold text-red-600 dark:text-red-500">
                    This cannot be undone.
                  </span>
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>

          <DialogFooter className="p-4 bg-gray-50 dark:bg-zinc-900/50 flex flex-col sm:flex-row gap-3 border-t border-gray-100 dark:border-zinc-800">
            <Button
              variant="ghost"
              onClick={() => setIsDeleteDialogOpen(false)}
              className="flex-1 h-12 rounded-xl font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteChat}
              className="flex-1 h-12 rounded-xl font-bold bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/30 text-white"
            >
              Delete Chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave Group Confirmation Dialog */}
      <Dialog
        open={isLeaveGroupDialogOpen}
        onOpenChange={setIsLeaveGroupDialogOpen}
      >
        <DialogContent className="max-w-[400px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
          <div className="bg-gradient-to-br from-orange-50 to-white dark:from-orange-950/20 dark:to-zinc-900 p-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mb-2">
                <CornerDownLeft className="w-8 h-8 text-orange-600 dark:text-orange-500" />
              </div>
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Leave Group?
                </DialogTitle>
                <DialogDescription className="text-gray-500 dark:text-gray-400 mt-2 text-[15px] leading-relaxed">
                  Are you sure you want to leave this group? You will no longer
                  be able to send or receive messages here.
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>

          <DialogFooter className="p-4 bg-gray-50 dark:bg-zinc-900/50 flex flex-col sm:flex-row gap-3 border-t border-gray-100 dark:border-zinc-800">
            <Button
              variant="ghost"
              onClick={() => setIsLeaveGroupDialogOpen(false)}
              className="flex-1 h-12 rounded-xl font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmLeaveGroup}
              className="flex-1 h-12 rounded-xl font-bold bg-orange-600 hover:bg-orange-700 shadow-lg shadow-orange-500/30 text-white border-none"
            >
              Leave Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Summary Side Panel */}
      <Sheet open={isAIPanelOpen} onOpenChange={setIsAIPanelOpen}>
        <SheetContent
          side="right"
          className="w-[400px] sm:w-[540px] p-0 border-l border-border/50 bg-background shadow-2xl"
        >
          <div className="flex flex-col h-full bg-gradient-to-b from-primary/5 to-background">
            <SheetHeader className="p-6 border-b border-border/50 bg-background/50 backdrop-blur-xl">
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                </div>
                <div>
                  <SheetTitle className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                    AI Chat Insights
                  </SheetTitle>
                  <SheetDescription className="text-xs font-medium text-muted-foreground/80">
                    Powered by Nexus Intelligence
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <ScrollArea className="flex-1 p-6">
              {summarizationLoading ? (
                <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse" />
                    <Loader2 className="w-12 h-12 text-primary animate-spin relative z-10" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-bold text-foreground">
                      Analyzing conversation...
                    </p>
                    <p className="text-xs text-muted-foreground animate-pulse">
                      Generating key takeaways and action items
                    </p>
                  </div>
                </div>
              ) : aiSummary ? (
                <div className="prose prose-sm dark:prose-invert max-w-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-card/50 border border-primary/10 rounded-2xl p-6 shadow-sm backdrop-blur-sm">
                    <ReactMarkdown
                      components={{
                        h1: ({ ...props }) => (
                          <h1
                            className="text-lg font-black text-primary mt-0 mb-4 tracking-tight"
                            {...props}
                          />
                        ),
                        h2: ({ ...props }) => (
                          <h2
                            className="text-base font-bold text-foreground mt-6 mb-3 flex items-center gap-2"
                            {...props}
                          />
                        ),
                        p: ({ ...props }) => (
                          <p
                            className="text-sm text-muted-foreground leading-relaxed mb-4"
                            {...props}
                          />
                        ),
                        ul: ({ ...props }) => (
                          <ul className="space-y-2 mb-6" {...props} />
                        ),
                        li: ({ ...props }) => (
                          <li className="flex items-start gap-3" {...props}>
                            <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
                            <span className="text-sm text-muted-foreground">
                              {props.children}
                            </span>
                          </li>
                        ),
                        strong: ({ ...props }) => (
                          <strong
                            className="font-bold text-foreground"
                            {...props}
                          />
                        ),
                      }}
                    >
                      {aiSummary}
                    </ReactMarkdown>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6">
                  <div className="w-20 h-20 bg-muted/30 rounded-full flex items-center justify-center mb-4">
                    <MessageSquare className="w-10 h-10 text-muted-foreground/30" />
                  </div>
                  <p className="text-sm font-bold text-muted-foreground">
                    No summary available
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Try summarizing the conversation again
                  </p>
                </div>
              )}
            </ScrollArea>

            <div className="p-6 border-t border-border/50 bg-background/50 backdrop-blur-sm">
              <Button
                variant="outline"
                className="w-full h-11 rounded-xl font-bold hover:bg-primary hover:text-white transition-all duration-300"
                onClick={() => setIsAIPanelOpen(false)}
              >
                Dismiss Insights
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ChatBox;
