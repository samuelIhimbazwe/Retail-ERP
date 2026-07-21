import { getSettingsData } from "@/lib/actions";
import { SettingsForm } from "@/components/settings-form";

export default async function SettingsPage() {
  const data = await getSettingsData();
  return <SettingsForm data={data} />;
}
