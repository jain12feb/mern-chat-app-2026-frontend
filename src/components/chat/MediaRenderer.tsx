import { FileText, MapPin, Download, Check, Map } from "lucide-react";
import { useVotePollMutation, messageApi } from "../../store/messageApi";
import { useSelector, useDispatch } from "react-redux";
import { type RootState } from "../../store";
import { useSocket } from "../../context/SocketContext";

export default function MediaRenderer({
  message,
  isMine,
}: {
  message: any;
  isMine: boolean;
}) {
  const [votePoll] = useVotePollMutation();
  const { userInfo } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const { socket } = useSocket();

  if (message.isDeleted) {
    return (
      <p className="text-[15px] italic opacity-70 flex items-center gap-2">
        This message was deleted
      </p>
    );
  }

  const handleVote = async (idx: number) => {
    try {
      const updatedMsg = await votePoll({
        messageId: message._id,
        optionIndex: idx,
      }).unwrap();
      const chatIdString = String(message.chatId?._id || message.chatId);

      // Update local cache
      dispatch(
        messageApi.util.updateQueryData("fetchMessages", { chatId: chatIdString }, (draft) => {
          const index = draft.messages.findIndex((m: any) => m._id === message._id);
          if (index !== -1) draft.messages[index] = updatedMsg;
        }) as any
      );

      // Emit over socket
      if (socket && updatedMsg) {
        socket.emit("update_message", updatedMsg);
      }
    } catch (error) {
      console.error("Failed to vote:", error);
    }
  };

  if (message.type === "image" || message.type === "ai-image") {
    return (
      <div className="flex flex-col gap-2">
        <img
          src={message.mediaUrl}
          alt="Attachment"
          className="max-w-[260px] sm:max-w-[320px] rounded-xl object-cover cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => window.open(message.mediaUrl, "_blank")}
        />
        {message.content && <p className="text-[15px]">{message.content}</p>}
      </div>
    );
  }

  if (message.type === "file") {
    return (
      <div className="flex flex-col gap-2">
        <a
          href={message.mediaUrl}
          download={message.fileData?.name || "document"}
          target="_blank"
          rel="noreferrer"
          className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
            isMine
              ? "bg-primary-foreground/10 border-primary-foreground/20 hover:bg-primary-foreground/20"
              : "bg-gray-50 dark:bg-zinc-800/50 border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800"
          }`}
        >
          <div className="p-2 bg-purple-500/20 text-purple-500 rounded-lg">
            <FileText size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">
              {message.fileData?.name || "Document"}
            </p>
            <p className="text-xs opacity-70">
              {message.fileData?.size
                ? (message.fileData.size / 1024 / 1024).toFixed(2) + " MB"
                : "Unknown size"}
            </p>
          </div>
          <Download size={18} className="opacity-70" />
        </a>
        {message.content && <p className="text-[15px]">{message.content}</p>}
      </div>
    );
  }

  if (message.type === "location") {
    const lat = message.locationData?.latitude;
    const lng = message.locationData?.longitude;
    const address = message.locationData?.address || "Location";

    return (
      <div className="flex flex-col gap-2">
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
          target="_blank"
          rel="noreferrer"
          className={`flex flex-col overflow-hidden rounded-xl border transition-colors ${
            isMine
              ? "border-primary-foreground/20"
              : "border-gray-200 dark:border-zinc-700"
          }`}
        >
          <div className="h-24 bg-gray-200 dark:bg-zinc-800 relative flex items-center justify-center">
            {/* Simple fallback map view */}
            <Map size={32} className="text-gray-400 opacity-50 absolute" />
            <MapPin
              size={24}
              className="text-red-500 z-10"
              fill="currentColor"
            />
          </div>
          <div
            className={`p-3 ${isMine ? "bg-primary-foreground/10" : "bg-gray-50 dark:bg-zinc-800/50"}`}
          >
            <p className="text-sm font-semibold truncate flex items-center gap-2">
              <MapPin size={14} />
              {address}
            </p>
          </div>
        </a>
      </div>
    );
  }

  if (message.type === "audio") {
    return (
      <div className="flex flex-col gap-2 min-w-[200px]">
        <audio
          controls
          src={message.mediaUrl}
          className="max-w-[250px] h-[40px]"
        />
      </div>
    );
  }

  if (message.type === "poll") {
    const totalVotes =
      message.pollData?.options?.reduce(
        (acc: number, opt: any) => acc + (opt.votes?.length || 0),
        0,
      ) || 0;

    return (
      <div
        className={`flex flex-col gap-3 min-w-[240px] p-2 rounded-xl ${
          isMine ? "bg-white/5" : "bg-white dark:bg-zinc-900"
        }`}
      >
        <p className="font-bold text-[15px] leading-snug">
          📊 {message.pollData?.question}
        </p>
        <div className="flex flex-col gap-2">
          {message.pollData?.options?.map((opt: any, idx: number) => {
            const voteCount = opt.votes?.length || 0;
            const percentage =
              totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
            const hasMyVote = opt.votes?.some(
              (v: any) => v.toString() === userInfo._id.toString(),
            );

            return (
              <button
                key={idx}
                onClick={() => handleVote(idx)}
                className={`relative overflow-hidden text-left p-2.5 rounded-lg border transition-all ${
                  hasMyVote
                    ? isMine
                      ? "border-white bg-white/20"
                      : "border-primary bg-primary/10 text-primary"
                    : isMine
                      ? "border-white/20 hover:bg-white/10"
                      : "border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800"
                }`}
              >
                {/* Progress Bar Background */}
                <div
                  className={`absolute left-0 top-0 bottom-0 opacity-20 transition-all duration-500 ${
                    isMine ? "bg-white" : "bg-primary"
                  }`}
                  style={{ width: `${percentage}%` }}
                />

                <div className="relative z-10 flex justify-between items-center text-sm font-medium">
                  <span className="flex items-center gap-2">
                    {hasMyVote && <Check size={14} />}
                    {opt.text}
                  </span>
                  {voteCount > 0 && (
                    <span className="opacity-70 text-xs">{percentage}%</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-xs opacity-70 mt-1">
          {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
          {message.pollData?.multipleChoice && " • Multiple choices allowed"}
        </p>
      </div>
    );
  }

  // Fallback for text messages
  return (
    <p className="text-[15px] leading-relaxed wrap-break-word whitespace-pre-wrap">
      {message.content}
    </p>
  );
}
