import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { type RootState } from "./store";
import { useRefreshMutation, useLogoutApiMutation } from "./store/authApi";
import { setCredentials, logout } from "./store/authSlice";
import AuthPage from "./pages/AuthPage";
import ChatPage from "./pages/ChatPage";
import { useSocket } from "./context/SocketContext";
import { chatApi } from "./store/chatApi";

import { Loader2, LogOut, User, Settings } from "lucide-react";
import { Button } from "./components/ui/button";
import { ThemeToggle } from "./components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "./components/ui/avatar";
import { Toaster } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import ProfileModal from "./components/chat/ProfileModal";
import UserSettingsModal from "./components/chat/UserSettingsModal";
import CallManager from "./components/call/CallManager";

function AppContent() {
  const [isRefreshing, setIsRefreshing] = useState(true);
  const { userInfo, token } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [refresh] = useRefreshMutation();
  const [logoutApi] = useLogoutApiMutation();
  const { socket } = useSocket();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    if (!socket) return;

    const handleUserDeleted = (deletedUserId: string) => {
      if (userInfo?._id === deletedUserId) {
        dispatch(logout());
        navigate("/");
      } else {
        // Invalidate chats to remove deleted user's chats
        dispatch(chatApi.util.invalidateTags(["Chat"]));
      }
    };

    socket.on("user_deleted", handleUserDeleted);

    return () => {
      socket.off("user_deleted", handleUserDeleted);
    };
  }, [socket, dispatch, navigate, userInfo]);

  useEffect(() => {
    const verifyUser = async () => {
      try {
        const res = await refresh({}).unwrap();
        dispatch(
          setCredentials({ user: userInfo, accessToken: res.accessToken }),
        );
      } catch (err) {
        dispatch(logout());
      } finally {
        setIsRefreshing(false);
      }
    };

    if (!token && userInfo) {
      verifyUser();
    } else {
      setIsRefreshing(false);
    }
  }, [token, userInfo, dispatch, refresh]);

  const handleLogout = async () => {
    try {
      await logoutApi({}).unwrap();
      dispatch(logout());
      navigate("/");
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  if (isRefreshing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  return (
    <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between px-4 py-1">
          <div>
            <h1 className="text-xl font-bold text-primary">Nexus AI</h1>
            <p className="text-sm text-muted-foreground">
              Collaborative messaging workspace
            </p>
          </div>
          {userInfo && (
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-10 w-10 rounded-full p-0 overflow-hidden transition-colors"
                  >
                    <Avatar className="h-full w-full">
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">
                        {userInfo.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {userInfo.username}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {userInfo.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setIsProfileOpen(true)}>
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsSettingsOpen(true)}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="bg-destructive/90 text-destructive-foreground focus:bg-destructive dark:focus:bg-destructive"
                    onClick={handleLogout}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
          {!userInfo && (
            <div className="flex items-center gap-3">
              <ThemeToggle />
            </div>
          )}
        </div>
      </header>
      <main className="flex-1 flex flex-col overflow-hidden">
        <Routes>
          <Route path="/" element={<AuthPage />} />
          <Route path="/chat" element={<ChatPage />} />
        </Routes>
      </main>

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />

      <UserSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
      
      <CallManager />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <TooltipProvider>
        <AppContent />
        <Toaster position="top-right" closeButton richColors />
      </TooltipProvider>
    </BrowserRouter>
  );
}

export default App;
