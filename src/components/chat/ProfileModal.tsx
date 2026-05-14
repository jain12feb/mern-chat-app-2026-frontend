import React, { useState, useEffect } from "react";
import {
  Loader2,
  Camera,
  User,
  Mail,
  Lock,
  Check,
} from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { type RootState } from "../../store";
import { useUpdateProfileMutation } from "../../store/authApi";
import { updateUserInfo } from "../../store/authSlice";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { toast } from "sonner";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProfileModal = ({ isOpen, onClose }: ProfileModalProps) => {
  const dispatch = useDispatch();
  const { userInfo } = useSelector((state: RootState) => state.auth);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [avatar, setAvatar] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [updateProfile, { isLoading: isUpdating }] = useUpdateProfileMutation();

  useEffect(() => {
    if (userInfo) {
      setUsername(userInfo.username || "");
      setEmail(userInfo.email || "");
      setAvatar(userInfo.avatar || "");
    }
  }, [userInfo, isOpen]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size must be less than 5MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password && password !== confirmPassword) {
      return toast.error("Passwords do not match");
    }

    try {
      const result = await updateProfile({
        username,
        avatar,
        ...(password ? { password } : {}),
      }).unwrap();

      dispatch(updateUserInfo(result));
      toast.success("Profile updated successfully!");
      setPassword("");
      setConfirmPassword("");
      onClose();
    } catch (err: any) {
      console.error("Failed to update profile", err);
      toast.error(err?.data?.message || "Failed to update profile");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl p-0 overflow-hidden border border-gray-200 dark:border-zinc-800 shadow-2xl bg-white dark:bg-zinc-950 flex flex-col h-[90vh] sm:h-[580px]">
        {/* Header */}
        <DialogHeader className="border-b border-gray-200 dark:border-zinc-800 pr-14 p-5">
          <DialogTitle>My Profile</DialogTitle>
          <DialogDescription>
            View and manage your personal information
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex-1 flex flex-col overflow-hidden"
        >
          {/* Main Horizontal Content */}
          <div className="flex flex-1 overflow-hidden flex-col sm:flex-row bg-white dark:bg-zinc-950">
            {/* Left Side: Avatar & Basic Info */}
            <div className="w-full sm:w-[35%] p-6 flex flex-col items-center gap-6 border-b sm:border-b-0 sm:border-r border-gray-200 dark:border-zinc-800 bg-gray-50/30 dark:bg-zinc-900/10">
              <div className="relative group">
                <Avatar className="h-32 w-32 border-4 border-white dark:border-zinc-800 shadow-xl ring-1 ring-border transition-transform group-hover:scale-[1.02]">
                  <AvatarImage src={avatar} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-3xl">
                    {username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <label className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Camera className="text-white" size={24} />
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageChange}
                  />
                </label>
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {username}
                </h3>
                <p className="text-sm text-gray-500 dark:text-zinc-500 font-medium">
                  {email}
                </p>
              </div>

              <div className="w-full pt-4">
                <div className="rounded-xl bg-primary/5 border border-primary/10 p-4 text-center">
                  <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">
                    Account Status
                  </p>
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                    Active Member
                  </p>
                </div>
              </div>
            </div>

            {/* Right Side: Form Fields */}
            <div className="w-full sm:flex-1 p-6 sm:p-8 flex flex-col gap-6 overflow-y-auto">
              <div className="space-y-4">
                <label className="text-[11px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest px-1">
                  General Information
                </label>
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 ml-1">
                      Username
                    </p>
                    <div className="relative">
                      <User
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500"
                        size={16}
                      />
                      <Input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Enter username"
                        className="w-full h-11 pl-11 pr-4 rounded-2xl bg-gray-100 dark:bg-zinc-800 border-transparent focus:ring-2 focus:ring-primary/40 text-sm font-medium"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 ml-1">
                      Email Address
                    </p>
                    <div className="relative opacity-60">
                      <Mail
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500"
                        size={16}
                      />
                      <Input
                        value={email}
                        disabled
                        className="w-full h-11 pl-11 pr-4 rounded-2xl bg-gray-100 dark:bg-zinc-800 border-transparent text-sm font-medium cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[11px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest px-1">
                  Change Password
                </label>
                <div className="grid gap-4">
                  <div className="relative">
                    <Lock
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500"
                      size={16}
                    />
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="New password (leave blank to keep current)"
                      className="w-full h-11 pl-11 pr-4 rounded-2xl bg-gray-100 dark:bg-zinc-800 border-transparent focus:ring-2 focus:ring-primary/40 text-sm font-medium"
                    />
                  </div>
                  <div className="relative">
                    <Lock
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500"
                      size={16}
                    />
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full h-11 pl-11 pr-4 rounded-2xl bg-gray-100 dark:bg-zinc-800 border-transparent focus:ring-2 focus:ring-primary/40 text-sm font-medium"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="border-t border-gray-200 dark:border-zinc-800 p-4 flex items-center justify-end bg-white dark:bg-zinc-950">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <Button
                type="submit"
                disabled={isUpdating}
                className="px-6 py-2 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 transition-colors shadow-md flex items-center gap-2"
              >
                {isUpdating ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                Save Changes
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileModal;
