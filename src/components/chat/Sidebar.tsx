import { useState, useEffect } from "react";
import {
  Search,
  Loader2,
  MessageSquare,
  Plus,
  Pin,
  PinOff,
  Folder,
  MoreVertical,
  Sparkles,
  Bell,
  BellOff,
  Trash2,
  CornerDownLeft,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { useDispatch, useSelector } from "react-redux";
import { type RootState } from "../../store";
import {
  useFetchChatsQuery,
  useLazySearchUsersQuery,
  useAccessChatMutation,
  useTogglePinChatMutation,
  useMoveToFolderMutation,
  useToggleMuteChatMutation,
  useSummarizeChatMutation,
  useDeleteChatMutation,
  useRemoveFromGroupMutation,
  chatApi,
} from "../../store/chatApi";
import { useSearchMessagesQuery } from "../../store/messageApi";
import { setSelectedChat, setHighlightedMessage } from "../../store/chatSlice";
import { useSocket } from "../../context/SocketContext";
import GroupChatModal from "./GroupChatModal";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { ScrollArea } from "../ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSubTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
} from "../ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Skeleton } from "../ui/skeleton";

const Sidebar = ({ isCollapsed = false }: { isCollapsed?: boolean }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const dispatch = useDispatch();
  const { onlineUsers } = useSocket();

  const [_, setIsAnyChatSelected] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [searchType, setSearchType] = useState<"users" | "messages">("users");
  const [currentFolder, setCurrentFolder] = useState("Inbox");
  const folderNames = ["Inbox", "Projects", "Urgent", "Personal"];
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  const [isLeaveGroupDialogOpen, setIsLeaveGroupDialogOpen] = useState(false);
  const [groupToLeave, setGroupToLeave] = useState<string | null>(null);
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
  const { selectedChat } = useSelector((state: RootState) => state.chat);

  const { data: chats, isLoading: chatsLoading } =
    useFetchChatsQuery(undefined);
  const [searchUsers, { data: searchResults, isFetching: searchLoading }] =
    useLazySearchUsersQuery();
  const [accessChat] = useAccessChatMutation();
  const [togglePinChat] = useTogglePinChatMutation();
  const [toggleMuteChat] = useToggleMuteChatMutation();
  const [moveToFolder] = useMoveToFolderMutation();
  const [summarizeChat, { isLoading: summarizationLoading }] =
    useSummarizeChatMutation();
  const [deleteChat] = useDeleteChatMutation();
  const [removeFromGroup] = useRemoveFromGroupMutation();

  const filteredChats = chats?.filter((chat: any) => {
    const chatFolder =
      chat.userFolders?.find((f: any) => f.user === userInfo._id)?.name ||
      "Inbox";
    return chatFolder === currentFolder;
  });

  const { data: searchMessagesResults, isFetching: messagesLoading } =
    useSearchMessagesQuery(
      { q: searchQuery },
      { skip: !searchQuery || searchType !== "messages" },
    );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    searchUsers(searchQuery);
  };

  const startChat = async (userId: string) => {
    try {
      const chat = await accessChat(userId).unwrap();
      dispatch(setSelectedChat(chat));
      setSearchQuery(""); // clear search to show chat list again
      setIsAnyChatSelected(true);
    } catch (err) {
      console.error("Error starting chat:", err);
    }
  };

  const handleToggleMute = async (chatId: string) => {
    try {
      const updatedChat = await toggleMuteChat({ chatId }).unwrap();

      // If this is the currently selected chat, update the global state too
      if (selectedChat?._id === chatId) {
        dispatch(setSelectedChat(updatedChat));
      }

      toast.success(
        updatedChat.mutedBy.includes(userInfo._id)
          ? "Chat muted"
          : "Chat unmuted",
      );
    } catch (err) {
      console.error("Error toggling mute:", err);
      toast.error("Failed to update mute status");
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    setChatToDelete(chatId);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteChat = async () => {
    if (!chatToDelete) return;

    try {
      await deleteChat(chatToDelete).unwrap();
      if (selectedChat?._id === chatToDelete) {
        dispatch(setSelectedChat(null));
      }
      toast.success("Chat deleted successfully");
      setIsDeleteDialogOpen(false);
      setChatToDelete(null);
    } catch (err: any) {
      console.error("Error deleting chat:", err);
      toast.error(err.data?.message || "Failed to delete chat");
    }
  };

  const handleLeaveGroup = async (chatId: string) => {
    setGroupToLeave(chatId);
    setIsLeaveGroupDialogOpen(true);
  };

  const confirmLeaveGroup = async () => {
    if (!groupToLeave) return;

    try {
      await removeFromGroup({
        chatId: groupToLeave,
        userId: userInfo._id,
      }).unwrap();

      if (selectedChat?._id === groupToLeave) {
        dispatch(setSelectedChat(null));
      }

      toast.success("You have left the group");
      setIsLeaveGroupDialogOpen(false);
      setGroupToLeave(null);
    } catch (err: any) {
      console.error("Failed to leave group:", err);
      toast.error(err.data?.message || "Failed to leave group");
    }
  };

  const selectChat = (chat: any) => {
    if (selectedChat?._id === chat._id) {
      dispatch(setSelectedChat(null));
      setIsAnyChatSelected(false);
    } else {
      dispatch(setSelectedChat(chat));
      setIsAnyChatSelected(true);
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
      toast.error("Failed to generate summary");
      setIsAIPanelOpen(false);
    }
  };

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

  const getChatName = (chat: any) => {
    if (!chat) return "Chat";
    if (chat.isGroupChat) return chat.chatName || "Group Chat";
    const otherUser = chat.participants?.find(
      (p: any) => p._id !== userInfo._id,
    );
    return otherUser ? otherUser.username : "Unknown User";
  };

  return (
    <div className="h-full flex flex-col w-full min-w-0 overflow-hidden bg-card/50">
      {/* Header & Search */}
      {!isCollapsed ? (
        <div className="p-4 border-b border-border bg-background/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center justify-between mb-4 pr-12">
            <h2 className="text-xl font-bold tracking-tight">Messages</h2>
            <div className="flex gap-1">
              {selectedChat && userSettings.aiSummarization && (
                <Button
                  onClick={handleSummarize}
                  variant="ghost"
                  size="icon"
                  disabled={summarizationLoading}
                  title="AI Summarize Chat"
                  className="text-primary hover:text-primary hover:bg-primary/10"
                >
                  <Sparkles
                    size={20}
                    className={summarizationLoading ? "animate-pulse" : ""}
                  />
                </Button>
              )}
              <Button
                onClick={() => setIsGroupModalOpen(true)}
                variant="ghost"
                size="icon"
                title="Create Group Chat"
              >
                <Plus size={20} strokeWidth={2.5} />
              </Button>
            </div>
          </div>

          <div className="relative">
            <Search
              className="absolute left-3 top-2.5 text-muted-foreground"
              size={18}
            />
            <form onSubmit={handleSearch}>
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users..."
                className="pl-10"
              />
            </form>
          </div>

          {/* Folder Switcher */}
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {folderNames.map((folder) => (
              <button
                key={folder}
                onClick={() => setCurrentFolder(folder)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  currentFolder === folder
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                {folder}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-4 border-b border-border bg-background/50 backdrop-blur-sm sticky top-0 z-10 flex flex-col items-center gap-4">
          {/* Top spacing to avoid overlap with toggle button in ChatPage */}
          <div className="h-10" />
          <Button
            onClick={() => setIsGroupModalOpen(true)}
            variant="ghost"
            size="icon"
            title="Create Group Chat"
          >
            <Plus size={20} strokeWidth={2.5} />
          </Button>
        </div>
      )}

      {/* List Area */}
      <ScrollArea className="flex-1 w-full overflow-hidden">
        <div className="w-full p-3 flex flex-col gap-2 overflow-x-hidden">
          {searchQuery ? (
            /* Search Results */
            <div className="space-y-1 px-3">
              <div className="flex items-center justify-between px-2 mb-3 mt-1">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Search Results
                </p>
                <Button
                  variant="link"
                  size="sm"
                  className="text-xs p-0 h-auto"
                  onClick={() => setSearchQuery("")}
                >
                  Clear
                </Button>
              </div>

              {/* Search Tabs */}
              <div className="flex gap-1 p-1 bg-muted/50 rounded-lg mb-4">
                <button
                  onClick={() => setSearchType("users")}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    searchType === "users"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  People
                </button>
                <button
                  onClick={() => setSearchType("messages")}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    searchType === "messages"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Messages
                </button>
              </div>

              {searchType === "users" ? (
                <>
                  {searchLoading ? (
                    <div className="flex justify-center p-8">
                      <Loader2
                        className="animate-spin text-primary/50"
                        size={28}
                      />
                    </div>
                  ) : searchResults?.length > 0 ? (
                    searchResults.map((user: any) => (
                      <div
                        key={user._id}
                        onClick={() => startChat(user._id)}
                        className="flex items-center gap-3 p-3 hover:bg-accent rounded-xl cursor-pointer transition-all border border-transparent hover:border-border"
                      >
                        <div className="relative">
                          <Avatar className="h-12 w-12">
                            <AvatarFallback className="bg-linear-to-tr from-primary to-primary/80 text-white font-bold text-lg">
                              {user.username.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div
                            className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-background rounded-full ${
                              onlineUsers.includes(user._id)
                                ? "bg-green-500"
                                : "bg-red-500"
                            }`}
                          ></div>
                        </div>
                        <div>
                          <p className="font-semibold">{user.username}</p>
                          <p className="text-xs text-muted-foreground">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
                      <Search size={32} className="mb-3 opacity-20" />
                      <p className="text-sm font-medium">No users found</p>
                      <p className="text-xs mt-1">
                        Try a different exact username
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {messagesLoading ? (
                    <div className="flex justify-center p-8">
                      <Loader2
                        className="animate-spin text-primary/50"
                        size={28}
                      />
                    </div>
                  ) : searchMessagesResults?.length > 0 ? (
                    searchMessagesResults.map((msg: any) => (
                      <div
                        key={msg._id}
                        onClick={() => {
                          dispatch(setSelectedChat(msg.chatId));
                          dispatch(setHighlightedMessage(msg._id));
                          setSearchQuery("");
                          setIsAnyChatSelected(true);
                        }}
                        className="flex flex-col gap-1.5 p-3 hover:bg-accent rounded-xl cursor-pointer transition-all border border-transparent hover:border-border mb-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-[10px] bg-primary text-white">
                                {msg.senderId?.username
                                  ?.charAt(0)
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs font-bold truncate max-w-[100px]">
                              {msg.senderId?.username}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(msg.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-foreground/80 line-clamp-2 italic">
                          "{msg.content}"
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1.5 py-0"
                          >
                            {msg.chatId?.isGroupChat
                              ? msg.chatId.chatName
                              : "Direct Message"}
                          </Badge>
                        </div>
                      </div>
                    ))
                  ) : searchMessagesResults?.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
                      <MessageSquare size={32} className="mb-3 opacity-20" />
                      <p className="text-sm font-medium">No messages found</p>
                      <p className="text-xs mt-1">
                        Try searching for different keywords
                      </p>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : (
            /* Chat List */
            <div className="space-y-1.5">
              {chatsLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="animate-spin text-primary/50" size={28} />
                </div>
              ) : filteredChats?.length > 0 ? (
                [...filteredChats]
                  .sort((a: any, b: any) => {
                    const aPinned = a.pinnedBy?.includes(userInfo._id);
                    const bPinned = b.pinnedBy?.includes(userInfo._id);
                    if (aPinned && !bPinned) return -1;
                    if (!aPinned && bPinned) return 1;
                    return (
                      new Date(b.updatedAt).getTime() -
                      new Date(a.updatedAt).getTime()
                    );
                  })
                  .map((chat: any) => {
                    const isSelected = selectedChat?._id === chat._id;
                    const isPinned = chat.pinnedBy?.includes(userInfo._id);
                    const chatFolder =
                      chat.userFolders?.find(
                        (f: any) => f.user === userInfo._id,
                      )?.name || "Inbox";

                    const chatName = getChatName(chat);
                    const unreadObj = chat.unreadCounts?.find(
                      (uc: any) => uc.user === userInfo._id,
                    );
                    const unreadCount = unreadObj ? unreadObj.count : 0;

                    return (
                      <div
                        key={chat._id}
                        onClick={() => {
                          selectChat(chat);
                          if (unreadCount > 0) {
                            dispatch(
                              chatApi.util.updateQueryData(
                                "fetchChats" as any,
                                undefined as any,
                                (draft: any) => {
                                  const chatIndex = draft.findIndex(
                                    (c: any) => c._id === chat._id,
                                  );
                                  if (chatIndex !== -1) {
                                    const ucIndex = draft[
                                      chatIndex
                                    ].unreadCounts.findIndex(
                                      (uc: any) => uc.user === userInfo._id,
                                    );
                                    if (ucIndex !== -1)
                                      draft[chatIndex].unreadCounts[
                                        ucIndex
                                      ].count = 0;
                                  }
                                },
                              ) as any,
                            );
                          }
                        }}
                        className={`relative flex items-center cursor-pointer transition-all border group w-full max-w-[353px] overflow-hidden ${
                          isCollapsed
                            ? "justify-center w-14 h-14 mx-auto rounded-full"
                            : "gap-4 p-3 rounded-xl"
                        } ${
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-md z-10"
                            : "bg-background/40 dark:bg-card/40 border-gray-100 dark:border-zinc-800/50 hover:bg-accent hover:border-border shadow-sm"
                        }`}
                        title={isCollapsed ? chatName : ""}
                      >
                        <div className="relative shrink-0">
                          <Avatar className="h-12 w-12 ring-2 ring-transparent transition-all">
                            <AvatarFallback
                              className={`font-bold text-lg transition-colors ${
                                isSelected
                                  ? "bg-white text-primary"
                                  : chat.isGroupChat
                                    ? "bg-linear-to-tr from-indigo-500 to-purple-500 text-white"
                                    : "bg-linear-to-tr from-slate-200 to-slate-300 dark:from-zinc-700 dark:to-zinc-800 text-slate-600 dark:text-zinc-400"
                              }`}
                            >
                              {chatName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>

                          {/* Status Indicator */}
                          {!chat.isGroupChat && (
                            <div
                              className={`absolute bottom-0 right-0 w-3.5 h-3.5 border-2 rounded-full ${
                                onlineUsers.includes(
                                  chat.participants.find(
                                    (p: any) => p._id !== userInfo._id,
                                  )?._id,
                                )
                                  ? isSelected
                                    ? "bg-green-400 border-primary"
                                    : "bg-green-500 border-background"
                                  : "bg-red-500 border-transparent"
                              }`}
                            ></div>
                          )}

                          {/* Unread Indicator for Collapsed View */}
                          {isCollapsed && unreadCount > 0 && !isSelected && (
                            <div className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground border-2 border-background animate-in zoom-in duration-300">
                              {unreadCount > 9 ? "9+" : unreadCount}
                            </div>
                          )}
                        </div>

                        {!isCollapsed && (
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-baseline mb-0.5">
                              <p
                                className={`font-semibold text-[15px] truncate ${
                                  isSelected
                                    ? "text-primary-foreground"
                                    : "text-foreground"
                                } ${unreadCount > 0 ? "font-bold" : ""}`}
                              >
                                {chatName}
                              </p>
                              <div className="flex items-center gap-2">
                                {isPinned && (
                                  <Pin
                                    size={12}
                                    className={
                                      isSelected
                                        ? "text-primary-foreground/70"
                                        : "text-primary"
                                    }
                                    fill="currentColor"
                                  />
                                )}
                                {chat.mutedBy?.includes(userInfo._id) && (
                                  <BellOff
                                    size={12}
                                    className={
                                      isSelected
                                        ? "text-primary-foreground/70"
                                        : "text-muted-foreground"
                                    }
                                  />
                                )}
                                {chat.latestMessage && (
                                  <span
                                    className={`text-[10px] whitespace-nowrap ${
                                      isSelected
                                        ? "text-primary-foreground/80"
                                        : "text-muted-foreground"
                                    }`}
                                  >
                                    {new Date(
                                      chat.latestMessage.createdAt,
                                    ).toLocaleDateString([], {
                                      month: "short",
                                      day: "numeric",
                                    })}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex justify-between items-center">
                              {chat.latestMessage ? (
                                <p
                                  className={`text-[13px] truncate pr-2 ${
                                    isSelected
                                      ? "text-primary-foreground/80"
                                      : unreadCount > 0
                                        ? "text-foreground font-medium"
                                        : "text-muted-foreground"
                                  }`}
                                >
                                  {(chat.latestMessage.senderId?._id ||
                                    chat.latestMessage.senderId) ===
                                  userInfo._id ? (
                                    <span className="font-medium opacity-80">
                                      You:{" "}
                                    </span>
                                  ) : chat.isGroupChat ? (
                                    <span className="font-medium opacity-80">
                                      {chat.latestMessage.senderId?.username ||
                                        "User"}
                                      :{" "}
                                    </span>
                                  ) : (
                                    ""
                                  )}
                                  {chat.latestMessage.content}
                                </p>
                              ) : (
                                <p
                                  className={`text-[13px] italic ${
                                    isSelected
                                      ? "text-primary-foreground/70"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  New conversation started
                                </p>
                              )}

                              {/* Unread Badge & Action Menu */}
                              <div className="flex items-center gap-1">
                                {unreadCount > 0 && !isSelected && (
                                  <Badge className="min-w-[20px] h-5 flex items-center justify-center text-[10px] mr-1">
                                    {unreadCount > 99 ? "99+" : unreadCount}
                                  </Badge>
                                )}

                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 rounded-full text-primary-foreground/10 hover:bg-primary-foreground dark:hover:bg-accent/50"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <MoreVertical size={14} />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                      align="end"
                                      className="w-48"
                                    >
                                      <DropdownMenuItem
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          togglePinChat({ chatId: chat._id });
                                        }}
                                        className="cursor-pointer"
                                      >
                                        {isPinned ? (
                                          <>
                                            <PinOff className="mr-2 h-4 w-4" />
                                            <span>Unpin Chat</span>
                                          </>
                                        ) : (
                                          <>
                                            <Pin className="mr-2 h-4 w-4" />
                                            <span>Pin Chat</span>
                                          </>
                                        )}
                                      </DropdownMenuItem>

                                      <DropdownMenuItem
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleToggleMute(chat._id);
                                        }}
                                        className="cursor-pointer"
                                      >
                                        {chat.mutedBy?.includes(
                                          userInfo._id,
                                        ) ? (
                                          <>
                                            <Bell className="mr-2 h-4 w-4" />
                                            <span>Unmute Notifications</span>
                                          </>
                                        ) : (
                                          <>
                                            <BellOff className="mr-2 h-4 w-4" />
                                            <span>Mute Notifications</span>
                                          </>
                                        )}
                                      </DropdownMenuItem>

                                      <DropdownMenuSeparator />

                                      <DropdownMenuSub>
                                        <DropdownMenuSubTrigger className="cursor-pointer">
                                          <Folder className="mr-2 h-4 w-4" />
                                          <span>Move to Folder</span>
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent
                                          sideOffset={10}
                                          alignOffset={-1}
                                          className="w-40 space-y-0.5"
                                        >
                                          {folderNames.map((f) => (
                                            <DropdownMenuItem
                                              key={f}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                moveToFolder({
                                                  chatId: chat._id,
                                                  folderName: f,
                                                });
                                              }}
                                              className={`text-xs cursor-pointer ${
                                                chatFolder === f
                                                  ? "bg-accent text-primary font-bold"
                                                  : ""
                                              }`}
                                            >
                                              <Folder className="mr-2 h-3 w-3" />
                                              {f}
                                            </DropdownMenuItem>
                                          ))}
                                        </DropdownMenuSubContent>
                                      </DropdownMenuSub>

                                      <DropdownMenuSeparator />

                                      {(!chat.isGroupChat ||
                                        (typeof chat.groupAdmin === "string"
                                          ? chat.groupAdmin === userInfo._id
                                          : chat.groupAdmin?._id ===
                                            userInfo._id)) && (
                                        <DropdownMenuItem
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteChat(chat._id);
                                          }}
                                          className="text-xs text-red-500 focus:text-red-500 dark:focus:text-red-400 cursor-pointer"
                                        >
                                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                                          Delete Chat
                                        </DropdownMenuItem>
                                      )}

                                      {chat.isGroupChat && (
                                        <DropdownMenuItem
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleLeaveGroup(chat._id);
                                          }}
                                          className="text-xs text-red-500 focus:text-red-500 dark:focus:text-red-400 cursor-pointer"
                                        >
                                          <CornerDownLeft className="mr-2 h-3.5 w-3.5" />
                                          Leave Group
                                        </DropdownMenuItem>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
              ) : (
                <div className="flex flex-col items-center justify-center text-muted-foreground h-64 text-center px-4 animate-in fade-in zoom-in duration-300">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                    <Folder size={32} className="text-muted-foreground/50" />
                  </div>
                  <h3 className="font-medium mb-1">
                    No chats in {currentFolder}
                  </h3>
                  <p className="text-sm">
                    Move chats here to keep your workspace organized.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      <GroupChatModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
      />

      {/* AI Insights Side Panel */}
      <Sheet open={isAIPanelOpen} onOpenChange={setIsAIPanelOpen}>
        <SheetContent className="w-[350px] sm:w-[450px] border-l border-border bg-background/95 backdrop-blur-xl">
          <SheetHeader className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <Sparkles className="text-primary h-5 w-5" />
              </div>
              <div>
                <SheetTitle className="text-xl">AI Chat Insights</SheetTitle>
                <SheetDescription>
                  Powered by Nexus Intelligence
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-180px)] mt-4 pr-4 -mr-4">
            <div className="space-y-6 pb-32">
              <div className="p-5 rounded-2xl bg-accent/30 border border-border/50 shadow-sm">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary/70 mb-4 flex items-center gap-2">
                  <MessageSquare size={12} className="text-primary" />
                  Executive Summary
                </h4>

                {summarizationLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-full rounded-full" />
                    <Skeleton className="h-4 w-[90%] rounded-full" />
                    <Skeleton className="h-4 w-[95%] rounded-full" />
                    <Skeleton className="h-4 w-[60%] rounded-full" />
                  </div>
                ) : (
                  <div className="text-sm leading-relaxed text-foreground/90 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-3">{children}</p>,
                        ul: ({ children }) => (
                          <ul className="list-disc pl-4 mb-3 space-y-1">
                            {children}
                          </ul>
                        ),
                        li: ({ children }) => (
                          <li className="text-foreground/80">{children}</li>
                        ),
                        strong: ({ children }) => (
                          <strong className="font-bold text-primary">
                            {children}
                          </strong>
                        ),
                      }}
                    >
                      {aiSummary}
                    </ReactMarkdown>
                  </div>
                )}
              </div>

              <div className="p-4 rounded-2xl border border-dashed border-border/60">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  Next Steps (Coming Soon)
                </h4>
                <p className="text-xs text-muted-foreground italic">
                  AI will soon automatically extract action items and deadlines
                  from this conversation.
                </p>
              </div>
            </div>
          </ScrollArea>

          <div className="absolute bottom-6 left-6 right-6 p-4 rounded-xl bg-primary/5 border border-primary/10">
            <p className="text-[10px] text-muted-foreground leading-tight">
              Nexus AI analyzes your recent conversation history to provide
              these insights. Summaries are based on the last 50 messages.
            </p>
          </div>
        </SheetContent>
      </Sheet>
      {/* Delete Chat Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-[600px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
          <div className="bg-linear-to-br from-red-50 to-white dark:from-red-950/20 dark:to-zinc-900 p-6">
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
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setChatToDelete(null);
              }}
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
          <div className="bg-linear-to-br from-orange-50 to-white dark:from-orange-950/20 dark:to-zinc-900 p-6">
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
              onClick={() => {
                setIsLeaveGroupDialogOpen(false);
                setGroupToLeave(null);
              }}
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
    </div>
  );
};

export default Sidebar;
