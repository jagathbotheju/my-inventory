import AddProduct from "@/components/products/AddProduct";
import { auth } from "@/lib/auth";
import { User } from "@/server/db/schema/users";
import { redirect } from "next/navigation";

const AddProductPage = async () => {
  const session = await auth();
  const user = session?.user as User;
  if (!session) redirect("/auth/login");

  return (
    <div className="flex flex-col gap-10 w-full">
      <AddProduct user={user} />
    </div>
  );
};
export default AddProductPage;
