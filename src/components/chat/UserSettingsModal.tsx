import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import {
  Bell,
  Sparkles,
  Keyboard,
  Shield,
  Palette,
  Trash2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Switch } from "../ui/switch";
import { ScrollArea } from "../ui/scroll-area";
import { useDeleteAccountMutation } from "../../store/authApi";
import { logout } from "../../store/authSlice";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const UserSettingsModal = ({ isOpen, onClose }: UserSettingsModalProps) => {
  // Load settings from localStorage or use defaults
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem("nexus_user_settings");
    return saved
      ? JSON.parse(saved)
      : {
          smartReplies: true,
          enterToSend: true,
          soundNotifications: true,
          desktopNotifications: false,
          aiSummarization: true,
          readReceipts: true,
        };
  });

  useEffect(() => {
    localStorage.setItem("nexus_user_settings", JSON.stringify(settings));
    // Trigger a custom event so other components can react (e.g. ChatBox for smart replies)
    window.dispatchEvent(new Event("nexus_settings_updated"));
  }, [settings]);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [deleteAccount, { isLoading: isDeleting }] = useDeleteAccountMutation();

  const handleToggle = (key: keyof typeof settings) => {
    setSettings((prev: any) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDeleteAccount = async () => {
    if (
      confirm(
        "WARNING: This will permanently delete your account and all your data. This action cannot be undone. Are you sure?",
      )
    ) {
      try {
        await deleteAccount({}).unwrap();
        toast.success("Account deleted successfully");
        dispatch(logout());
        onClose();
        navigate("/");
      } catch (err: any) {
        toast.error(err?.data?.message || "Failed to delete account");
      }
    }
  };

  const handleClearData = () => {
    if (
      confirm(
        "Are you sure you want to clear all local app data? This won't delete your account but will reset your preferences.",
      )
    ) {
      localStorage.clear();
      toast.success("Local data cleared. Refreshing...");
      setTimeout(() => window.location.reload(), 1500);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden gap-0 rounded-2xl border-none shadow-2xl">
        <div className="bg-primary/5 p-6 border-b border-border/50">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-xl">
                <Shield className="text-primary h-5 w-5" />
              </div>
              App Settings
            </DialogTitle>
            <DialogDescription className="text-sm">
              Personalize your Nexus AI experience and manage your preferences.
            </DialogDescription>
          </DialogHeader>
        </div>

        <Tabs defaultValue="ai" className="w-full">
          <div className="flex bg-muted/30 border-b border-border/50">
            <TabsList className="bg-transparent h-12 gap-2 px-6">
              <TabsTrigger
                value="ai"
                className="data-[state=active]:bg-background data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary h-full px-4 transition-all"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                AI
              </TabsTrigger>
              <TabsTrigger
                value="notifications"
                className="data-[state=active]:bg-background data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary h-full px-4 transition-all"
              >
                <Bell className="h-4 w-4 mr-2" />
                Notifications
              </TabsTrigger>
              <TabsTrigger
                value="chat"
                className="data-[state=active]:bg-background data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary h-full px-4 transition-all"
              >
                <Keyboard className="h-4 w-4 mr-2" />
                Chat
              </TabsTrigger>
              <TabsTrigger
                value="account"
                className="data-[state=active]:bg-background data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary h-full px-4 transition-all"
              >
                <Shield className="h-4 w-4 mr-2" />
                Account
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="max-h-[400px]">
            <div className="p-6">
              <TabsContent value="ai" className="mt-0 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-accent/30 border border-border/50">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-bold">Smart Replies</Label>
                      <p className="text-[12px] text-muted-foreground">
                        Show AI-generated response suggestions.
                      </p>
                    </div>
                    <Switch
                      checked={settings.smartReplies}
                      onCheckedChange={() => handleToggle("smartReplies")}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-accent/30 border border-border/50">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-bold">
                        Conversation Summaries
                      </Label>
                      <p className="text-[12px] text-muted-foreground">
                        Enable the AI Sparkles button in chat headers.
                      </p>
                    </div>
                    <Switch
                      checked={settings.aiSummarization}
                      onCheckedChange={() => handleToggle("aiSummarization")}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="notifications" className="mt-0 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-accent/30 border border-border/50">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-bold">Sound Effects</Label>
                      <p className="text-[12px] text-muted-foreground">
                        Play a sound when a new message arrives.
                      </p>
                    </div>
                    <Switch
                      checked={settings.soundNotifications}
                      onCheckedChange={() => handleToggle("soundNotifications")}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-accent/30 border border-border/50">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-bold">
                        Desktop Notifications
                      </Label>
                      <p className="text-[12px] text-muted-foreground">
                        Show system notifications for new messages.
                      </p>
                    </div>
                    <Switch
                      checked={settings.desktopNotifications}
                      onCheckedChange={() =>
                        handleToggle("desktopNotifications")
                      }
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="chat" className="mt-0 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-accent/30 border border-border/50">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-bold">
                        Enter key to send
                      </Label>
                      <p className="text-[12px] text-muted-foreground">
                        Press Enter to send, Shift+Enter for new line.
                      </p>
                    </div>
                    <Switch
                      checked={settings.enterToSend}
                      onCheckedChange={() => handleToggle("enterToSend")}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-accent/30 border border-border/50">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-bold">Read Receipts</Label>
                      <p className="text-[12px] text-muted-foreground">
                        Let others know when you've read their messages.
                      </p>
                    </div>
                    <Switch
                      checked={settings.readReceipts}
                      onCheckedChange={() => handleToggle("readReceipts")}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="account" className="mt-0 space-y-6">
                <div className="p-6">
                  <div className="p-4 rounded-xl bg-destructive/5 space-y-4">
                    <div className="flex items-center gap-3 text-destructive">
                      <AlertCircle className="h-5 w-5" />
                      <h3 className="font-bold">Danger Zone</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Once you delete your account, there is no going back.
                      Please be certain.
                    </p>
                    <Button
                      variant="destructive"
                      className="w-full font-bold h-11"
                      onClick={handleDeleteAccount}
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 h-4 w-4" />
                      )}
                      Delete My Account
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>

        <div className="p-4 bg-muted/20 border-t border-border/50 flex items-center justify-between">
          <Button
            variant="destructive"
            // className="text-destructive hover:bg-destructive/10 hover:text-destructive text-xs font-semibold"
            onClick={handleClearData}
          >
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            Reset All Data
          </Button>
          <Button
            onClick={onClose}
            className="px-8 rounded-xl font-bold shadow-lg"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserSettingsModal;
