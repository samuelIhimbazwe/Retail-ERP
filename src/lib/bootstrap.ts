"use server";

import { hash } from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ensureChartOfAccounts } from "@/lib/accounting";
import { TERMS_VERSION } from "@/lib/terms";

/** True when at least one user exists — setup wizard is locked. */
export async function isBootstrapped() {
  const count = await prisma.user.count();
  return count > 0;
}

export async function bootstrapBusiness(input: {
  businessName: string;
  currency: string;
  vatPercent: number;
  branchName: string;
  branchCode: string;
  ownerName: string;
  ownerEmail: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}) {
  if (await isBootstrapped()) {
    throw new Error("This system is already set up. Sign in instead.");
  }

  const businessName = input.businessName.trim();
  const branchName = input.branchName.trim();
  const branchCode = input.branchCode.trim().toUpperCase();
  const ownerName = input.ownerName.trim();
  const ownerEmail = input.ownerEmail.trim().toLowerCase();
  const currency = (input.currency.trim() || "RWF").toUpperCase().slice(0, 8);

  if (businessName.length < 2) throw new Error("Business name is required");
  if (branchName.length < 2) throw new Error("Branch name is required");
  if (branchCode.length < 1 || branchCode.length > 8) {
    throw new Error("Branch code must be 1–8 characters");
  }
  if (ownerName.length < 2) throw new Error("Owner name is required");
  if (!ownerEmail.includes("@")) throw new Error("Valid owner email is required");
  if (input.password.length < 8) throw new Error("Password must be at least 8 characters");
  if (input.password !== input.confirmPassword) throw new Error("Passwords do not match");
  if (!input.acceptTerms) throw new Error("You must accept the terms to continue");

  const vatRate = Math.min(1, Math.max(0, Number(input.vatPercent) / 100));
  if (Number.isNaN(vatRate)) throw new Error("Invalid VAT rate");

  const year = new Date().getFullYear();
  const passwordHash = await hash(input.password, 10);
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const business = await tx.business.create({
      data: {
        name: businessName,
        currency,
        fiscalYear: `FY ${year}`,
        vatRate,
      },
    });

    const branch = await tx.branch.create({
      data: {
        businessId: business.id,
        name: branchName,
        code: branchCode,
        isDefault: true,
      },
    });

    const owner = await tx.user.create({
      data: {
        businessId: business.id,
        branchId: branch.id,
        email: ownerEmail,
        name: ownerName,
        passwordHash,
        role: Role.OWNER,
        isActive: true,
        salaryMonthly: 0,
        termsAcceptedAt: now,
      },
    });

    await ensureChartOfAccounts(tx, business.id);

    return {
      businessId: business.id,
      businessName: business.name,
      branchId: branch.id,
      ownerEmail: owner.email,
      termsVersion: TERMS_VERSION,
    };
  });

  return { ok: true as const, ...result };
}
