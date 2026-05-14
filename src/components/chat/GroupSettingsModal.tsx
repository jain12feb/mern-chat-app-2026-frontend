import React, { useState, useEffect } from "react";
import {
  X,
  Loader2,
  Search,
  Edit2,
  LogOut,
  ShieldAlert,
  Users,
  Plus,
  Check,
} from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { type RootState } from "../../store";
import {
  useLazySearchUsersQuery,
  useRenameGroupMutation,
  useAddToGroupMutation,
  useRemoveFromGroupMutation,
} from "../../store/chatApi";
import { setSelectedChat } from "../../store/chatSlice";
import { useSocket } from "../../context/SocketContext";
import { messageApi } from "../../store/messageApi";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { Avatar, AvatarFallback } from "../ui/avatar";

interface GroupSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GroupSettingsModal = ({ isOpen, onClose }: GroupSettingsModalProps) => {
  const dispatch = useDispatch();
  const { selectedChat } = useSelector((state: RootState) => state.chat);
  const { userInfo } = useSelector((state: RootState) => state.auth);
  const { socket } = useSocket();

  const [groupChatName, setGroupChatName] = useState("");
  const [search, setSearch] = useState("");

  const [searchUsers, { data: searchResults, isFetching: searchLoading }] =
    useLazySearchUsersQuery();
  const [renameGroup, { isLoading: renameLoading }] = useRenameGroupMutation();
  const [addToGroup, { isLoading: addLoading }] = useAddToGroupMutation();
  const [removeFromGroup, { isLoading: removeLoading }] =
    useRemoveFromGroupMutation();

  useEffect(() => {
    if (selectedChat?.chatName) {
      setGroupChatName(selectedChat.chatName);
    }
  }, [selectedChat]);

