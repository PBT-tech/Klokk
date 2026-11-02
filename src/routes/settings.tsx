import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CreditCard,
  Globe,
  Mail,
  RefreshCw,
  Shield,
  Trash2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { PaymentCheckoutBlock } from "@/integrations/payments";
import { AvatarUpload, Avatar } from "@/components/klokk/avatar";
import { BillingTab, EmbedTab } from "@/components/klokk/settings-panels";
import {
  useCurrentAccount,
  useSession,
  useUpdateProfile,
  useDeleteAccount,
  useUpdateNotificationPrefs,
  useAuthActions,
} from "@/lib/klokk-hooks";
import { supabase } from "@/integrations/supabase/client";
import { uploadOrganiserAvatar } from "@/lib/klokk-avatars";
import { maskPhone } from "@/lib/klokk-format";
import type { NotificationPrefs } from "@/lib/klokk-types";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Account settings — Klokk" },
      {
        name: "description",
        content: "Manage your Klokk account, SMS credits, and embed settings.",
      },
    ],
  }),
  component: Settings,
});

type Tab = "account" | "billing" | "embed" | "notifications";

function Settings() {
  const session = useSession();
  const account = useCurrentAccount();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === "undefined") return "account";
    const t = new URLSearchParams(window.location.search).get("tab");
    return t === "billing" || t === "embed" || t === "notifications" ? t : "account";
  });

  useEffect(() => {
    if (!session) navigate({ to: "/signin" });
  }, [session, navigate]);

  if (!session || !account) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 text-center text-muted-foreground">
        Redirecting…
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "account", label: "Account", icon: <Shield className="size-4" /> },
    { id: "billing", label: "Plan & billing", icon: <CreditCard className="size-4" /> },
    { id: "embed", label: "Embed", icon: <Globe className="size-4" /> },
    { id: "notifications", label: "Notifications", icon: <Bell className="size-4" /> },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Settings</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Manage your account, plan and billing, embeds, and notifications.
      </p>

      <div className="mt-8 flex flex-wrap gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === "account" && <AccountTab account={account} />}
        {tab === "billing" && <BillingTab />}
        {tab === "embed" && <EmbedTab account={account} />}
        {tab === "notifications" && <NotificationsTab account={account} />}
      </div>
    </div>
  );
}

function AccountTab({ account }: { account: ReturnType<typeof useCurrentAccount> }) {
  const navigate = useNavigate();
  const updateProfile = useUpdateProfile();
  const deleteAccount = useDeleteAccount();
  const { signOut } = useAuthActions();
  const [firstName, setFirstName] = useState(account?.firstName ?? "");
  const [lastName, setLastName] = useState(account?.lastName ?? "");
  const [email, setEmail] = useState(account?.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!account) return null;

  const saveName = () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("First and last name can't be empty");
      return;
    }
    updateProfile.mutate(
      { firstName: firstName.trim(), lastName: lastName.trim() },
      { onSuccess: () => toast.success("Profile name updated") },
    );
  };

  const saveEmail = async () => {
    if (!email.trim()) {
      toast.error("Email can't be empty");
      return;
    }
    const { error } = await supabase.auth.updateUser({ email: email.trim() });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Email updated — check your inbox to confirm");
  };

  const savePassword = async () => {
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: account.email,
      password: currentPassword,
    });
    if (reauthError) {
      toast.error("Current password is incorrect");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error(error.message);
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    toast.success("Password updated");
  };

  const remove = () => {
    deleteAccount.mutate(undefined, {
      onSuccess: () => {
        signOut();
        toast.message("Account deleted");
        navigate({ to: "/" });
      },
      onError: () => toast.error("Could not delete account"),
    });
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader title="Profile" subtitle="Your account details" />
        <div className="space-y-5">
          <AvatarUpload
            currentUrl={account.avatarUrl}
            firstName={firstName}
            lastName={lastName}
            upload={(file) => uploadOrganiserAvatar(account.id, file)}
            onUploaded={(url) => {
              updateProfile.mutate(
                { avatarUrl: url },
                { onSuccess: () => toast.success("Profile photo saved") },
              );
            }}
            onRemove={() => {
              updateProfile.mutate(
                { avatarUrl: null },
                { onSuccess: () => toast.success("Photo removed") },
              );
            }}
            label="Profile photo"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-card-foreground">First name</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-card-foreground">Last name</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <Button onClick={saveName}>Save name</Button>
          <div className="space-y-4 border-t border-border/60 pt-4">
            <Row label="Email" value={account.email} verified={account.emailVerified} />
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-card-foreground">Update email</Label>
              <div className="flex gap-2">
                <Input value={email} onChange={(e) => setEmail(e.target.value)} />
                <Button onClick={saveEmail}>Save</Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Password" subtitle="Change your password" />
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-card-foreground">Current password</Label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-card-foreground">New password</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
          <Button onClick={savePassword} disabled={!currentPassword || !newPassword}>
            Update password
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Delete account"
          subtitle="Permanently remove your account and all events"
          danger
        />
        <p className="mb-4 text-sm text-muted-foreground">
          This deletes your account, all events, and participant responses. This cannot be undone.
        </p>
        <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-4" />
            Delete account
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete your account?</DialogTitle>
              <DialogDescription>
                This permanently deletes your account and all {account ? "events" : ""}.
                Type-confirm below to proceed.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={remove}>
                Yes, delete everything
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </Card>
    </div>
  );
}

