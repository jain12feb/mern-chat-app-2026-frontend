import React, { useState } from "react";
import {
  X,
  Loader2,
  Search,
  UserPlus,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { useDispatch } from "react-redux";
import {
  useLazySearchUsersQuery,
  useCreateGroupChatMutation,
} from "../../store/chatApi";
import { setSelectedChat } from "../../store/chatSlice";
import { useSocket } from "../../context/SocketContext";
import { messageApi } from "../../store/messageApi";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";

interface GroupChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GroupChatModal = ({ isOpen, onClose }: GroupChatModalProps) => {
  const [step, setStep] = useState(1);
  const [groupChatName, setGroupChatName] = useState("");
  const [search, setSearch] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);

  const dispatch = useDispatch();
  const { socket } = useSocket();

  const [searchUsers, { data: searchResults, isFetching: searchLoading }] =
    useLazySearchUsersQuery();
  const [createGroupChat, { isLoading: createLoading }] =
    useCreateGroupChatMutation();

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    if (!e.target.value) {
      return;
    }
    searchUsers(e.target.value);
  };

  const handleGroup = (userToAdd: any) => {
    if (selectedUsers.some((u) => u._id === userToAdd._id)) {
      return;
    }
    setSelectedUsers([...selectedUsers, userToAdd]);
  };

  const handleDelete = (delUser: any) => {
    setSelectedUsers(selectedUsers.filter((sel) => sel._id !== delUser._id));
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setStep(1);
      setGroupChatName("");
      setSearch("");
      setSelectedUsers([]);
    }, 300);
  };

  const handleSubmit = async () => {
    if (!groupChatName || selectedUsers.length < 2) {
      return;
    }

    try {
      const { chat, message } = await createGroupChat({
        name: groupChatName,
        users: JSON.stringify(selectedUsers.map((u) => u._id)),
      }).unwrap();

      dispatch(setSelectedChat(chat));
      dispatch(
        messageApi.util.updateQueryData("fetchMessages", { chatId: chat._id }, (draft) => {
          draft.messages.push(message);
        }) as any,
      );

      selectedUsers.forEach((user: any) => {
        socket?.emit("user_added_to_group", { chat, userId: user._id });
      });

      socket?.emit("send_message", message);

      toast.success(`Group "${groupChatName}" created successfully!`);
      handleClose();
    } catch (error) {
      console.error("Failed to create the chat!", error);
      toast.error("Failed to create group chat. Please try again.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md overflow-hidden p-0 gap-0 border-none shadow-2xl">
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 w-full h-1 bg-muted/30 z-50">
          <div
            className="h-full bg-primary transition-all duration-500 ease-in-out shadow-[0_0_8px_rgba(var(--primary),0.5)]"
            style={{ width: `${(step / 2) * 100}%` }}
          />
        </div>

        <div className="p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <UserPlus size={20} />
              </div>
              {step === 1 ? "Create Group" : "Add Members"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {step === 1
                ? "Give your new group a distinct name to get started."
                : `Select at least 2 members for "${groupChatName}".`}
            </DialogDescription>
          </DialogHeader>

          <div className="relative overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-in-out"
              style={{
                transform: `translateX(-${(step - 1) * 100}%)`,
                width: "100%",
              }}
            >
              {/* Step 1: Group Identity */}
              <div className="w-full shrink-0 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Group Name
                  </label>
                  <Input
                    placeholder="Enter group name..."
                    value={groupChatName}
                    onChange={(e) => setGroupChatName(e.target.value)}
                    className="h-11 bg-muted/20 border-muted-foreground/20"
                    autoFocus
                  />
                  <p className="text-[0.8rem] text-muted-foreground">
                    This will be visible to all members of the group.
                  </p>
                </div>
              </div>

              {/* Step 2: Member Selection */}
              <div className="w-full shrink-0 space-y-4">
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    size={18}
                  />
                  <Input
                    placeholder="Search users by name or email..."
                    value={search}
                    onChange={handleSearch}
                    className="pl-10 h-11 bg-muted/20 border-muted-foreground/20 focus-visible:ring-primary/30"
                  />
                </div>

                {selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto py-1 custom-scrollbar">
                    {selectedUsers.map((u) => (
                      <Badge
                        key={u._id}
                        variant="secondary"
                        className="gap-1 pr-1 py-1 px-2 bg-primary/5 border-primary/10 text-primary-foreground hover:bg-primary/10 transition-colors"
                      >
                        {u.username}
                        <button
                          onClick={() => handleDelete(u)}
                          className="ml-1 rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive transition-colors focus:outline-none"
                        >
                          <X size={12} />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="max-h-48 min-h-[180px] overflow-y-auto custom-scrollbar space-y-2">
                  {searchLoading ? (
                    <div className="flex flex-col items-center justify-center p-8 space-y-2">
                      <Loader2
                        className="animate-spin text-primary"
                        size={24}
                      />
                      <p className="text-sm text-muted-foreground">
                        Searching users...
                      </p>
                    </div>
                  ) : searchResults?.length > 0 ? (
                    searchResults.slice(0, 5).map((user: any) => (
                      <div
                        key={user._id}
                        onClick={() => handleGroup(user)}
                        className="flex items-center gap-3 p-3 hover:bg-accent rounded-xl cursor-pointer transition-all active:scale-[0.98]"
                      >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-white font-bold shadow-md">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="text-sm font-semibold truncate">
                            {user.username}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {user.email}
                          </p>
                        </div>
                        {selectedUsers.some((u) => u._id === user._id) ? (
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                            <X size={12} className="text-white rotate-45" />
                          </div>
                        ) : (
                          <ChevronRight
                            size={16}
                            className="text-muted-foreground"
                          />
                        )}
                      </div>
                    ))
                  ) : search ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center">
                      <Search
                        size={32}
                        className="text-muted-foreground/30 mb-2"
                      />
                      <p className="text-sm text-muted-foreground">
                        No users found for "{search}"
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                      <UserPlus size={32} className="opacity-20 mb-2" />
                      <p className="text-sm">
                        Search and select at least 2 people
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="bg-muted/30 p-4 flex sm:justify-between items-center gap-3 border-t border-muted">
          {step === 1 ? (
            <>
              <Button
                variant="ghost"
                onClick={handleClose}
                className="hover:bg-background"
              >
                Cancel
              </Button>
              <Button
                onClick={() => setStep(2)}
                disabled={!groupChatName.trim()}
                className="gap-2 px-6 shadow-lg shadow-primary/20"
              >
                Next
                <ChevronRight size={16} />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={() => setStep(1)}
                className="gap-2 hover:bg-background"
                disabled={createLoading}
              >
                <ChevronLeft size={16} />
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createLoading || selectedUsers.length < 2}
                className="gap-2 px-6 shadow-lg shadow-primary/20"
              >
                {createLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <UserPlus size={16} />
                )}
                Create Group
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GroupChatModal;
