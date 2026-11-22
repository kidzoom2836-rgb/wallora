"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const schema = z
  .object({
    displayName: z.string().min(2, "Display name is required"),
    username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, underscores only"),
    email: z.string().email("Enter a valid email"),
    password: z.string().min(8, "At least 8 characters"),
    confirm: z.string(),
    terms: z.boolean().refine((v) => v, "You must accept the terms"),
  })
  .refine((d) => d.password === d.confirm, { message: "Passwords do not match", path: ["confirm"] });

type Values = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: "", username: "", email: "", password: "", confirm: "", terms: false },
  });

  const onSubmit = async (values: Values) => {
    const { error } = await authClient.signUp.email({
      email: values.email,
      password: values.password,
      name: values.displayName,
      // @ts-expect-error extra fields
      username: values.username,
    });
    if (error) {
      toast.error(error.message ?? "Registration failed");
      return;
    }
    toast.success("Account created");
    router.push("/onboarding");
    router.refresh();
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>Join WALLORA and start creating.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input id="displayName" {...form.register("displayName")} />
            {form.formState.errors.displayName && <p className="text-xs text-destructive">{form.formState.errors.displayName.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" {...form.register("username")} />
            {form.formState.errors.username && <p className="text-xs text-destructive">{form.formState.errors.username.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...form.register("email")} />
            {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" {...form.register("password")} />
            {form.formState.errors.password && <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input id="confirm" type="password" {...form.register("confirm")} />
            {form.formState.errors.confirm && <p className="text-xs text-destructive">{form.formState.errors.confirm.message}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="terms"
              checked={form.watch("terms")}
              onCheckedChange={(v) => form.setValue("terms", v === true, { shouldValidate: true })}
            />
            <Label htmlFor="terms" className="text-sm text-muted-foreground">
              I accept the Terms and Privacy Policy
            </Label>
          </div>
          {form.formState.errors.terms && <p className="text-xs text-destructive">{form.formState.errors.terms.message}</p>}
          <Button type="submit" className="w-full">Create account</Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">Sign in</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}