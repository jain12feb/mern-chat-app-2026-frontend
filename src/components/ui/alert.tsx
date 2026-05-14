import { AlertCircle, X } from "lucide-react";

function Alert({
  error,
  setError,
}: {
  error: string;
  setError: (error: string) => void;
}) {
  return (
    <div className="flex items-center justify-between w-full bg-destructive text-destructive-foreground px-4 py-3 rounded-lg">
      {/* Left side (icon + text) */}
      <div className="flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-destructive-foreground" />
        <span className="text-sm font-medium">{error}</span>
      </div>

      {/* Close button */}
      <button
        className="text-destructive-foreground hover:text-destructive-foreground/80 transition"
        onClick={() => setError("")}
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

export default Alert;
