"use server";

import { db } from "@/server/db";
import {
  BuyMonthHistory,
  buyMonthHistory,
} from "@/server/db/schema/buyMonthHistory";
import {
  BuyTransaction,
  BuyTransactionExt,
  buyTransactions,
} from "@/server/db/schema/buyTransactions";
import {
  BuyYearHistory,
  buyYearHistory,
} from "@/server/db/schema/buyYearHistory";
import { and, asc, count, desc, eq, sql, sum } from "drizzle-orm";

export const getDailyBuyTransactions = async ({
  buyDate,
  userId,
}: {
  buyDate: string;
  userId: string;
}) => {
  const transactions = await db.query.buyTransactions.findMany({
    where: and(
      eq(buyTransactions.userId, userId),
      eq(buyTransactions.date, buyDate)
    ),
    with: {
      products: true,
      suppliers: true,
    },
    orderBy: desc(buyTransactions.date),
  });
  return transactions as BuyTransactionExt[];
};

export const addBuyTransaction = async (data: BuyTransaction) => {
  try {
    const newTransaction = await db
      .insert(buyTransactions)
      .values(data)
      .returning();

    const existBuyMonthHistory = await db
      .select()
      .from(buyMonthHistory)
      .where(
        and(
          eq(buyMonthHistory.userId, data.userId),
          eq(buyMonthHistory.day, new Date(data.date).getUTCDate() + 1),
          eq(buyMonthHistory.month, new Date(data.date).getUTCMonth() + 1),
          eq(buyMonthHistory.year, new Date(data.date).getUTCFullYear())
        )
      );
    const existBuyYearHistory = await db
      .select()
      .from(buyYearHistory)
      .where(
        and(
          eq(buyYearHistory.userId, data.userId),
          eq(buyYearHistory.month, new Date(data.date).getUTCMonth() + 1),
          eq(buyYearHistory.year, new Date(data.date).getUTCFullYear())
        )
      );

    let monthHistory = [] as BuyMonthHistory[];
    let yearHistory = [] as BuyYearHistory[];

    if (existBuyMonthHistory.length) {
      monthHistory = await db
        .update(buyMonthHistory)
        .set({
          totalPrice:
            data.quantity * (data.unitPrice ?? 0) +
            (existBuyMonthHistory[0].totalPrice ?? 0),
        })
        .where(
          and(
            eq(buyMonthHistory.userId, data.userId),
            eq(buyMonthHistory.day, new Date(data.date).getUTCDate() + 1),
            eq(buyMonthHistory.month, new Date(data.date).getUTCMonth() + 1),
            eq(buyMonthHistory.year, new Date(data.date).getUTCFullYear())
          )
        )
        .returning();
    } else {
      monthHistory = await db
        .insert(buyMonthHistory)
        .values({
          day: new Date(data.date).getUTCDate() + 1,
          month: new Date(data.date).getUTCMonth() + 1,
          year: new Date(data.date).getUTCFullYear(),
          userId: data.userId,
          totalPrice: data.quantity * (data.unitPrice ?? 0),
        })
        .returning();
    }

    if (existBuyYearHistory.length) {
      yearHistory = await db
        .update(buyYearHistory)
        .set({
          totalPrice:
            data.quantity * (data.unitPrice ?? 0) +
            (existBuyYearHistory[0].totalPrice ?? 0),
        })
        .where(
          and(
            eq(buyYearHistory.userId, data.userId),
            eq(buyYearHistory.month, new Date(data.date).getUTCMonth() + 1),
            eq(buyYearHistory.year, new Date(data.date).getUTCFullYear())
          )
        )
        .returning();
    } else {
      yearHistory = await db
        .insert(buyYearHistory)
        .values({
          month: new Date(data.date).getUTCMonth() + 1,
          year: new Date(data.date).getUTCFullYear(),
          userId: data.userId,
          totalPrice: data.quantity * (data.unitPrice ?? 0),
        })
        .returning();
    }

    if (newTransaction.length && monthHistory.length && yearHistory.length) {
      return { success: "Buy Transaction added successfully" };
    }

    return { error: "Count not add Transaction" };
  } catch (error) {
    console.log(error);
    return { error: "Count not add Transaction" };
  }
};

export const getBuyTransactionsPagination = async ({
  userId,
  period,
  timeFrame,
  page,
  pageSize = 10,
}: {
  userId: string;
  period: Period;
  timeFrame: TimeFrame;
  page: number;
  pageSize?: number;
}) => {
  const year = period.year;
  const month =
    period.month.toString().length > 1 ? period.month : `0${period.month}`;

  const transactions = await db.query.buyTransactions.findMany({
    where:
      timeFrame === "month"
        ? sql`to_char(${buyTransactions.date},'MM') like ${month} and to_char(${buyTransactions.date},'YYYY') like ${year} and ${buyTransactions.userId} like ${userId}`
        : sql`to_char(${buyTransactions.date},'YYYY') like ${year} and ${buyTransactions.userId} like ${userId}`,
    with: {
      products: true,
      suppliers: true,
    },
    limit: pageSize,
    offset: (page - 1) * pageSize,
    orderBy: desc(buyTransactions.date),
  });
  return transactions as BuyTransactionExt[];
};

