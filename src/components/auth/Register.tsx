import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import {
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  AlertTriangleIcon,
} from "lucide-react";
import {
  useRegisterMutation,
  useLazyCheckUsernameQuery,
} from "../../store/authApi";
import { setCredentials } from "../../store/authSlice";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import Alert from "../ui/alert";

interface RegisterProps {
  onSwitch: () => void;
}

const Register = ({ onSwitch }: RegisterProps) => {
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [register, { isLoading }] = useRegisterMutation();
  const [checkUsername] = useLazyCheckUsernameQuery();

  useEffect(() => {
    if (!username || username.length < 3) {
      setUsernameStatus("idle");
      return;
    }

    const timer = setTimeout(async () => {
      setUsernameStatus("checking");
      try {
        const res = await checkUsername(username).unwrap();
        setUsernameStatus(res.available ? "available" : "taken");
      } catch (err) {
        setUsernameStatus("idle");
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username, checkUsername]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username || !email || !password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (usernameStatus === "taken") {
      setError("Please choose a different username");
      return;
    }

    try {
      const res = await register({ username, email, password }).unwrap();
      const { accessToken, ...user } = res;
      dispatch(setCredentials({ user, accessToken }));
      navigate("/chat");
    } catch (err: any) {
      setError(
        err?.data?.message ||
          err?.data?.errors?.[0]?.message ||
          "Registration failed",
      );
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {error && <Alert error={error} setError={setError} />}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label
            htmlFor="username"
            className="text-sm font-semibold text-zinc-700 dark:text-zinc-300"
          >
            Username
          </Label>
          <div className="relative">
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Choose a username"
              disabled={isLoading}
              className={`h-11 rounded-xl border-zinc-200 focus:border-zinc-400 focus:ring-0 px-4 pr-10 transition-all ${
                usernameStatus === "available"
                  ? "border-green-500 focus:border-green-500"
                  : usernameStatus === "taken"
                    ? "border-red-500 focus:border-red-500"
                    : ""
              }`}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {usernameStatus === "checking" && (
                <Loader2 size={16} className="animate-spin text-zinc-400" />
              )}
              {usernameStatus === "available" && (
                <CheckCircle2 size={16} className="text-green-500" />
              )}
              {usernameStatus === "taken" && (
                <AlertCircle size={16} className="text-red-500" />
              )}
            </div>
          </div>
          {usernameStatus === "taken" && (
            <p className="text-[11px] text-red-500 font-medium">
              Username already taken
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="email"
            className="text-sm font-semibold text-zinc-700 dark:text-zinc-300"
          >
            Email address
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            disabled={isLoading}
            className="h-11 rounded-xl border-zinc-200 focus:border-zinc-400 focus:ring-0 px-4 transition-all"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label
              htmlFor="password"
              className="text-sm font-semibold text-zinc-700 dark:text-zinc-300"
            >
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create password"
                disabled={isLoading}
                className="h-11 rounded-xl border-zinc-200 focus:border-zinc-400 focus:ring-0 px-4 pr-9 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"
                disabled={isLoading}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="confirmPassword"
              title="Confirm Password"
              className="text-sm font-semibold text-zinc-700 dark:text-zinc-300"
            >
              Confirm
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                disabled={isLoading}
                className="h-11 rounded-xl border-zinc-200 focus:border-zinc-400 focus:ring-0 px-4 pr-9 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"
                disabled={isLoading}
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-12 rounded-xl bg-[#3B5028] hover:bg-[#2D3E1F] text-white font-bold text-base shadow-lg shadow-[#3B5028]/20 transition-all"
        >
          {isLoading ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            "Signup"
          )}
        </Button>
      </form>
    </div>
  );
};

export default Register;
