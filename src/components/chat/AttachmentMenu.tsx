import { useState, useRef } from "react";
import {
  Plus,
  Image as ImageIcon,
  FileText,
  MapPin,
  BarChart2,
  Wand2,
  X,
  Loader2,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { toast } from "sonner";
import {
  useSendMediaMessageMutation,
  useGenerateAiImageMutation,
  useGetUploadUrlMutation,
} from "../../store/messageApi";
import { useDispatch } from "react-redux";
import { messageApi } from "../../store/messageApi";
import { useSocket } from "../../context/SocketContext";
import { chatApi } from "../../store/chatApi";

export default function AttachmentMenu({
  chatId,
  replyToId,
}: {
  chatId: string;
  replyToId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<
    "poll" | "location" | "ai-image" | null
  >(null);

  const [sendMediaMessage, { isLoading: mediaLoading }] =
    useSendMediaMessageMutation();
  const [getUploadUrl] = useGetUploadUrlMutation();
  const [generateAiImage] = useGenerateAiImageMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<"image" | "file" | null>(null);

  // const { selectedChat } = useSelector((state: RootState) => state.chat);
  const { socket } = useSocket();
  const dispatch = useDispatch();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadType) return;

    if (file.size > 20 * 1024 * 1024) {
      toast.error("File size must be less than 20MB");
      return;
    }

    try {
      // 1. Get Presigned URL from our server
      const { uploadUrl, fileUrl } = await getUploadUrl({
        fileType: file.type || "application/octet-stream",
        fileName: file.name,
      }).unwrap();

      // 2. Upload directly to R2 from the browser
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
      });

      if (!uploadRes.ok) throw new Error("Cloud upload failed");

      // 3. Send message metadata to our server
      const payload: any = {
        chatId,
        type: uploadType,
        mediaUrl: fileUrl,
        replyToId,
      };

      if (uploadType === "file") {
        payload.fileData = {
          name: file.name,
          size: file.size,
          mimeType: file.type || "application/octet-stream",
        };
      }

      const messageData = await sendMediaMessage(payload).unwrap();

      updateCachesAndEmit(messageData);
      setOpen(false);
    } catch (err) {
      console.error("Direct upload error:", err);
      toast.error("Failed to upload and send media");
    } finally {
      e.target.value = ""; // Reset input
    }
  };

  const updateCachesAndEmit = (messageData: any) => {
    dispatch(
      messageApi.util.updateQueryData("fetchMessages", { chatId }, (draft) => {
        draft.messages.push(messageData);
      }) as any,
    );

    // Update chat list
    dispatch(
      chatApi.util.updateQueryData(
        "fetchChats" as any,
        undefined as any,
        (draft: any) => {
          const chat = draft.find((c: any) => c._id === chatId);
          if (chat) {
            chat.latestMessage = messageData;
            // Move to top
            const index = draft.indexOf(chat);
            if (index > 0) {
              draft.splice(index, 1);
              draft.unshift(chat);
            }
          }
        },
      ) as any,
    );

    if (socket && messageData) {
      socket.emit("send_message", messageData);
    }
  };

  const triggerUpload = (type: "image" | "file") => {
    setUploadType(type);
    if (fileInputRef.current) {
      fileInputRef.current.accept =
        type === "image" ? "image/*,video/*" : "*/*";
      fileInputRef.current.click();
    }
  };

  // Poll State
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollMultiple, setPollMultiple] = useState(false);

  const handleCreatePoll = async () => {
    const validOptions = pollOptions.filter((o) => o.trim() !== "");
    if (!pollQuestion.trim() || validOptions.length < 2) {
      toast.error("Question and at least 2 options are required");
      return;
    }

    try {
      const payload = {
        chatId,
        type: "poll",
        replyToId,
        pollData: {
          question: pollQuestion,
          options: validOptions.map((text) => ({ text, votes: [] })),
          multipleChoice: pollMultiple,
        },
      };

      const messageData = await sendMediaMessage(payload).unwrap();
      updateCachesAndEmit(messageData);
      setActiveModal(null);
      setOpen(false);
      setPollQuestion("");
      setPollOptions(["", ""]);
    } catch (error) {
      toast.error("Failed to create poll");
    }
  };

  // Location State
  const [addressStr, setAddressStr] = useState("");

  const handleSendLocation = async () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const payload = {
            chatId,
            type: "location",
            replyToId,
            locationData: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              address: addressStr || "Current Location",
            },
          };

          const messageData = await sendMediaMessage(payload).unwrap();
          updateCachesAndEmit(messageData);
          setActiveModal(null);
          setOpen(false);
          setAddressStr("");
        } catch (error) {
          toast.error("Failed to send location");
        }
      },
      () => {
        toast.error("Unable to retrieve your location");
      },
    );
  };

  // AI Image State
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateAiImage = async () => {
    if (!aiPrompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    setIsGenerating(true);
    try {
      const payload = {
        chatId,
        prompt: aiPrompt,
        replyToId,
      };

      const messageData = await generateAiImage(payload).unwrap();
      updateCachesAndEmit(messageData);
      setActiveModal(null);
      setOpen(false);
      setAiPrompt("");
    } catch (error) {
      toast.error("Failed to generate image");
    } finally {
      setIsGenerating(false);
    }
  };

  const menuItems = [
    {
      icon: <ImageIcon size={20} className="text-blue-500" />,
      label: "Photos & Videos",
      onClick: () => triggerUpload("image"),
      bg: "bg-blue-50 dark:bg-blue-500/10",
      disabled: false,
    },
    {
      icon: <FileText size={20} className="text-purple-500" />,
      label: "Document",
      onClick: () => triggerUpload("file"),
      bg: "bg-purple-50 dark:bg-purple-500/10",
      disabled: false,
    },
    {
      icon: <BarChart2 size={20} className="text-green-500" />,
      label: "Poll",
      onClick: () => {
        setActiveModal("poll");
        setOpen(false);
      },
      bg: "bg-green-50 dark:bg-green-500/10",
      disabled: false,
    },
    {
      icon: <MapPin size={20} className="text-orange-500" />,
      label: "Location",
      onClick: () => {
        setActiveModal("location");
        setOpen(false);
      },
      bg: "bg-orange-50 dark:bg-orange-500/10",
      disabled: false,
    },
    {
      icon: <Wand2 size={20} className="text-pink-500" />,
      label: "AI Image",
      onClick: () => {
        setActiveModal("ai-image");
        setOpen(false);
      },
      bg: "bg-pink-50 dark:bg-pink-500/10",
      disabled: false,
    },
  ];

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="p-2 text-gray-500 hover:text-primary transition-colors rounded-full hover:bg-gray-200 dark:hover:bg-zinc-700"
          >
            <Plus size={24} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-56 p-2 rounded-2xl shadow-xl border-gray-200 dark:border-zinc-800"
          align="end"
          side="top"
          sideOffset={15}
        >
          <div className="flex flex-col gap-1">
            {menuItems.map((item, index) => (
              <button
                disabled={item.disabled}
                key={index}
                onClick={item.onClick}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors ${item.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <div className={`p-2 rounded-full ${item.bg}`}>{item.icon}</div>
                <span className="font-medium text-sm text-gray-700 dark:text-gray-200">
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Poll Modal */}
      <Dialog
        open={activeModal === "poll"}
        onOpenChange={(open) => !open && setActiveModal(null)}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Poll</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Question</label>
              <Input
                placeholder="Ask a question"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Options</label>
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder={`Option ${i + 1}`}
                    value={opt}
                    onChange={(e) => {
                      const newOpts = [...pollOptions];
                      newOpts[i] = e.target.value;
                      setPollOptions(newOpts);
                    }}
                  />
                  {pollOptions.length > 2 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setPollOptions(
                          pollOptions.filter((_, idx) => idx !== i),
                        )
                      }
                    >
                      <X size={16} className="text-red-500" />
                    </Button>
                  )}
                </div>
              ))}
              {pollOptions.length < 10 && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full mt-2"
                  onClick={() => setPollOptions([...pollOptions, ""])}
                >
                  <Plus size={16} className="mr-2" /> Add Option
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="multiple"
                checked={pollMultiple}
                onChange={(e) => setPollMultiple(e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="multiple" className="text-sm">
                Allow multiple answers
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setActiveModal(null)}>
              Cancel
            </Button>
            <Button onClick={handleCreatePoll} disabled={mediaLoading}>
              Create Poll
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Location Modal */}
      <Dialog
        open={activeModal === "location"}
        onOpenChange={(open) => !open && setActiveModal(null)}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Send Location</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-500 mb-4">
              We'll use your browser's geolocation to send your current
              coordinates.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Label (Optional)</label>
              <Input
                placeholder="e.g. Office, Home, Meeting Point"
                value={addressStr}
                onChange={(e) => setAddressStr(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setActiveModal(null)}>
              Cancel
            </Button>
            <Button onClick={handleSendLocation} disabled={mediaLoading}>
              Send Current Location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Image Modal */}
      <Dialog
        open={activeModal === "ai-image"}
        onOpenChange={(open) => !open && !isGenerating && setActiveModal(null)}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 size={20} className="text-pink-500" />
              Generate AI Image
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-gray-500">
              Describe what you want to see. The AI will generate a unique image
              based on your prompt.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Prompt</label>
              <Input
                placeholder="e.g. A futuristic city at sunset, cyberpunk style"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                disabled={isGenerating}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && aiPrompt.trim()) {
                    handleGenerateAiImage();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setActiveModal(null)}
              disabled={isGenerating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerateAiImage}
              disabled={isGenerating || !aiPrompt.trim()}
              className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white border-none"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />{" "}
                  Generating...
                </>
              ) : (
                "Generate & Send"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
