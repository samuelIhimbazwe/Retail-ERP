import { getAiContext } from "@/lib/actions";
import { AiAssistant } from "@/components/ai-assistant";

export default async function AiPage() {
  const context = await getAiContext();
  return <AiAssistant context={context} />;
}
