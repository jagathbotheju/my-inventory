"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "../ui/card";
import Image from "next/image";
import { socialSignIn } from "@/server/backend/actions/authActions";

interface Props {
  callbackUrl?: string;
}

const LoginForm = ({ callbackUrl }: Props) => {
  // const [isPending, startTransition] = useTransition();
  // const router = useRouter();
  // const [showPass, setShowPass] = useState(false);
  // const form = useForm<z.infer<typeof LoginSchema>>({
  //   resolver: zodResolver(LoginSchema),
  //   defaultValues: {
  //     email: "",
  //     password: "",
  //   },
  //   mode: "all",
  // });

  // const [error, setError] = useState("");
  // const [success, setSuccess] = useState("");

  // const onSubmit = (formData: z.infer<typeof LoginSchema>) => {
  //   startTransition(() => {
  //     // execute(formData);
  //     emailSignIn(formData)
  //       .then((res) => {
  //         if (res.success) {
  //           router.push("/");
  //           return toast.success(res.success);
  //         }
  //         if (res.error) {
  //           return toast.error(res.error);
  //         }
  //       })
  //       .catch((err) => {
  //         return toast.error("Invalid Credentials");
  //       });
  //   });
  // };

  return (
    <div className="flex items-center justify-center flex-col w-full ">
      <Card className="w-full md:w-[400px] dark:bg-transparent dark:border-primary/40">
        <CardHeader>
          <h1 className="mb-10 text-center bg-gradient-to-r from-orange-400 to-orange-500 bg-clip-text text-3xl font-bold text-transparent">
            Log In
          </h1>
        </CardHeader>
        <CardContent className="w-full"></CardContent>

        <CardFooter className="flex flex-col">
          <div className="flex items-center gap-x-5 mb-4">
            <div className="flex bg-slate-200 w-20 h-[0.5px]" />
            <span className="text-center text-lg">Login with Google</span>
            <div className="flex bg-slate-200 w-20 h-[0.5px]" />
          </div>
          {/* google login */}
          <Button
            type="button"
            className="w-full mb-3"
            variant="secondary"
            onClick={() =>
              socialSignIn({ social: "google", callback: callbackUrl ?? "/" })
            }
          >
            <div className="relative mr-2">
              <Image
                alt="google logo"
                src="/images/google-icon.svg"
                className="top-0 left-0 relative"
                width={20}
                height={20}
              />
            </div>
            Google
          </Button>

          {/* <Link
            href="/auth/register"
            className="text-xs hover:text-primary mt-5"
          >
            {"Don't have an Account? Create New"}
          </Link> */}
        </CardFooter>
      </Card>
    </div>
  );
};

export default LoginForm;
