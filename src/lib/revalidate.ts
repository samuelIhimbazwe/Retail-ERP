/** Works in Next.js; no-ops on the Render API process. */
export function revalidatePath(path: string, type?: "page" | "layout") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { revalidatePath: nextRevalidate } = require("next/cache") as {
      revalidatePath: (path: string, type?: "page" | "layout") => void;
    };
    nextRevalidate(path, type);
  } catch {
    /* Render API / non-Next runtime */
  }
}
