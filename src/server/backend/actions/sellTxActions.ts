"use server";
import { db } from "@/server/db";
import {
  sellTxPaymentCheques,
  sellTxPayments,
  stocks,
} from "@/server/db/schema";
import {
  SellMonthHistory,
  sellMonthHistory,
} from "@/server/db/schema/sellMonthHistory";
import {
  SellTransaction,
  SellTransactionExt,
  sellTransactions,
} from "@/server/db/schema/sellTransactions";
import { sellTxInvoices } from "@/server/db/schema/sellTxInvoices";
import {
  SellYearHistory,
  sellYearHistory,
} from "@/server/db/schema/sellYearHistory";
import { and, count, desc, eq, gte, lte, sql, sum } from "drizzle-orm";
import _ from "lodash";

//SELL TX ADD TRANSACTION
export const addSellTransaction = async ({
  data,
  supplierId,
}: {
  data: SellTransaction;
  supplierId: string;
}) => {
  try {
    //check if transaction exist
    const existTransaction = await db
      .select()
      .from(sellTransactions)
      .where(
        and(
          eq(sellTransactions.userId, data.userId),
          eq(sellTransactions.customerId, data.customerId),
          eq(sellTransactions.supplierId, supplierId),
          eq(sellTransactions.purchasedPrice, data.purchasedPrice ?? 0),
          eq(sellTransactions.productId, data.productId),
          eq(sellTransactions.quantity, data.quantity),
          eq(sellTransactions.unitPrice, data.unitPrice ?? 0),
          eq(sellTransactions.date, data.date)
        )
      );
    if (existTransaction.length) {
      return { error: "Transaction already exist" };
    }

    const newTransaction = await db
      .insert(sellTransactions)
      .values(data)
      .returning();

    const existSellMonthHistory = await db
      .select()
      .from(sellMonthHistory)
      .where(
        and(
          eq(sellMonthHistory.userId, data.userId),
          eq(sellMonthHistory.day, new Date(data.date).getDate()),
          eq(sellMonthHistory.month, new Date(data.date).getMonth() + 1),
          eq(sellMonthHistory.year, new Date(data.date).getFullYear())
        )
      );
    const existSellYearHistory = await db
      .select()
      .from(sellYearHistory)
      .where(
        and(
          eq(sellYearHistory.userId, data.userId),
          eq(sellYearHistory.month, new Date(data.date).getMonth() + 1),
          eq(sellYearHistory.year, new Date(data.date).getFullYear())
        )
      );

    let monthHistory = [] as SellMonthHistory[];
    let yearHistory = [] as SellYearHistory[];

    if (existSellMonthHistory.length) {
      monthHistory = await db
        .update(sellMonthHistory)
        .set({
          totalPrice:
            data.quantity * (data.unitPrice ?? 0) +
            (existSellMonthHistory[0].totalPrice ?? 0),
        })
        .where(
          and(
            eq(sellMonthHistory.userId, data.userId),
            eq(sellMonthHistory.day, new Date(data.date).getDate()),
            eq(sellMonthHistory.month, new Date(data.date).getMonth() + 1),
            eq(sellMonthHistory.year, new Date(data.date).getFullYear())
          )
        )
        .returning();
    } else {
      monthHistory = await db
        .insert(sellMonthHistory)
        .values({
          day: new Date(data.date).getDate(),
          month: new Date(data.date).getMonth() + 1,
          year: new Date(data.date).getFullYear(),
          userId: data.userId,
          totalPrice: data.quantity * (data.unitPrice ?? 0),
        })
        .returning();
    }

    if (existSellYearHistory.length) {
      yearHistory = await db
        .update(sellYearHistory)
        .set({
          totalPrice:
            data.quantity * (data.unitPrice ?? 0) +
            (existSellYearHistory[0].totalPrice ?? 0),
        })
        .where(
          and(
            eq(sellYearHistory.userId, data.userId),
            eq(sellYearHistory.month, new Date(data.date).getMonth() + 1),
            eq(sellYearHistory.year, new Date(data.date).getFullYear())
          )
        )
        .returning();
    } else {
      yearHistory = await db
        .insert(sellYearHistory)
        .values({
          month: new Date(data.date).getMonth() + 1,
          year: new Date(data.date).getFullYear(),
          userId: data.userId,
          totalPrice: data.quantity * (data.unitPrice ?? 0),
        })
        .returning();
    }

    //update stock
    const existStock = await db
      .select()
      .from(stocks)
      .where(
        and(
          eq(stocks.userId, data.userId),
          eq(stocks.productId, data.productId),
          eq(stocks.supplierId, supplierId),
          eq(stocks.unitPrice, data.purchasedPrice ?? 0)
        )
      );

    const updatedStock = await db
      .update(stocks)
      .set({
        quantity: existStock[0].quantity - data.quantity,
      })
      .where(
        and(
          eq(stocks.userId, data.userId),
          eq(stocks.productId, data.productId),
          eq(stocks.supplierId, data.supplierId as string),
          eq(stocks.unitPrice, data.purchasedPrice ?? 0)
        )
      )
      .returning();

    if (
      newTransaction.length &&
      monthHistory.length &&
      yearHistory.length &&
      updatedStock.length
    ) {
      return { success: "Sell Transaction added successfully" };
    }

    return { error: "Count not add Transaction" };
  } catch (error) {
    console.log(error);
    return { error: "Count not add Transaction" };
  }
};

