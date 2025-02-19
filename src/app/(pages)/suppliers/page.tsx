import Suppliers from "@/components/suppliers/Suppliers";
import { auth } from "@/lib/auth";
import { User } from "@/server/db/schema/users";
import { redirect } from "next/navigation";

const SuppliersPage = async () => {
  const session = await auth();
  const user = session?.user as User;
  if (!session) redirect("/auth/login");

  return (
    <div className="flex flex-col gap-10 w-full">
      <Suppliers user={user} />
    </div>
  );
};
export default SuppliersPage;
