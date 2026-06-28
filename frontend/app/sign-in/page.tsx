"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import Image from "next/image";

const OAUTH_ERRORS: Record<string, string> = {
  generic: "Unable to sign in with GitHub. Please try again.",
  no_account: "No GitHub account found. Please sign in to a valid GitHub account.",
  rate_limited: "Too many attempts. Please wait a moment and try again.",
  expired: "Your session has expired. Please sign in again.",
};

function SignInContent() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error");
  const errorMessage = errorCode ? OAUTH_ERRORS[errorCode] || OAUTH_ERRORS.generic : null;

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="p-8 flex flex-col items-center">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">RepoEval</h1>
          </div>
          <p className="text-[28px] font-semibold leading-tight text-center mb-8">
            AI-powered project evaluation reports in minutes
          </p>
          <Button
            className="w-full h-11"
            onClick={() => {
              window.location.href = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/auth/login`;
            }}
          >
            <Image
              src="/github-mark.svg"
              alt="GitHub"
              width={24}
              height={24}
              className="mr-3"
            />
            Sign in with GitHub
          </Button>
          {errorMessage && (
            <div className="mt-4 w-full text-sm text-destructive bg-destructive/10 rounded-md p-3 text-center">
              {errorMessage}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInContent />
    </Suspense>
  );
}