//SELL TX ADD TRANSACTIONS
export const addSellTransactions = async ({
  sellTxData,
  chequeData,
}: {
  sellTxData: SellTransaction[];
  chequeData:
    | {
        chequeNumber?: string | undefined;
        chequeDate?: Date | undefined;
        bankName?: string | undefined;
        amount?: number | undefined;
      }[]
    | undefined;
}) => {
  try {
    if (!sellTxData.length) return { error: "Could not add Sell Transactions" };

    let totalCash = 0;
    if (sellTxData[0].paymentMode === "cash") {
      totalCash += sellTxData[0].cacheAmount ?? 0;
    }
    if (sellTxData[0].paymentMode === "cheque") {
      chequeData?.map((cheque) => {
        totalCash += cheque.amount ?? 0;
      });
    }
    if (sellTxData[0].paymentMode === "cash-cheque") {
      chequeData?.map((cheque) => {
        totalCash += cheque.amount ?? 0;
      });
      totalCash += sellTxData[0].cacheAmount ?? 0;
    }

    // sql`${sellTransactions.quantity} * ${sellTransactions.unitPrice}`;
    const existInvoice = await db.query.sellTxInvoices.findFirst({
      where: eq(sellTxInvoices.invoiceNumber, sellTxData[0].invoiceNumber),
    });

    let invoice = [];
    if (existInvoice) {
      invoice = await db
        .update(sellTxInvoices)
        .set({
          totalCash: sql`${sellTxInvoices.totalCash} + ${totalCash}`,
        })
        .where(eq(sellTxInvoices.invoiceNumber, sellTxData[0].invoiceNumber))
        .returning();
    } else {
      invoice = await db
        .insert(sellTxInvoices)
        .values({
          userId: sellTxData[0].userId,
          invoiceNumber: sellTxData[0].invoiceNumber,
          date: sellTxData[0].date,
          totalCash,
        })
        .returning();
    }

    if (!invoice.length) return { error: "Could not add Sell Transactions" };

    const sellTxDataWithInvoiceIds = sellTxData.map((item) => ({
      ...item,
      invoiceId: invoice[0].id,
    })) as SellTransaction[];

    //new transactions
    const newTransaction = await db
      .insert(sellTransactions)
      .values(sellTxDataWithInvoiceIds)
      .returning();

    if (!newTransaction.length)
      return { error: "Could not add Sell Transactions" };

    //new payment
    const newTxPayment = await db
      .insert(sellTxPayments)
      .values({
        invoiceId: invoice[0].id,
        paymentMode: sellTxData[0].paymentMode,
        cacheAmount: sellTxData[0].cacheAmount ?? 0,
        creditAmount: sellTxData[0].creditAmount ?? 0,
      })
      .returning();

    if (!newTxPayment.length)
      return { error: "Could not add Sell Transactions" };

    if (
      (sellTxData[0].paymentMode === "cheque" ||
        sellTxData[0].paymentMode === "cash-cheque") &&
      chequeData &&
      chequeData.length
    ) {
      chequeData.map(async (cheque) => {
        await db
          .insert(sellTxPaymentCheques)
          .values({
            sellTxPaymentId: newTxPayment[0].id,
            chequeNumber: cheque.chequeNumber as string,
            bankName: cheque.bankName as string,
            amount: cheque.amount ?? 0,
            chequeDate: cheque.chequeDate?.toDateString(),
          })
          .returning();
      });
    }

    const existSellMonthHistory = await db
      .select()
      .from(sellMonthHistory)
      .where(
        and(
          eq(sellMonthHistory.userId, sellTxData[0].userId),
          eq(sellMonthHistory.day, new Date(sellTxData[0].date).getDate()),
          eq(
            sellMonthHistory.month,
            new Date(sellTxData[0].date).getMonth() + 1
          ),
          eq(sellMonthHistory.year, new Date(sellTxData[0].date).getFullYear())
        )
      );
    const existSellYearHistory = await db
      .select()
      .from(sellYearHistory)
      .where(
        and(
          eq(sellYearHistory.userId, sellTxData[0].userId),
          eq(
            sellYearHistory.month,
            new Date(sellTxData[0].date).getMonth() + 1
          ),
          eq(sellYearHistory.year, new Date(sellTxData[0].date).getFullYear())
        )
      );

    let monthHistory = [] as SellMonthHistory[];
    let yearHistory = [] as SellYearHistory[];

    if (existSellMonthHistory.length) {
      monthHistory = await db
        .update(sellMonthHistory)
        .set({
          totalPrice:
            sellTxData[0].quantity * (sellTxData[0].unitPrice ?? 0) +
            (existSellMonthHistory[0].totalPrice ?? 0),
        })
        .where(
          and(
            eq(sellMonthHistory.userId, sellTxData[0].userId),
            eq(sellMonthHistory.day, new Date(sellTxData[0].date).getDate()),
            eq(
              sellMonthHistory.month,
              new Date(sellTxData[0].date).getMonth() + 1
            ),
            eq(
              sellMonthHistory.year,
              new Date(sellTxData[0].date).getFullYear()
            )
          )
        )
        .returning();
    } else {
      monthHistory = await db
        .insert(sellMonthHistory)
        .values({
          day: new Date(sellTxData[0].date).getDate(),
          month: new Date(sellTxData[0].date).getMonth() + 1,
          year: new Date(sellTxData[0].date).getFullYear(),
          userId: sellTxData[0].userId,
          totalPrice: sellTxData[0].quantity * (sellTxData[0].unitPrice ?? 0),
        })
        .returning();
    }

    if (existSellYearHistory.length) {
      yearHistory = await db
        .update(sellYearHistory)
        .set({
          totalPrice:
            sellTxData[0].quantity * (sellTxData[0].unitPrice ?? 0) +
            (existSellYearHistory[0].totalPrice ?? 0),
        })
        .where(
          and(
            eq(sellYearHistory.userId, sellTxData[0].userId),
            eq(
              sellYearHistory.month,
              new Date(sellTxData[0].date).getMonth() + 1
            ),
            eq(sellYearHistory.year, new Date(sellTxData[0].date).getFullYear())
          )
        )
        .returning();
    } else {
      yearHistory = await db
        .insert(sellYearHistory)
        .values({
          month: new Date(sellTxData[0].date).getMonth() + 1,
          year: new Date(sellTxData[0].date).getFullYear(),
          userId: sellTxData[0].userId,
          totalPrice: sellTxData[0].quantity * (sellTxData[0].unitPrice ?? 0),
        })
        .returning();
    }

    //update stock
    // const updatedStock = [] as Stock[];
    sellTxData.map(async (item) => {
      const existStock = await db
        .select()
        .from(stocks)
        .where(
          and(
            eq(stocks.userId, item.userId),
            eq(stocks.productId, item.productId),
            eq(stocks.supplierId, item.supplierId as string),
            eq(stocks.unitPrice, item.purchasedPrice ?? 0)
          )
        );

      await db
        .update(stocks)
        .set({
          quantity: existStock[0].quantity - item.quantity,
        })
        .where(
          and(
            eq(stocks.userId, item.userId),
            eq(stocks.productId, item.productId),
            eq(stocks.supplierId, item.supplierId as string),
            eq(stocks.unitPrice, item.purchasedPrice ?? 0)
          )
        )
        .returning();
    });

    if (
      newTransaction.length &&
      monthHistory.length &&
      yearHistory.length
      // updatedStock.length
    ) {
      return { success: "Sell Transaction added successfully" };
    }

    return { error: "Count not add Transaction" };
  } catch (error) {
    console.log(error);
    return { error: "Count not add Transaction" };
  }
};

