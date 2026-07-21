import { getUsersManagementData } from "@/lib/actions";
import { UsersClient } from "@/components/users-client";

export default async function UsersPage() {
  const data = await getUsersManagementData();
  return <UsersClient data={data} />;
}