export const deleteBuyTransaction = async ({
  userId,
  transactionId,
}: {
  userId: string;
  transactionId: string;
}) => {
  try {
    const deletedTx = await db
      .delete(buyTransactions)
      .where(
        and(
          eq(buyTransactions.id, transactionId),
          eq(buyTransactions.userId, userId)
        )
      )
      .returning();
    console.log("deletedTx", deletedTx);

    const existBuyMonthHistory = await db
      .select()
      .from(buyMonthHistory)
      .where(
        and(
          eq(buyMonthHistory.userId, deletedTx[0].userId),
          eq(buyMonthHistory.day, new Date(deletedTx[0].date).getUTCDate() + 1),
          eq(
            buyMonthHistory.month,
            new Date(deletedTx[0].date).getUTCMonth() + 1
          ),
          eq(buyMonthHistory.year, new Date(deletedTx[0].date).getUTCFullYear())
        )
      );

    const existBuyYearHistory = await db
      .select()
      .from(buyYearHistory)
      .where(
        and(
          eq(buyYearHistory.userId, deletedTx[0].userId),
          eq(
            buyYearHistory.month,
            new Date(deletedTx[0].date).getUTCMonth() + 1
          ),
          eq(buyYearHistory.year, new Date(deletedTx[0].date).getUTCFullYear())
        )
      );

    // let monthHistory = [] as BuyMonthHistory[];
    // let yearHistory = [] as BuyYearHistory[];
    const deletedTxTotalPrice =
      deletedTx[0].quantity * (deletedTx[0].unitPrice ?? 0);
    const existMonthHistoryTotalPrice = existBuyMonthHistory[0].totalPrice ?? 0;
    const existYearHistoryTotalPrice = existBuyMonthHistory[0].totalPrice ?? 0;

    // update month history
    if (
      existBuyMonthHistory.length &&
      existMonthHistoryTotalPrice > deletedTxTotalPrice
    ) {
      await db
        .update(buyMonthHistory)
        .set({
          totalPrice: existMonthHistoryTotalPrice - deletedTxTotalPrice,
        })
        .where(
          and(
            eq(buyMonthHistory.userId, deletedTx[0].userId),
            eq(
              buyMonthHistory.day,
              new Date(deletedTx[0].date).getUTCDate() + 1
            ),
            eq(
              buyMonthHistory.month,
              new Date(deletedTx[0].date).getUTCMonth() + 1
            ),
            eq(
              buyMonthHistory.year,
              new Date(deletedTx[0].date).getUTCFullYear()
            )
          )
        )
        .returning();
    } else {
      await db
        .delete(buyMonthHistory)
        .where(
          and(
            eq(buyMonthHistory.userId, deletedTx[0].userId),
            eq(
              buyMonthHistory.day,
              new Date(deletedTx[0].date).getUTCDate() + 1
            ),
            eq(
              buyMonthHistory.month,
              new Date(deletedTx[0].date).getUTCMonth() + 1
            ),
            eq(
              buyMonthHistory.year,
              new Date(deletedTx[0].date).getUTCFullYear()
            )
          )
        )
        .returning();
    }

    // update year history
    if (
      existBuyYearHistory.length &&
      existYearHistoryTotalPrice > deletedTxTotalPrice
    ) {
      await db
        .update(buyYearHistory)
        .set({
          totalPrice: existYearHistoryTotalPrice - deletedTxTotalPrice,
        })
        .where(
          and(
            eq(buyYearHistory.userId, deletedTx[0].userId),
            eq(
              buyYearHistory.month,
              new Date(deletedTx[0].date).getUTCMonth() + 1
            ),
            eq(
              buyYearHistory.year,
              new Date(deletedTx[0].date).getUTCFullYear()
            )
          )
        )
        .returning();
    } else {
      await db
        .delete(buyYearHistory)
        .where(
          and(
            eq(buyYearHistory.userId, deletedTx[0].userId),
            eq(
              buyYearHistory.month,
              new Date(deletedTx[0].date).getUTCMonth() + 1
            ),
            eq(
              buyYearHistory.year,
              new Date(deletedTx[0].date).getUTCFullYear()
            )
          )
        )
        .returning();
    }

    if (deletedTx.length)
      return { success: "Transaction deleted successfully" };
    return { error: "Could not delete Transaction" };
  } catch (error) {
    console.log(error);
    return { error: "Could not delete Transaction" };
  }
};

export const getBuyTxYears = async () => {
  const years = await db
    .selectDistinctOn([buyYearHistory.year])
    .from(buyYearHistory)
    .orderBy(asc(buyYearHistory.year));

  return years as BuyYearHistory[];
};

export const getBuyTxCount = async ({
  userId,
  period,
  timeFrame,
}: {
  userId: string;
  period: Period;
  timeFrame: TimeFrame;
}) => {
  const year = period.year;
  const month =
    period.month.toString().length > 1 ? period.month : `0${period.month}`;

  const buyTxCount = await db
    .select({ count: count() })
    .from(buyTransactions)
    .where(
      timeFrame === "month"
        ? sql`to_char(${buyTransactions.date},'MM') like ${month} and to_char(${buyTransactions.date},'YYYY') like ${year} and ${buyTransactions.userId} like ${userId}`
        : sql`to_char(${buyTransactions.date},'YYYY') like ${year} and ${buyTransactions.userId} like ${userId}`
    );
  return buyTxCount[0];
};

export const getByTxTotalPurchase = async ({
  userId,
  period,
  timeFrame,
}: {
  userId: string;
  period: Period;
  timeFrame: TimeFrame;
}) => {
  const year = period.year;
  const month =
    period.month.toString().length > 1 ? period.month : `0${period.month}`;

  const totalPurchase = await db
    .select({
      value: sum(
        sql`${buyTransactions.quantity} * ${buyTransactions.unitPrice}`
      ),
    })
    .from(buyTransactions)
    .where(
      timeFrame === "month"
        ? sql`to_char(${buyTransactions.date},'MM') like ${month} and to_char(${buyTransactions.date},'YYYY') like ${year} and ${buyTransactions.userId} like ${userId}`
        : sql`to_char(${buyTransactions.date},'YYYY') like ${year} and ${buyTransactions.userId} like ${userId}`
    );

  return totalPurchase[0];
};
