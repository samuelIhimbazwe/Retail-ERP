const fs = require("fs");

const names = [
  ...fs.readFileSync("src/lib/domain-actions.ts", "utf8").matchAll(/^export async function (\w+)/gm),
].map((m) => m[1]);

const lines = [
  '"use server";',
  "",
  'import { callDomain } from "@/lib/api-rpc";',
  "",
  'export type { AppNotification, GlobalSearchHit } from "@/lib/domain-actions";',
  "",
];

for (const name of names) {
  const ret = `Awaited<ReturnType<typeof import("@/lib/domain-actions").${name}>>`;
  const params = `Parameters<typeof import("@/lib/domain-actions").${name}>`;
  lines.push(`export async function ${name}(...args: ${params}): Promise<${ret}> {`);
  lines.push(`  return (await callDomain("${name}", args)) as ${ret};`);
  lines.push(`}`);
  lines.push("");
}

fs.writeFileSync("src/lib/actions.ts", lines.join("\n"));

const boot = ['"use server";', "", 'import { callDomain } from "@/lib/api-rpc";', ""];
for (const name of ["isBootstrapped", "bootstrapBusiness"]) {
  const ret = `Awaited<ReturnType<typeof import("@/lib/domain-bootstrap").${name}>>`;
  const params = `Parameters<typeof import("@/lib/domain-bootstrap").${name}>`;
  boot.push(`export async function ${name}(...args: ${params}): Promise<${ret}> {`);
  boot.push(`  return (await callDomain("${name}", args)) as ${ret};`);
  boot.push(`}`);
  boot.push("");
}
fs.writeFileSync("src/lib/bootstrap.ts", boot.join("\n"));
console.log("wrote typed awaited proxies", names.length);
