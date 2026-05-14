import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { type RootState } from "../../store";
import { useWebRTC } from "../../context/WebRTCContext";
import { Button } from "../ui/button";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Maximize2,
  Minimize2,
  Loader2,
  MonitorUp,
  MonitorOff,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function CallManager() {
  const callState = useSelector((state: RootState) => state.call);
  const {
    localStream,
    remoteStreams,
    answerCall,
    rejectCall,
    leaveCall,
    toggleMute,
    toggleVideo,
    isScreenSharing,
    toggleScreenShare,
  } = useWebRTC();

  const [isMinimized, setIsMinimized] = useState(false);

  // --- Render Incoming Call Modal ---
  if (callState.isReceivingCall) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="bg-card p-6 rounded-2xl shadow-2xl border border-border flex flex-col items-center gap-4 w-80 animate-in zoom-in-95 duration-200">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2 relative">
            <div className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-75"></div>
            <Phone className="h-8 w-8 animate-pulse" />
          </div>
          <div className="text-center">
            <h3 className="text-xl font-bold">
              {callState.caller?.name || "Someone"}
            </h3>
            <p className="text-muted-foreground mt-1 text-sm">
              Incoming {callState.callType === "video" ? "Video" : "Audio"}{" "}
              Call...
            </p>
          </div>
          <div className="flex w-full gap-3 mt-4">
            <Button
              variant="destructive"
              className="flex-1 rounded-full h-12"
              onClick={rejectCall}
            >
              Decline
            </Button>
            <Button
              variant="default"
              className="flex-1 rounded-full h-12 bg-green-600 hover:bg-green-700 text-white"
              onClick={answerCall}
            >
              Accept
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // --- Render Active Call Widget ---
  if (
    callState.callStatus === "connecting" ||
    callState.callStatus === "connected"
  ) {
    return (
      <motion.div
        drag
        dragMomentum={false}
        className={`fixed z-50 overflow-hidden bg-card border border-border shadow-2xl rounded-2xl flex flex-col ${isMinimized ? "w-64 h-auto bottom-6 right-6" : "w-80 md:w-96 bottom-6 right-6"}`}
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
      >
        {/* Header */}
        <div className="bg-muted/50 p-3 flex justify-between items-center cursor-move border-b border-border/50">
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${callState.callStatus === "connected" ? "bg-green-500" : "bg-yellow-500 animate-pulse"}`}
            ></div>
            <span className="text-sm font-medium">
              {callState.callStatus === "connecting"
                ? "Connecting..."
                : "Active Call"}
            </span>
          </div>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="text-muted-foreground hover:text-foreground"
          >
            {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
          </button>
        </div>

        {/* Video Area */}
        <AnimatePresence>
          {!isMinimized && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              className="relative bg-black flex-1 min-h-[200px] flex flex-col"
            >
              {/* Remote Streams (Grid if multiple, full if 1-on-1) */}
              <div className="flex-1 relative overflow-hidden flex items-center justify-center p-1 gap-1">
                {Object.keys(remoteStreams).length === 0 ? (
                  <div className="text-white/50 text-sm flex flex-col items-center">
                    <Loader2 className="animate-spin mb-2" size={24} />
                    Waiting for others...
                  </div>
                ) : (
                  Object.entries(remoteStreams).map(([userId, stream]) => (
                    <VideoPlayer key={userId} stream={stream} isLocal={false} />
                  ))
                )}
              </div>

              {/* Local Stream (PiP) */}
              {localStream && callState.callType === "video" && (
                <div className="absolute bottom-2 right-2 w-24 h-32 bg-gray-900 rounded-lg overflow-hidden border-2 border-white/20 shadow-lg">
                  <VideoPlayer stream={localStream} isLocal={true} />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls */}
        <div className="p-4 bg-card flex justify-center gap-4">
          <Button
            variant={callState.isMuted ? "destructive" : "secondary"}
            size="icon"
            className="rounded-full h-12 w-12"
            onClick={toggleMute}
          >
            {callState.isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </Button>

          {callState.callType === "video" && (
            <Button
              variant={callState.isVideoOff ? "destructive" : "secondary"}
              size="icon"
              className="rounded-full h-12 w-12"
              onClick={toggleVideo}
            >
              {callState.isVideoOff ? (
                <VideoOff size={20} />
              ) : (
                <Video size={20} />
              )}
            </Button>
          )}

          {callState.callType === "video" && (
            <Button
              variant={isScreenSharing ? "default" : "secondary"}
              size="icon"
              className={`rounded-full h-12 w-12 ${isScreenSharing ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}`}
              onClick={toggleScreenShare}
            >
              {isScreenSharing ? (
                <MonitorOff size={20} />
              ) : (
                <MonitorUp size={20} />
              )}
            </Button>
          )}

          <Button
            variant="destructive"
            size="icon"
            className="rounded-full h-12 w-12"
            onClick={leaveCall}
          >
            <PhoneOff size={20} />
          </Button>
        </div>
      </motion.div>
    );
  }

  return null;
}

// Helper component to render video stream
function VideoPlayer({
  stream,
  isLocal,
}: {
  stream: MediaStream;
  isLocal: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={isLocal} // Always mute local video so user doesn't hear themselves
      className="w-full h-full object-cover"
    />
  );
}
