import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { useLoginMutation } from "../../store/authApi";
import { setCredentials } from "../../store/authSlice";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import Alert from "../ui/alert";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [login, { isLoading }] = useLoginMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    try {
      const res = await login({ email, password }).unwrap();
      const { accessToken, ...user } = res;
      dispatch(setCredentials({ user, accessToken }));
      navigate("/chat");
    } catch (err: any) {
      setError(
        err?.data?.message ||
          err?.data?.errors?.[0]?.message ||
          "Invalid email or password",
      );
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {error && <Alert error={error} setError={setError} />}

      <form onSubmit={handleSubmit} className="space-y-5">
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
            className="h-12 rounded-xl border-zinc-200 focus:border-zinc-400 focus:ring-0 px-4 transition-all"
          />
        </div>

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
              placeholder="Enter your password"
              disabled={isLoading}
              className="h-12 rounded-xl border-zinc-200 focus:border-zinc-400 focus:ring-0 px-4 pr-10 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              disabled={isLoading}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-12 rounded-xl bg-[#3B5028] hover:bg-[#2D3E1F] text-white font-bold text-base shadow-lg shadow-[#3B5028]/20 transition-all mt-2"
        >
          {isLoading ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            "Sign In"
          )}
        </Button>
      </form>
    </div>
  );
};

export default Login;
