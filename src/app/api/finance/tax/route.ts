import { NextResponse } from "next/server";
import { z } from "zod";
import { requireHousehold } from "@/lib/session";
import { calculateBdTax, type TaxpayerCategory } from "@/lib/bd-tax";

const schema = z.object({
  annualIncome: z.number().min(0),
  category: z
    .enum([
      "general",
      "woman_or_senior",
      "third_gender_or_disabled",
      "freedom_fighter",
    ])
    .optional(),
  disabledDependents: z.number().int().min(0).optional(),
  isNewTaxpayer: z.boolean().optional(),
});

export async function POST(req: Request) {
  const result = await requireHousehold();
  if ("error" in result && result.error) return result.error;

  const data = schema.parse(await req.json());
  const tax = calculateBdTax({
    annualIncome: data.annualIncome,
    category: (data.category ?? "general") as TaxpayerCategory,
    disabledDependents: data.disabledDependents,
    isNewTaxpayer: data.isNewTaxpayer,
  });

  return NextResponse.json(tax);
}
