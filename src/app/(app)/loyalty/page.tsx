import { getLoyaltyData } from "@/lib/actions";
import { LoyaltyClient } from "@/components/loyalty-client";

export default async function LoyaltyPage() {
  const data = await getLoyaltyData();
  return (
    <LoyaltyClient
      data={{
        memberCount: data.memberCount,
        pointsIssued: data.pointsIssued,
        redeemableValue: data.redeemableValue,
        membersWithPoints: data.membersWithPoints,
        tiers: data.tiers,
        members: data.members,
        rules: data.rules,
      }}
    />
  );
}