//Delete SellTx
export const deleteSellTransaction = async ({
  userId,
  sellTx,
}: {
  userId: string;
  sellTx: SellTransactionExt;
}) => {
  try {
    const deletedTx = await db
      .delete(sellTransactions)
      .where(
        and(
          eq(sellTransactions.id, sellTx.id),
          eq(sellTransactions.userId, userId)
        )
      )
      .returning();

    if (!deletedTx.length) return { error: "Could not Delete Transaction" };

    //remove invoice if no txs
    const existSellTxs = await db
      .select()
      .from(sellTransactions)
      .where(
        and(
          eq(sellTransactions.userId, userId),
          eq(sellTransactions.invoiceId, deletedTx[0].invoiceId as string)
        )
      );

    if (!existSellTxs.length) {
      await db
        .delete(sellTxInvoices)
        .where(
          and(
            and(
              eq(sellTxInvoices.userId, userId),
              eq(sellTxInvoices.id, deletedTx[0].invoiceId as string)
            )
          )
        );
    }

    //updating history data
    const existSellMonthHistory = await db
      .select()
      .from(sellMonthHistory)
      .where(
        and(
          eq(sellMonthHistory.userId, deletedTx[0]?.userId),
          eq(sellMonthHistory.day, new Date(deletedTx[0].date).getDate()),
          eq(
            sellMonthHistory.month,
            new Date(deletedTx[0].date).getMonth() + 1
          ),
          eq(sellMonthHistory.year, new Date(deletedTx[0].date).getFullYear())
        )
      );

    const existSellYearHistory = await db
      .select()
      .from(sellYearHistory)
      .where(
        and(
          eq(sellYearHistory.userId, deletedTx[0].userId),
          eq(sellYearHistory.month, new Date(deletedTx[0].date).getMonth() + 1),
          eq(sellYearHistory.year, new Date(deletedTx[0].date).getFullYear())
        )
      );

    // let monthHistory = [] as SellMonthHistory[];
    // let yearHistory = [] as SellYearHistory[];
    const deletedTxTotalPrice =
      deletedTx[0].quantity * (deletedTx[0].unitPrice ?? 0);
    const existMonthHistoryTotalPrice =
      existSellMonthHistory[0]?.totalPrice ?? 0;
    const existYearHistoryTotalPrice = existSellMonthHistory[0].totalPrice ?? 0;

    // update month history
    if (
      existSellMonthHistory.length &&
      existMonthHistoryTotalPrice > deletedTxTotalPrice
    ) {
      await db
        .update(sellMonthHistory)
        .set({
          totalPrice: existMonthHistoryTotalPrice - deletedTxTotalPrice,
        })
        .where(
          and(
            eq(sellMonthHistory.userId, deletedTx[0].userId),
            eq(sellMonthHistory.day, new Date(deletedTx[0].date).getDate()),
            eq(
              sellMonthHistory.month,
              new Date(deletedTx[0].date).getMonth() + 1
            ),
            eq(sellMonthHistory.year, new Date(deletedTx[0].date).getFullYear())
          )
        )
        .returning();
    } else {
      await db
        .delete(sellMonthHistory)
        .where(
          and(
            eq(sellMonthHistory.userId, deletedTx[0].userId),
            eq(sellMonthHistory.day, new Date(deletedTx[0].date).getDate()),
            eq(
              sellMonthHistory.month,
              new Date(deletedTx[0].date).getMonth() + 1
            ),
            eq(sellMonthHistory.year, new Date(deletedTx[0].date).getFullYear())
          )
        )
        .returning();
    }

    // update year history
    if (
      existSellYearHistory.length &&
      existYearHistoryTotalPrice > deletedTxTotalPrice
    ) {
      await db
        .update(sellYearHistory)
        .set({
          totalPrice: existYearHistoryTotalPrice - deletedTxTotalPrice,
        })
        .where(
          and(
            eq(sellYearHistory.userId, deletedTx[0].userId),
            eq(
              sellYearHistory.month,
              new Date(deletedTx[0].date).getMonth() + 1
            ),
            eq(sellYearHistory.year, new Date(deletedTx[0].date).getFullYear())
          )
        )
        .returning();
    } else {
      await db
        .delete(sellYearHistory)
        .where(
          and(
            eq(sellYearHistory.userId, deletedTx[0].userId),
            eq(
              sellYearHistory.month,
              new Date(deletedTx[0].date).getMonth() + 1
            ),
            eq(sellYearHistory.year, new Date(deletedTx[0].date).getFullYear())
          )
        )
        .returning();
    }

    //update stocks
    const existStock = await db
      .select()
      .from(stocks)
      .where(
        and(
          eq(stocks.userId, userId),
          eq(stocks.supplierId, sellTx.supplierId as string),
          eq(stocks.productId, sellTx.productId),
          eq(stocks.unitPrice, sellTx.purchasedPrice ?? 0)
        )
      );

    const updatedStock = await db
      .update(stocks)
      .set({
        quantity: existStock[0].quantity + sellTx.quantity,
      })
      .where(
        and(
          eq(stocks.userId, sellTx.userId),
          eq(stocks.productId, sellTx.productId),
          eq(stocks.supplierId, sellTx.supplierId as string),
          eq(stocks.unitPrice, sellTx.purchasedPrice ?? 0)
        )
      )
      .returning();

    //update sellTxPayments
    // await db
    //   .delete(sellTxPayments)
    //   .where(
    //     and(
    //       eq(sellTxPayments.userId, userId),
    //       eq(sellTxPayments.invoiceNumber, sellTx.invoiceNumber)
    //     )
    //   )
    //   .returning();
    // await db
    //   .delete(sellTxCheques)
    //   .where(
    //     and(
    //       eq(sellTxCheques.userId, userId),
    //       eq(sellTxCheques.invoiceNumber, sellTx.invoiceNumber)
    //     )
    //   )
    //   .returning();

    if (deletedTx.length && updatedStock.length)
      return { success: "Transaction deleted successfully" };
    return { error: "Could not delete Transaction" };
  } catch (error) {
    console.log(error);
    return { error: "Could not delete Transaction" };
  }
};

