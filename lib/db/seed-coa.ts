import { db } from "./index";
import { coaAccounts, type NewCoaAccount } from "./schema";

const accounts: NewCoaAccount[] = [
  // ---------------------------------------------------------------------------
  // Income
  // ---------------------------------------------------------------------------
  { code: "1000", parentCode: null, name: "income", type: "income" },
  { code: "1010", parentCode: "1000", name: "salary", type: "income" },
  { code: "1020", parentCode: "1000", name: "bonus", type: "income" },
  { code: "1030", parentCode: "1000", name: "rental", type: "income" },
  { code: "1040", parentCode: "1000", name: "reimbursement", type: "income" },
  { code: "1050", parentCode: "1000", name: "benefits", type: "income" },
  { code: "1060", parentCode: "1000", name: "financial", type: "income" },
  { code: "1080", parentCode: "1000", name: "other", type: "income" },

  // ---------------------------------------------------------------------------
  // Expenses — main living
  // ---------------------------------------------------------------------------
  { code: "2000", parentCode: null, name: "expenses", type: "expense" },

  // Housing
  { code: "2100", parentCode: "2000", name: "housing", type: "expense" },
  { code: "2110", parentCode: "2100", name: "condominium", type: "expense" },
  { code: "2120", parentCode: "2100", name: "maintenance", type: "expense" },
  { code: "2130", parentCode: "2100", name: "supplies", type: "expense" },
  { code: "2140", parentCode: "2100", name: "cleaning", type: "expense" },
  { code: "2150", parentCode: "2100", name: "home decor & furnishings", type: "expense" },
  { code: "2160", parentCode: "2100", name: "loan", type: "liability" },

  // Utilities
  { code: "2200", parentCode: "2000", name: "utilities", type: "expense" },
  { code: "2210", parentCode: "2200", name: "natural gas", type: "expense" },
  { code: "2220", parentCode: "2200", name: "communication", type: "expense" },
  { code: "2230", parentCode: "2200", name: "power", type: "expense" },

  // Transportation
  { code: "2300", parentCode: "2000", name: "transportation", type: "expense" },
  { code: "2310", parentCode: "2300", name: "fuel", type: "expense" },
  { code: "2320", parentCode: "2300", name: "maintenance", type: "expense" },
  { code: "2340", parentCode: "2300", name: "parking & tolls", type: "expense" },
  { code: "2350", parentCode: "2300", name: "uber & taxi", type: "expense" },
  { code: "2360", parentCode: "2300", name: "school", type: "expense" },
  { code: "2370", parentCode: "2300", name: "fines", type: "expense" },
  { code: "2380", parentCode: "2300", name: "cleaning", type: "expense" },
  { code: "2390", parentCode: "2300", name: "insurance", type: "expense" },

  // Food
  { code: "2400", parentCode: "2000", name: "food", type: "expense" },
  { code: "2410", parentCode: "2400", name: "lunch", type: "expense" },
  { code: "2420", parentCode: "2400", name: "dinner, snacks", type: "expense" },

  // Education
  { code: "2500", parentCode: "2000", name: "education", type: "expense" },
  { code: "2510", parentCode: "2500", name: "school", type: "expense" },
  { code: "2511", parentCode: "2500", name: "supplies", type: "expense" },
  { code: "2520", parentCode: "2500", name: "language courses", type: "expense" },
  { code: "2530", parentCode: "2500", name: "books", type: "expense" },
  { code: "2540", parentCode: "2500", name: "uniform", type: "expense" },
  { code: "2550", parentCode: "2500", name: "other courses", type: "expense" },

  // Health
  { code: "2600", parentCode: "2000", name: "health", type: "expense" },
  { code: "2610", parentCode: "2600", name: "dentist", type: "expense" },
  { code: "2620", parentCode: "2600", name: "doctors", type: "expense" },
  { code: "2630", parentCode: "2600", name: "medications", type: "expense" },
  { code: "2640", parentCode: "2600", name: "glasses", type: "expense" },
  { code: "2650", parentCode: "2600", name: "insurance", type: "expense" },

  // Entertainment
  { code: "2700", parentCode: "2000", name: "entertainment", type: "expense" },
  { code: "2710", parentCode: "2700", name: "cinema", type: "expense" },
  { code: "2720", parentCode: "2700", name: "streaming", type: "expense" },
  { code: "2730", parentCode: "2700", name: "videogames", type: "expense" },
  { code: "2740", parentCode: "2700", name: "travel", type: "expense" },
  { code: "2750", parentCode: "2700", name: "puzzles", type: "expense" },
  { code: "2760", parentCode: "2700", name: "activities", type: "expense" },
  { code: "2770", parentCode: "2700", name: "swimming", type: "expense" },

  // Personal Care
  { code: "2800", parentCode: "2000", name: "personal care", type: "expense" },
  { code: "2810", parentCode: "2800", name: "gym", type: "expense" },
  { code: "2820", parentCode: "2800", name: "clothing", type: "expense" },
  { code: "2830", parentCode: "2800", name: "gifts", type: "expense" },
  { code: "2840", parentCode: "2800", name: "haircut", type: "expense" },
  { code: "2850", parentCode: "2800", name: "celebrations", type: "expense" },
  { code: "2860", parentCode: "2800", name: "cosmetics", type: "expense" },

  // ---------------------------------------------------------------------------
  // Transfers (equity)
  // ---------------------------------------------------------------------------
  { code: "3000", parentCode: null, name: "transfers", type: "equity" },
  { code: "3110", parentCode: "3000", name: "transfers", type: "equity" },
  { code: "3120", parentCode: "3000", name: "exchange", type: "equity" },

  // ---------------------------------------------------------------------------
  // Savings (asset / liability mix)
  // ---------------------------------------------------------------------------
  { code: "4000", parentCode: null, name: "savings", type: "asset" },
  { code: "4110", parentCode: "4000", name: "out", type: "liability" },
  { code: "4210", parentCode: "4000", name: "in", type: "asset" },
  { code: "4220", parentCode: "4000", name: "pension", type: "asset" },
  { code: "4230", parentCode: "4000", name: "other savings", type: "asset" },

  // ---------------------------------------------------------------------------
  // Work expenses
  // ---------------------------------------------------------------------------
  { code: "8000", parentCode: null, name: "work", type: "expense" },
  { code: "8100", parentCode: "8000", name: "accounting", type: "expense" },
  { code: "8200", parentCode: "8000", name: "apps", type: "expense" },
  { code: "8300", parentCode: "8000", name: "association", type: "expense" },

  // ---------------------------------------------------------------------------
  // Financial expenses
  // ---------------------------------------------------------------------------
  { code: "9000", parentCode: null, name: "financial expenses", type: "expense" },

  // Taxes / duty
  { code: "9200", parentCode: "9000", name: "duty", type: "expense" },
  { code: "9220", parentCode: "9200", name: "simples", type: "expense" },
  { code: "9230", parentCode: "9200", name: "other taxes", type: "expense" },
  { code: "9240", parentCode: "9200", name: "irrf", type: "expense" },
  { code: "9250", parentCode: "9200", name: "iof", type: "expense" },
  { code: "9255", parentCode: "9200", name: "inss", type: "expense" },
  { code: "9260", parentCode: "9200", name: "ipva", type: "expense" },
  { code: "9270", parentCode: "9200", name: "iptu", type: "expense" },

  // Banking
  { code: "9300", parentCode: "9000", name: "banking expenses", type: "expense" },
  { code: "9310", parentCode: "9300", name: "taxes", type: "expense" },
  { code: "9320", parentCode: "9300", name: "mortgage", type: "expense" },

  // ---------------------------------------------------------------------------
  // Other
  // ---------------------------------------------------------------------------
  { code: "9900", parentCode: null, name: "other", type: "expense" },
  { code: "9910", parentCode: "9900", name: "reimbursable expenses", type: "expense" },
  { code: "9911", parentCode: "9900", name: "other expenses", type: "expense" },
];

async function seed() {
  await db.insert(coaAccounts).values(accounts).onConflictDoNothing();
  console.log(`Seeded ${accounts.length} COA accounts.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
