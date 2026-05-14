import { useState, useRef, useEffect } from "react";
import { Mic, Square, Trash2, Send } from "lucide-react";

export default function AudioRecorder({
  onSendAudio,
}: {
  onSendAudio: (blob: Blob) => void;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access is required to record audio.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  const cancelRecording = () => {
    stopRecording();
    setAudioBlob(null);
    setRecordingTime(0);
  };

  const handleSend = () => {
    if (audioBlob) {
      onSendAudio(audioBlob);
      setAudioBlob(null);
      setRecordingTime(0);
    }
  };

  if (audioBlob) {
    return (
      <div className="flex items-center gap-3 bg-red-50 dark:bg-red-500/10 px-4 py-2 rounded-2xl w-full">
        <button
          onClick={cancelRecording}
          className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-full transition-colors"
        >
          <Trash2 size={20} />
        </button>
        <div className="flex-1 text-sm font-medium text-red-600 dark:text-red-400">
          Recording saved ({formatTime(recordingTime)})
        </div>
        <button
          onClick={handleSend}
          className="p-2.5 bg-primary text-white rounded-full hover:bg-primary/90 transition-all shadow-lg shadow-primary/30 active:translate-y-0"
        >
          <Send size={18} className="ml-0.5" />
        </button>
      </div>
    );
  }

  if (isRecording) {
    return (
      <div className="flex items-center justify-between bg-red-50 dark:bg-red-500/10 px-4 py-2 rounded-2xl w-full animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-ping"></div>
          <span className="text-red-500 font-medium font-mono">
            {formatTime(recordingTime)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={cancelRecording}
            className="p-2 text-gray-500 hover:text-red-500 transition-colors"
          >
            <Trash2 size={20} />
          </button>
          <button
            onClick={stopRecording}
            className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg shadow-red-500/30"
          >
            <Square size={16} className="fill-current" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startRecording}
      className="p-3.5 bg-primary text-white rounded-2xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0"
    >
      <Mic size={20} />
    </button>
  );
}
