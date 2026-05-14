import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { io, Socket } from "socket.io-client";
import { useSelector } from "react-redux";
import { type RootState } from "../store";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  onlineUsers: string[];
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  onlineUsers: [],
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const { userInfo } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    if (!userInfo) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
        setOnlineUsers([]);
      }
      return;
    }

    const backendUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
    const newSocket = io(backendUrl, {
      withCredentials: true, // Required to pass cookies if needed
    });

    newSocket.on("connect", () => {
      setIsConnected(true);
      // Emit setup event with user ID so backend joins personal room
      newSocket.emit("setup", { id: userInfo._id });
    });

    newSocket.on("get_online_users", (users: string[]) => {
      setOnlineUsers(users);
    });

    newSocket.on("disconnect", () => {
      setIsConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [userInfo]); // Re-run when userInfo changes (login/logout)

  return (
    <SocketContext.Provider value={{ socket, isConnected, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
};