function SmsTab({ account }: { account: NonNullable<ReturnType<typeof useCurrentAccount>> }) {
  const updateProfile = useUpdateProfile();
  const isFree = account.plan === "free";
  const [buyOpen, setBuyOpen] = useState(false);
  const [autoTopUp, setAutoTopUp] = useState(account.smsAutoTopUp);
  const [threshold, setThreshold] = useState(account.smsLowBalanceThreshold);

  const saveAuto = () => {
    if (isFree) {
      toast.error("Auto-top-up requires a paid plan");
      return;
    }
    updateProfile.mutate({
      smsAutoTopUp: autoTopUp,
      smsLowBalanceThreshold: threshold,
    });
    toast.success("Auto-top-up saved");
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader
          title="SMS credits"
          subtitle="Used for participant SMS notifications & reminders"
          icon={<Zap className="size-4" />}
        />
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display text-4xl font-bold text-card-foreground">
              {account.smsCredits}
            </p>
            <p className="text-sm text-muted-foreground">credits available</p>
          </div>
          <Button onClick={() => setBuyOpen(true)} className="shadow-premium">
            <CreditCard className="size-4" />
            Buy credits
          </Button>
        </div>
        {account.smsCredits <= account.smsLowBalanceThreshold && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm text-accent-foreground">
            <AlertTriangle className="size-4 text-accent" />
            Your balance is low. Top up to keep SMS notifications flowing.
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Auto-top-up" subtitle="Automatically refill when your balance drops" />
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-card-foreground">Enable auto-top-up</p>
              <p className="text-xs text-muted-foreground">
                Buy 100 credits when balance falls below your threshold.
              </p>
            </div>
            <Switch checked={autoTopUp} onCheckedChange={setAutoTopUp} disabled={isFree} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-card-foreground">Low-balance threshold</Label>
            <Input
              type="number"
              min={0}
              value={threshold}
              onChange={(e) => setThreshold(Math.max(0, Number(e.target.value) || 0))}
              className="max-w-xs"
            />
          </div>
          <Button onClick={saveAuto} variant="outline" className="text-sms-save-btn-text">
            <RefreshCw className="size-4" />
            Save auto-top-up
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Usage log" subtitle="Recent SMS activity" />
        {account.smsUsageLog.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No SMS sent yet. Usage appears here once you send notifications.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface/60 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Date</th>
                  <th className="px-4 py-2 text-left font-medium">Recipient</th>
                  <th className="px-4 py-2 text-left font-medium">Event</th>
                  <th className="px-4 py-2 text-left font-medium">Type</th>
                  <th className="px-4 py-2 text-right font-medium">Credits</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {account.smsUsageLog.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {new Date(u.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-muted-foreground">
                      {maskPhone(u.recipient)}
                    </td>
                    <td className="px-4 py-2.5 text-card-foreground">{u.eventTitle}</td>
                    <td className="px-4 py-2.5 capitalize text-muted-foreground">{u.type}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-card-foreground">
                      {u.credits}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={buyOpen} onOpenChange={setBuyOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Buy SMS credits</DialogTitle>
            <DialogDescription>Choose a credit pack to top up your balance.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto py-2">
            <PaymentCheckoutBlock checkoutMode="all" layout="two-step" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NotificationsTab({
  account,
}: {
  account: NonNullable<ReturnType<typeof useCurrentAccount>>;
}) {
  const updatePrefs = useUpdateNotificationPrefs();
  const [prefs, setPrefs] = useState<NotificationPrefs>(account.notificationPrefs);

  const isFree = account.plan === "free";

  const toggle = (group: keyof NotificationPrefs, channel: "email" | "sms") => {
    if (channel === "sms" && isFree) {
      toast.error("SMS notifications require a paid plan");
      return;
    }
    const next = {
      ...prefs,
      [group]: { ...prefs[group], [channel]: !prefs[group][channel] },
    };
    setPrefs(next);
    updatePrefs.mutate({ prefs: next });
    toast.success("Notification preferences updated");
  };

  const groups: { key: keyof NotificationPrefs; label: string; desc: string }[] = [
    { key: "eventUpdates", label: "Event updates", desc: "When an event changes or is confirmed" },
    { key: "reminders", label: "Reminders", desc: "Before a response deadline" },
    { key: "chatMessages", label: "Chat messages", desc: "New messages in event chat" },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Notification preferences"
          subtitle="Choose how you'd like to be notified"
          icon={<Bell className="size-4" />}
        />
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Type</th>
                <th className="px-4 py-2 text-center font-medium">Email</th>
                <th className="px-4 py-2 text-center font-medium">SMS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {groups.map((g) => (
                <tr key={g.key}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-card-foreground">{g.label}</p>
                    <p className="text-xs text-muted-foreground">{g.desc}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Switch
                      checked={prefs[g.key].email}
                      onCheckedChange={() => toggle(g.key, "email")}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Switch
                      checked={isFree ? false : prefs[g.key].sms}
                      onCheckedChange={() => toggle(g.key, "sms")}
                      disabled={isFree}
                    />
                    {isFree && <p className="mt-1 text-[10px] text-muted-foreground">Paid plan</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Mail className="size-3.5" />
          Preferences apply to all current and future events.
        </p>
      </Card>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-premium">{children}</div>
  );
}

function CardHeader({
  title,
  subtitle,
  icon,
  danger,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div className="mb-5 flex items-start gap-3">
      {icon && (
        <div
          className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg ${
            danger ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
          }`}
        >
          {icon}
        </div>
      )}
      <div>
        <h2 className="font-display text-lg font-semibold text-card-foreground">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

function Row({ label, value, verified }: { label: string; value: string; verified?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 pb-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2 text-sm font-medium text-card-foreground">
        {value}
        {verified && (
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            Verified
          </span>
        )}
      </span>
    </div>
  );
}