  const isAdmin = selectedChat?.groupAdmin?._id === userInfo._id;

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    if (!e.target.value) {
      return;
    }
    searchUsers(e.target.value);
  };

  const handleRename = async () => {
    if (!groupChatName) return;
    try {
      const { chat, message } = await renameGroup({
        chatId: selectedChat._id,
        chatName: groupChatName,
      }).unwrap();
      dispatch(setSelectedChat(chat));
      dispatch(
        messageApi.util.updateQueryData(
          "fetchMessages",
          selectedChat._id,
          (draft) => {
            draft.push(message);
          },
        ) as any,
      );
      socket?.emit("group_update", chat);
      socket?.emit("send_message", message);
    } catch (error) {
      console.error("Failed to rename group", error);
    }
  };

  const handleAddUser = async (user1: any) => {
    if (selectedChat.participants.find((u: any) => u._id === user1._id)) {
      return;
    }
    if (!isAdmin) {
      return;
    }
    try {
      const { chat, message } = await addToGroup({
        chatId: selectedChat._id,
        userId: user1._id,
      }).unwrap();
      dispatch(setSelectedChat(chat));
      dispatch(
        messageApi.util.updateQueryData(
          "fetchMessages",
          selectedChat._id,
          (draft) => {
            draft.push(message);
          },
        ) as any,
      );
      socket?.emit("user_added_to_group", { chat: chat, userId: user1._id });
      socket?.emit("group_update", chat);
      socket?.emit("send_message", message);
    } catch (error) {
      console.error("Failed to add user", error);
    }
  };

  const handleRemove = async (user1: any) => {
    if (user1._id !== userInfo._id && !isAdmin) {
      return;
    }
    try {
      const { chat, message } = await removeFromGroup({
        chatId: selectedChat._id,
        userId: user1._id,
      }).unwrap();

      if (user1._id === userInfo._id) {
        dispatch(setSelectedChat(null));
        onClose();
        socket?.emit("group_update", {
          ...selectedChat,
          participants: selectedChat.participants.filter(
            (p: any) => p._id !== userInfo._id,
          ),
        });
        socket?.emit("send_message", message);
      } else {
        dispatch(setSelectedChat(chat));
        dispatch(
          messageApi.util.updateQueryData(
            "fetchMessages",
            selectedChat._id,
            (draft) => {
              draft.push(message);
            },
          ) as any,
        );
        socket?.emit("user_removed_from_group", {
          chatId: selectedChat._id,
          userId: user1._id,
        });
        socket?.emit("group_update", chat);
        socket?.emit("send_message", message);
      }
    } catch (error) {
      console.error("Failed to remove user", error);
    }
  };

  if (!selectedChat) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl p-0 overflow-hidden border border-gray-200 dark:border-zinc-800 shadow-2xl bg-white dark:bg-zinc-950 flex flex-col h-[90vh] sm:h-[600px]">
        {/* Header - Identical to Forward Modal */}
        <DialogHeader className="border-b border-gray-200 dark:border-zinc-800 pr-14 p-5">
          <DialogTitle>Group settings</DialogTitle>
          <DialogDescription>Manage your group identity and members</DialogDescription>
        </DialogHeader>

        {/* Main Horizontal Content */}
        <div className="flex flex-1 overflow-hidden flex-col sm:flex-row bg-white dark:bg-zinc-950">
          {/* Left Side: Identity & Actions (Like the Preview/Input area in Forward) */}
          <div className="w-full sm:flex-1 p-5 pt-4 flex flex-col gap-4 border-b sm:border-b-0 sm:border-r border-gray-200 dark:border-zinc-800">
            {/* Group Identity Card - Matches the 'Message Preview' box style */}
            <div className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/60 px-4 py-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                Group Identity
              </p>
              <div className="space-y-3">
                <Input
                  placeholder="Group Name"
                  value={groupChatName}
                  onChange={(e) => setGroupChatName(e.target.value)}
                  disabled={!isAdmin}
                  className="w-full h-11 px-4 py-6 rounded-2xl bg-gray-100 dark:bg-zinc-800 border border-transparent focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm font-medium"
                />
                {isAdmin && (
                  <Button
                    onClick={handleRename}
                    disabled={renameLoading}
                    className="w-full bg-primary hover:bg-primary/90 text-white h-11 rounded-2xl shadow-sm font-bold transition-all text-xs"
                  >
                    {renameLoading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Edit2 size={16} className="mr-2" />
                    )}
                    Update Name
                  </Button>
                )}
              </div>
            </div>

            {/* Add New Members - Matches 'Search chats' input style */}
            {isAdmin && (
              <div className="flex flex-col flex-1 min-h-0">
                <Input
                  value={search}
                  onChange={handleSearch}
                  placeholder="Search users to add..."
                  className="w-full px-4 py-6 rounded-2xl bg-gray-100 dark:bg-zinc-800 border border-transparent focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
                />

                {/* Search Results - Matches forward list style */}
                <div className="mt-3 flex-1 overflow-y-auto px-1 space-y-1">
                  {searchLoading ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="animate-spin text-primary/40" size={24} />
                    </div>
                  ) : searchResults?.filter((user: any) => !selectedChat.participants.some((p: any) => p._id === user._id)).length > 0 ? (
                    searchResults
                      .filter((user: any) => !selectedChat.participants.some((p: any) => p._id === user._id))
                      .slice(0, 8)
                      .map((user: any) => (
                      <button
                        key={user._id}
                        onClick={() => handleAddUser(user)}
                        className="w-full flex items-center justify-between gap-3 px-3 py-3 rounded-2xl text-left transition-colors hover:bg-gray-100 dark:hover:bg-zinc-800 border border-transparent"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="w-10 h-10 ring-1 ring-border">
                            <AvatarFallback className="bg-primary/10 text-primary font-bold">
                              {user.username.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 dark:text-gray-100 truncate text-sm">
                              {user.username}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {user.email}
                            </p>
                          </div>
                        </div>
                        <div className="w-5 h-5 rounded-full border border-gray-300 dark:border-zinc-600 flex items-center justify-center group-hover:border-primary transition-colors">
                          <Plus size={12} className="text-gray-400 group-hover:text-primary" />
                        </div>
                      </button>
                    ))
                  ) : search && (
                    <p className="py-8 text-center text-xs text-gray-500 dark:text-gray-400">
                      No users found
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Side: Member List (Matches the list in Forward Modal) */}
          <div className="w-full sm:flex-[1.2] flex flex-col overflow-hidden">
             <div className="px-5 py-3 border-b border-gray-100 dark:border-zinc-900/50 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  {selectedChat.participants.length} Active members
                </span>
             </div>
            
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
                {selectedChat.participants.map((u: any) => u && (
                  <div
                    key={u._id}
                    className="w-full flex items-center justify-between gap-3 px-3 py-3 rounded-2xl text-left border border-transparent group hover:bg-gray-100 dark:hover:bg-zinc-800/50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative">
                        <Avatar className="w-10 h-10 ring-1 ring-border">
                          <AvatarFallback className="bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 font-bold">
                            {u.username?.charAt(0).toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        {u._id === selectedChat.groupAdmin?._id && (
                           <div className="absolute -top-1 -right-1 bg-primary p-1 rounded-full shadow-md border-2 border-white dark:border-zinc-950">
                              <ShieldAlert size={10} className="text-white" />
                           </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 dark:text-gray-100 truncate text-sm">
                            {u.username}
                          </p>
                          {u._id === userInfo._id && (
                            <Badge className="bg-primary/10 text-primary border-none text-[9px] font-black h-4 px-1.5 uppercase tracking-tighter">
                              YOU
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {u.email}
                        </p>
                      </div>
                    </div>

                    {isAdmin && u._id !== userInfo._id && (
                      <button
                        onClick={() => handleRemove(u)}
                        disabled={removeLoading}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Footer - Identical to Forward Modal */}
        <DialogFooter className="border-t border-gray-200 dark:border-zinc-800 p-4 flex items-center justify-between bg-white dark:bg-zinc-950">
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleRemove(userInfo)}
            disabled={removeLoading}
            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 font-bold text-xs h-10 rounded-xl px-4 mr-auto"
          >
            <LogOut size={16} className="mr-2" />
            Leave group
          </Button>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 transition-colors shadow-md"
            >
              Done
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GroupSettingsModal;
