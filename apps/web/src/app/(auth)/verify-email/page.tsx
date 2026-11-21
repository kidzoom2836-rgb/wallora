import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function VerifyEmailPage() {
  return (
    <Card className="w-full max-w-md text-center">
      <CardHeader>
        <CardTitle>Verify your email</CardTitle>
        <CardDescription>Check your inbox for a verification link.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Email verification is wired up in Phase 2. For now this is a preview screen.
        </p>
        <Button nativeButton={false} render={<Link href="/login" />}>Continue to sign in</Button>
      </CardContent>
    </Card>
  );
}