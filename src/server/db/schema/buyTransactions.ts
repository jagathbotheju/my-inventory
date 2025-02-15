import { InferSelectModel, relations } from "drizzle-orm";
import {
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { ProductExt, products } from "./products";
import { Supplier, suppliers } from "./suppliers";
// import { productBuyTransactions } from "./productBuyTransactions";

export const buyTransactions = pgTable("buy_transactions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  supplierId: text("supplier_id")
    .references(() => suppliers.id)
    .notNull(),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  quantity: integer("quantity").notNull(),
  unitPrice: doublePrecision("unit_price").default(0),
  date: timestamp("date", { mode: "string" }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
});

export const buyTransactionRelations = relations(
  buyTransactions,
  ({ one }) => ({
    users: one(users, {
      fields: [buyTransactions.userId],
      references: [users.id],
    }),
    suppliers: one(suppliers, {
      fields: [buyTransactions.supplierId],
      references: [suppliers.id],
    }),
    products: one(products, {
      fields: [buyTransactions.productId],
      references: [products.id],
    }),
    // productBuyTransactions: many(productBuyTransactions),
  })
);

export type BuyTransaction = InferSelectModel<typeof buyTransactions>;
export type BuyTransactionExt = InferSelectModel<typeof buyTransactions> & {
  products: ProductExt;
  suppliers: Supplier;
};
