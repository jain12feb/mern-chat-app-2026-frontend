import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../store";
import Login from "../components/auth/Login";
import Register from "../components/auth/Register";

const AuthPage = () => {
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const navigate = useNavigate();

  const { userInfo } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    if (userInfo) {
      navigate("/chat");
    }
  }, [navigate, userInfo]);

  return (
    <div className="flex min-h-screen w-full bg-white dark:bg-zinc-950 overflow-hidden">
      {/* Left Side: Form */}
      <div className="flex-1 flex flex-col items-center justify-start px-8 lg:px-24 py-16 overflow-y-auto">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {activeTab === "register" ? "Get Started Now" : "Welcome Back"}
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400">
              {activeTab === "register"
                ? "Enter your details to create an account"
                : "Enter your credentials to access your account"}
            </p>
          </div>

          <div className="w-full">
            {activeTab === "register" ? <Register /> : <Login />}
          </div>

          <div className="text-center">
            <p className="text-zinc-600 dark:text-zinc-400 text-sm">
              {activeTab === "register" ? (
                <>
                  Have an account?{" "}
                  <button
                    onClick={() => setActiveTab("login")}
                    className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                  >
                    Sign In
                  </button>
                </>
              ) : (
                <>
                  Don't have an account?{" "}
                  <button
                    onClick={() => setActiveTab("register")}
                    className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                  >
                    Create Account
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Right Side: Hero Image */}
      <div className="hidden lg:flex flex-1 p-6">
        <div className="relative w-full h-full rounded-[2.5rem] overflow-hidden bg-[#F3F5F1] dark:bg-zinc-900">
          <img
            src="auth_page.png"
            alt="Nature Background"
            className="absolute inset-0 w-full h-full object-cover mix-blend-multiply opacity-90 dark:opacity-70 dark:mix-blend-normal"
          />
          {/* Subtle overlay for better contrast if needed */}
          <div className="absolute inset-0 bg-linear-to-t from-black/20 to-transparent pointer-events-none" />

          {/* <div className="absolute bottom-12 left-12 right-12 text-white">
            <h2 className="text-3xl font-bold mb-2">Connect with Nature</h2>
            <p className="text-white/80 max-w-md">
              Intelligent real-time collaboration with clean light and dark
              themes. Experience the next level of communication.
            </p>
          </div> */}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
