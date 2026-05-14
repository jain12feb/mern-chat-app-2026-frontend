import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { type RootState } from "../store";
import { useSocket } from "./SocketContext";
import {
  setIncomingCall,
  acceptIncomingCall,
  rejectIncomingCall,
  endCall,
  initiateCall,
  setCallConnected,
  type CallType,
  toggleMuteState,
  toggleVideoState,
} from "../store/callSlice";
import { toast } from "sonner";

interface WebRTCContextProps {
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  startCall: (
    chatId: string,
    participants: any[],
    type: CallType,
  ) => Promise<void>;
  answerCall: () => Promise<void>;
  rejectCall: () => void;
  leaveCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  isScreenSharing: boolean;
  toggleScreenShare: () => Promise<void>;
}

const WebRTCContext = createContext<WebRTCContextProps | null>(null);

const STUN_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export const WebRTCProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { socket, isConnected } = useSocket();
  const dispatch = useDispatch();
  const { userInfo, token } = useSelector((state: RootState) => state.auth);
  const callState = useSelector((state: RootState) => state.call);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<
    Record<string, MediaStream>
  >({});
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [iceServers, setIceServers] = useState<RTCIceServer[]>(
    STUN_SERVERS.iceServers,
  );

  const peersRef = useRef<Record<string, RTCPeerConnection>>({});

  // Fetch TURN credentials from backend
  useEffect(() => {
    const fetchIceServers = async () => {
      try {
        if (!token) return;
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
        const res = await fetch(`${apiUrl}/api/calls/turn-credentials`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.iceServers) {
            setIceServers(data.iceServers);
          }
        }
      } catch (err) {
        console.error("Failed to fetch TURN servers, falling back to STUN", err);
      }
    };
    if (userInfo) {
      fetchIceServers();
    }
  }, [userInfo, token]);

  const getMedia = async (video: boolean, audio: boolean = true) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video,
        audio,
      });
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error("Failed to get local stream", err);
      toast.error(
        "Could not access camera/microphone. Please check permissions.",
      );
      return null;
    }
  };

  const stopMedia = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
    setRemoteStreams({});
    Object.values(peersRef.current).forEach((pc) => pc.close());
    peersRef.current = {};
  }, [localStream]);

  const createPeer = useCallback(
    (userId: string, stream: MediaStream | null) => {
      const peer = new RTCPeerConnection({ iceServers });

      if (stream) {
        stream.getTracks().forEach((track) => {
          peer.addTrack(track, stream);
        });
      }

      peer.ontrack = (event) => {
        setRemoteStreams((prev) => ({
          ...prev,
          [userId]: event.streams[0],
        }));
      };

      peer.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit("webrtc_ice_candidate", {
            target: userId,
            candidate: event.candidate,
            from: userInfo?._id,
          });
        }
      };

      peersRef.current[userId] = peer;
      return peer;
    },
    [socket, userInfo, iceServers],
  );

  const startCall = async (
    chatId: string,
    participants: any[],
    type: CallType,
  ) => {
    const stream = await getMedia(type === "video");
    if (!stream) return;

    dispatch(initiateCall({ chatId, type, participants }));

    if (participants.length === 2) {
      const targetUser = participants.find((p) => p._id !== userInfo?._id);
      if (targetUser) {
        const targetId = targetUser._id || targetUser;
        createPeer(targetId, stream);

        socket?.emit("webrtc_call_user", {
          userToCall: targetId,
          from: userInfo?._id,
          name: userInfo?.username,
          type,
          chatId,
        });
      }
    } else {
      socket?.emit("join_group_call", {
        chatId,
        userId: userInfo?._id,
        name: userInfo?.username,
      });
    }
  };

  const answerCall = async () => {
    if (!callState.caller || !callState.callType) return;

    const stream = await getMedia(callState.callType === "video");
    if (!stream) {
      rejectCall();
      return;
    }

    dispatch(acceptIncomingCall());
    socket?.emit("webrtc_answer_call", { to: callState.caller.id });
  };

  const rejectCall = () => {
    if (callState.caller) {
      socket?.emit("webrtc_reject_call", { to: callState.caller.id });
    }
    stopMedia();
    dispatch(rejectIncomingCall());
  };

  const leaveCall = () => {
    const targets = callState.participants
      .map((p) => p.id)
      .filter((id) => id !== userInfo?._id);
    socket?.emit("webrtc_end_call", { to: targets });
    stopMedia();
    dispatch(endCall());
  };

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleIncomingCall = ({ from, name, type, chatId }: any) => {
      dispatch(
        setIncomingCall({
          caller: { id: from, name },
          type,
          chatId,
        }),
      );
    };

    const handleCallAccepted = async () => {
      dispatch(setCallConnected());
      const targetId = Object.keys(peersRef.current)[0];
      const peer = peersRef.current[targetId];
      if (peer) {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.emit("webrtc_offer", {
          target: targetId,
          caller: userInfo?._id,
          sdp: offer,
          type: callState.callType,
          name: userInfo?.username,
        });
      }
    };

    const handleOffer = async ({ caller, sdp }: any) => {
      dispatch(setCallConnected());
      let peer = peersRef.current[caller];

      if (!peer) {
        peer = createPeer(caller, localStream);
      }

      await peer.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      socket.emit("webrtc_answer", {
        target: caller,
        answerer: userInfo?._id,
        sdp: answer,
      });
    };

    const handleAnswer = async ({ answerer, sdp }: any) => {
      const peer = peersRef.current[answerer];
      if (peer) {
        await peer.setRemoteDescription(new RTCSessionDescription(sdp));
      }
    };

    const handleIceCandidate = async ({ candidate, from }: any) => {
      const peer = peersRef.current[from];
      if (peer) {
        try {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("Error adding received ice candidate", e);
        }
      }
    };

    const handleCallEnded = () => {
      stopMedia();
      dispatch(endCall());
      toast("Call ended");
    };

    const handleCallRejected = () => {
      stopMedia();
      dispatch(endCall());
      toast("Call rejected");
    };

    const handleUserJoined = async ({ userId }: any) => {
      const peer = createPeer(userId, localStream);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit("webrtc_offer", {
        target: userId,
        caller: userInfo?._id,
        sdp: offer,
        type: callState.callType,
        name: userInfo?.username,
      });
    };

    const handleUserLeft = ({ userId }: any) => {
      if (peersRef.current[userId]) {
        peersRef.current[userId].close();
        delete peersRef.current[userId];
      }
      setRemoteStreams((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    };

    socket.on("webrtc_call_incoming", handleIncomingCall);
    socket.on("webrtc_call_accepted", handleCallAccepted);
    socket.on("webrtc_offer", handleOffer);
    socket.on("webrtc_answer", handleAnswer);
    socket.on("webrtc_ice_candidate", handleIceCandidate);
    socket.on("webrtc_call_ended", handleCallEnded);
    socket.on("webrtc_call_rejected", handleCallRejected);
    socket.on("user_joined_call", handleUserJoined);
    socket.on("user_left_call", handleUserLeft);

    return () => {
      socket.off("webrtc_call_incoming", handleIncomingCall);
      socket.off("webrtc_call_accepted", handleCallAccepted);
      socket.off("webrtc_offer", handleOffer);
      socket.off("webrtc_answer", handleAnswer);
      socket.off("webrtc_ice_candidate", handleIceCandidate);
      socket.off("webrtc_call_ended", handleCallEnded);
      socket.off("webrtc_call_rejected", handleCallRejected);
      socket.off("user_joined_call", handleUserJoined);
      socket.off("user_left_call", handleUserLeft);
    };
  }, [
    socket,
    isConnected,
    localStream,
    userInfo,
    callState.callType,
    createPeer,
    dispatch,
    stopMedia,
  ]);

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      dispatch(toggleMuteState());
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      dispatch(toggleVideoState());
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        // Stop screen share, revert to camera
        const cameraStream = await navigator.mediaDevices.getUserMedia({
          video: !callState.isVideoOff,
          audio: !callState.isMuted,
        });

        const videoTrack = cameraStream.getVideoTracks()[0];
        const audioTrack = localStream?.getAudioTracks()[0]; // Keep existing audio if any

        if (localStream) {
          // Stop existing screen share tracks
          localStream.getVideoTracks().forEach((track) => track.stop());
        }

        const newTracks = [];
        if (videoTrack) newTracks.push(videoTrack);
        if (audioTrack) newTracks.push(audioTrack);

        const newStream = new MediaStream(newTracks);
        setLocalStream(newStream);

        // Replace tracks in all peer connections
        Object.values(peersRef.current).forEach((peer) => {
          const senders = peer.getSenders();
          const videoSender = senders.find((s) => s.track?.kind === "video");
          if (videoSender && videoTrack) {
            videoSender.replaceTrack(videoTrack);
          }
        });

        setIsScreenSharing(false);
      } else {
        // Start screen share
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });
        const screenVideoTrack = screenStream.getVideoTracks()[0];

        // If user stops sharing via browser UI
        screenVideoTrack.onended = () => {
          toggleScreenShare(); // Revert back
        };

        const audioTrack = localStream?.getAudioTracks()[0];

        if (localStream) {
          // Stop current camera track
          localStream.getVideoTracks().forEach((track) => track.stop());
        }

        const newTracks = [screenVideoTrack];
        if (audioTrack) newTracks.push(audioTrack);

        const newStream = new MediaStream(newTracks);
        setLocalStream(newStream);

        // Replace tracks in all peer connections
        Object.values(peersRef.current).forEach((peer) => {
          const senders = peer.getSenders();
          const videoSender = senders.find((s) => s.track?.kind === "video");
          if (videoSender) {
            videoSender.replaceTrack(screenVideoTrack);
          }
        });

        setIsScreenSharing(true);
      }
    } catch (err) {
      console.error("Error toggling screen share:", err);
      toast.error("Could not share screen.");
    }
  };

  return (
    <WebRTCContext.Provider
      value={{
        localStream,
        remoteStreams,
        startCall,
        answerCall,
        rejectCall,
        leaveCall,
        toggleMute,
        toggleVideo,
        isScreenSharing,
        toggleScreenShare,
      }}
    >
      {children}
    </WebRTCContext.Provider>
  );
};

export const useWebRTC = () => {
  const context = useContext(WebRTCContext);
  if (!context) {
    throw new Error("useWebRTC must be used within a WebRTCProvider");
  }
  return context;
};
