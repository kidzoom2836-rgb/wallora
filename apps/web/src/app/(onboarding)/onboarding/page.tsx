"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Link from "next/link";

const interests = [
  "Nature", "Technology", "Cars", "Anime-inspired original art", "Gaming",
  "Architecture", "Minimalism", "Luxury", "Abstract", "Photography",
  "Fashion", "Interior design", "Digital illustration",
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (i: string) =>
    setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {step === 0 ? "Welcome to WALLORA" : step === 1 ? "Pick your interests" : "You're all set"}
        </CardTitle>
        <CardDescription>
          {step === 0 && "Let's set up your creative profile."}
          {step === 1 && "Choose categories you love. We'll personalize your feed."}
          {step === 2 && "Onboarding completes in Phase 2 with persistence."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {step === 0 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" placeholder="yourname" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input id="displayName" placeholder="Your name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="device">Device type</Label>
              <select id="device" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                <option>Android phone</option>
                <option>Tablet</option>
                <option>Desktop</option>
              </select>
            </div>
          </div>
        )}
        {step === 1 && (
          <div className="flex flex-wrap gap-2">
            {interests.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => toggle(i)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  selected.includes(i)
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {i}
              </button>
            ))}
          </div>
        )}
        {step === 2 && (
          <p className="text-sm text-muted-foreground">
            Preferences will be saved to your profile in Phase 2.
          </p>
        )}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            Back
          </Button>
          {step < 2 ? (
            <Button onClick={() => setStep((s) => s + 1)}>Continue</Button>
          ) : (
            <Button render={<Link href="/dashboard" />}>Enter WALLORA</Button>
          )}
        </div>
        <button
          type="button"
          onClick={() => toast.info("Skipped (optional step)")}
          className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          Skip
        </button>
      </CardContent>
    </Card>
  );
}