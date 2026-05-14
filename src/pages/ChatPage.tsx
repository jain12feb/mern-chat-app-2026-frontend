import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { type RootState } from "../store";
import { Navigate } from "react-router-dom";
import { PanelLeftClose, Menu } from "lucide-react";
import Sidebar from "../components/chat/Sidebar";
import ChatBox from "../components/chat/ChatBox";
import { Button } from "../components/ui/button";
import { Sheet, SheetContent } from "../components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../components/ui/tooltip";

const ChatPage = () => {
  const { userInfo } = useSelector((state: RootState) => state.auth);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  if (!userInfo) {
    return <Navigate to="/" />;
  }

  return (
    <div className="flex-1 h-full w-full bg-background overflow-hidden relative">
      {isMobile ? (
        <div className="flex flex-col w-full relative h-full">
          <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
            <SheetContent
              side="left"
              className="p-0 w-[300px] sm:w-[350px] border-r border-border"
            >
              <Sidebar />
            </SheetContent>
          </Sheet>

          <div className="flex-1 flex flex-col bg-accent/30 relative overflow-hidden">
            <ChatBox
              isSidebarOpen={isSidebarOpen}
              onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex h-full items-stretch overflow-hidden">
          <div 
            className={`bg-card border-r border-border h-full relative flex-shrink-0 transition-all duration-300 ease-in-out ${
              isSidebarOpen ? "w-[320px] lg:w-[380px] min-w-0" : "w-[84px] min-w-0"
            }`}
          >
            <div className="h-full relative overflow-hidden">
              <Sidebar isCollapsed={!isSidebarOpen} />
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    variant="ghost"
                    size="icon"
                    className={`absolute top-4 z-20 text-muted-foreground hover:text-primary transition-all duration-300 ${
                      isSidebarOpen ? "right-4" : "left-1/2 -translate-x-1/2"
                    }`}
                  >
                    {isSidebarOpen ? <PanelLeftClose size={20} /> : <Menu size={20} />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="flex-1 flex flex-col bg-accent/30 min-w-0 h-full relative overflow-hidden">
            <ChatBox
              isSidebarOpen={isSidebarOpen}
              onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPage;
