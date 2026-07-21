import Link from "next/link";
import { getNotifications } from "@/lib/actions";
import { PageHeader, Button } from "@/components/ui/primitives";
import { NotificationsFeed } from "@/components/notifications-feed";
import { Settings } from "lucide-react";

export default async function NotificationsPage() {
  const items = await getNotifications();

  return (
    <div>
      <PageHeader
        title="Notifications & Alerts"
        description="Live alerts from stock, approvals, debts, cash, and VAT. Mark read or dismiss — prefs stay on this device."
        actions={
          <Link href="/settings">
            <Button variant="secondary" size="sm">
              <Settings className="h-4 w-4" /> Settings
            </Button>
          </Link>
        }
      />
      <NotificationsFeed items={items} />
    </div>
  );
}
