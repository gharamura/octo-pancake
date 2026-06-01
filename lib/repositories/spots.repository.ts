import { db } from "@/lib/db";
import { cashFlowSpots, type CashFlowSpot, type NewCashFlowSpot } from "@/lib/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";

class SpotsRepository {
  async findByMonth(year: number, month: number): Promise<CashFlowSpot[]> {
    return db
      .select()
      .from(cashFlowSpots)
      .where(and(eq(cashFlowSpots.year, year), eq(cashFlowSpots.month, month)))
      .orderBy(cashFlowSpots.dayOfMonth);
  }

  async findById(id: string): Promise<CashFlowSpot | undefined> {
    const [row] = await db.select().from(cashFlowSpots).where(eq(cashFlowSpots.id, id));
    return row;
  }

  async create(data: NewCashFlowSpot): Promise<CashFlowSpot> {
    const [row] = await db.insert(cashFlowSpots).values(data).returning();
    return row;
  }

  async delete(id: string): Promise<void> {
    const spot = await this.findById(id);
    if (spot?.pairId) {
      await db.delete(cashFlowSpots).where(eq(cashFlowSpots.pairId, spot.pairId));
    } else {
      await db.delete(cashFlowSpots).where(eq(cashFlowSpots.id, id));
    }
  }
}

export const spotsRepository = new SpotsRepository();