//SellTx Pagination
export const getSellTransactionsPagination = async ({
  userId,
  period,
  timeFrame,
  page,
  pageSize = 10,
  searchTerm,
}: {
  userId: string;
  period: Period;
  timeFrame: TimeFrame;
  page: number;
  pageSize?: number;
  searchTerm: string;
}) => {
  // const transactions = await db.query.sellTransactions.findMany({
  //   where: eq(sellTransactions.userId, userId),
  //   with: {
  //     products: true,
  //     customers: true,
  //   },
  //   orderBy: desc(sellTransactions.date),
  // });

  const year = period.year;
  const month =
    period.month.toString().length > 1 ? period.month : `0${period.month}`;
  const fSearch = `%${searchTerm}%`;

  if (searchTerm.length) {
    const transactions = await db.query.sellTransactions.findMany({
      where: sql`${sellTransactions.userId} like ${userId} and ${sellTransactions.invoiceNumber} ilike ${fSearch}`,
      with: {
        products: true,
        customers: true,
      },
      orderBy: desc(sellTransactions.date),
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return transactions as SellTransactionExt[];
  } else {
    const transactions = await db.query.sellTransactions.findMany({
      where:
        timeFrame === "month"
          ? sql`to_char(${sellTransactions.date},'MM') like ${month} and to_char(${sellTransactions.date},'YYYY') like ${year} and ${sellTransactions.userId} like ${userId}`
          : sql`to_char(${sellTransactions.date},'YYYY') like ${year} and ${sellTransactions.userId} like ${userId}`,
      with: {
        products: true,
        customers: true,
      },
      orderBy: desc(sellTransactions.date),
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return transactions as SellTransactionExt[];
  }
};

//SellTx Count
export const getSellTxCount = async ({
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

  const sellTxCount = await db
    .select({ count: count() })
    .from(sellTransactions)
    .where(
      timeFrame === "month"
        ? sql`to_char(${sellTransactions.date},'MM') like ${month} and to_char(${sellTransactions.date},'YYYY') like ${year} and ${sellTransactions.userId} like ${userId}`
        : sql`to_char(${sellTransactions.date},'YYYY') like ${year} and ${sellTransactions.userId} like ${userId}`
    );
  return sellTxCount[0];
};

//SellTx TotalCount
export const getSellTxTotalSales = async ({
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

  const totalSales = await db
    .select({
      value: sum(
        sql`${sellTransactions.quantity} * ${sellTransactions.unitPrice}`
      ),
    })
    .from(sellTransactions)
    .where(
      timeFrame === "month"
        ? sql`to_char(${sellTransactions.date},'MM') like ${month} and to_char(${sellTransactions.date},'YYYY') like ${year} and ${sellTransactions.userId} like ${userId}`
        : sql`to_char(${sellTransactions.date},'YYYY') like ${year} and ${sellTransactions.userId} like ${userId}`
    );

  return totalSales[0];
};

//Daily SellTx
export const getDailySellTransactions = async ({
  sellDate,
  userId,
}: {
  sellDate: string;
  userId: string;
}) => {
  const transactions = await db.query.sellTransactions.findMany({
    where: and(
      eq(sellTransactions.userId, userId),
      eq(sellTransactions.date, sellDate)
    ),
    with: {
      products: true,
      customers: true,
    },
    orderBy: desc(sellTransactions.date),
  });
  return transactions as SellTransactionExt[];
};

//SellTx User Product
export const getSellTxByUserProduct = async ({
  userId,
  productId,
}: {
  userId: string;
  productId: string;
}) => {
  const transactions = await db.query.sellTransactions.findMany({
    where: and(
      eq(sellTransactions.userId, userId),
      eq(sellTransactions.productId, productId)
    ),
    with: {
      products: {
        with: {
          unitOfMeasurements: true,
        },
      },
    },
    orderBy: desc(sellTransactions.date),
  });
  return transactions as SellTransactionExt[];
};

//SellTx User Period
export const getSellTxByUserByPeriod = async ({
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

  const transactions = await db.query.sellTransactions.findMany({
    where:
      timeFrame === "month"
        ? sql`to_char(${sellTransactions.date},'MM') like ${month} and to_char(${sellTransactions.date},'YYYY') like ${year} and ${sellTransactions.userId} like ${userId}`
        : sql`to_char(${sellTransactions.date},'YYYY') like ${year} and ${sellTransactions.userId} like ${userId}`,
    with: {
      products: {
        with: {
          unitOfMeasurements: true,
          // suppliers: true,
        },
      },
      sellTxInvoices: {
        with: {
          sellTxPayments: true,
        },
      },
      customers: true,
    },
  });

  return transactions as SellTransactionExt[];
};

//SellTx between dates
export const getSellTxDateRange = async ({
  userId,
  from,
  to,
}: {
  userId: string;
  from: Date;
  to: Date;
}) => {
  const sellTxs = await db.query.sellTransactions.findMany({
    where: and(
      eq(sellTransactions.userId, userId),
      gte(sellTransactions.date, from.toDateString()),
      lte(sellTransactions.date, to.toDateString())
    ),
    with: {
      products: {
        with: {
          unitOfMeasurements: true,
          // suppliers: true,
        },
      },
      sellTxInvoices: {
        with: {
          sellTxPayments: true,
        },
      },
      customers: true,
    },
  });

  const sortedBuyTxs = _.sortBy(sellTxs, "customers.name", "date");
  const groupedBuyTxs = _.groupBy(sortedBuyTxs, "customers.name");

  return groupedBuyTxs;
};
