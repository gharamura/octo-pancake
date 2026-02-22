import { db } from "@/lib/db";
import { coaAccounts, type CoaAccount } from "@/lib/db/schema";

export class CoaRepository {
  async findAll(): Promise<CoaAccount[]> {
    return db.select().from(coaAccounts).orderBy(coaAccounts.code);
  }
}

export const coaRepository = new CoaRepository();
