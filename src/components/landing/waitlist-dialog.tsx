"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, CheckCircle2, Sparkles, AlertCircle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useWaitlistDialog, type WaitlistIntent } from "@/stores/waitlist";

const INTENT_OPTIONS: { value: WaitlistIntent; label: string; hint: string }[] = [
  { value: "general", label: "Keep me posted", hint: "General updates" },
  { value: "explorer", label: "I want to explore", hint: "Discovery & collections" },
  { value: "studio", label: "I want to create", hint: "AI Studio early access" },
  { value: "creator", label: "I want to sell", hint: "Founding creator program" },
];

const FormSchema = z.object({
  name: z
    .string()
    .trim()
    .max(80, { message: "Name is too long" })
    .optional(),
  email: z
    .string()
    .trim()
    .min(5, { message: "Email is required" })
    .email({ message: "Enter a valid email address" }),
  intent: z.enum(["general", "explorer", "studio", "creator"]),
  prompt: z
    .string()
    .trim()
    .max(2000, { message: "Prompt is too long" })
    .optional(),
  message: z
    .string()
    .trim()
    .max(2000, { message: "Message is too long" })
    .optional(),
});

type FormValues = z.infer<typeof FormSchema>;

type SubmitState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success" }
  | { status: "error"; message: string };

export function WaitlistDialog() {
  const { open, intent, prompt, setOpen } = useWaitlistDialog();
  const [submitState, setSubmitState] = React.useState<SubmitState>({ status: "idle" });

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: "",
      email: "",
      intent: "studio",
      prompt: "",
      message: "",
    },
  });

  // Sync store intent + prompt into the form whenever the dialog opens.
  React.useEffect(() => {
    if (open) {
      setSubmitState({ status: "idle" });
      form.reset({
        name: "",
        email: "",
        intent,
        prompt: prompt || "",
        message: "",
      });
    }
  }, [open, intent, prompt, form]);

  const onSubmit = async (values: FormValues) => {
    setSubmitState({ status: "loading" });
    try {
      // Normalize empty optional strings to null for the backend.
      const payload = {
        email: values.email.trim().toLowerCase(),
        name: values.name?.trim() || undefined,
        intent: values.intent,
        prompt: values.prompt?.trim() || undefined,
        message: values.message?.trim() || undefined,
      };
      const res = await fetch("/api/v1/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();

      if (res.status === 201) {
        setSubmitState({ status: "success" });
        return;
      }
      if (res.status === 409) {
        // Treat as soft success — they are already on the list.
        setSubmitState({ status: "success" });
        return;
      }
      const message =
        body?.error?.message ?? "Something went wrong. Please try again.";
      setSubmitState({ status: "error", message });
    } catch {
      setSubmitState({
        status: "error",
        message: "Network error. Please check your connection and try again.",
      });
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      // Delay reset so the close transition is smooth.
      setTimeout(() => setSubmitState({ status: "idle" }), 200);
    }
  };

  const isDisabled = submitState.status === "loading" || submitState.status === "success";

  const intentValue = useWatch({ control: form.control, name: "intent" });
  const promptValue = useWatch({ control: form.control, name: "prompt" });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-border bg-background sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <Badge
              variant="outline"
              className="border-primary/30 bg-primary/10 text-[10px] text-primary"
            >
              Early access
            </Badge>
          </div>
          <DialogTitle className="font-display text-xl">
            {submitState.status === "success"
              ? "You are on the list"
              : "Join the WALLORA waitlist"}
          </DialogTitle>
          <DialogDescription className="text-secondary-text">
            {submitState.status === "success"
              ? "We will reach out the moment early access opens. Founding members get priority onboarding."
              : "Be first to access WALLORA AI Studio, the creator program and the marketplace as each phase ships."}
          </DialogDescription>
        </DialogHeader>

        {submitState.status === "success" ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <p className="text-sm text-foreground">
              Thank you. Your spot is reserved.
            </p>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => handleOpenChange(false)}
            >
              Continue exploring
            </Button>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="wl-name" className="text-xs font-medium text-secondary-text">
                Name <span className="text-secondary-text/60">(optional)</span>
              </Label>
              <Input
                id="wl-name"
                placeholder="Your name"
                autoComplete="name"
                className="border-border bg-surface"
                {...form.register("name")}
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="wl-email" className="text-xs font-medium text-secondary-text">
                Email
              </Label>
              <Input
                id="wl-email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                className="border-border bg-surface"
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-xs font-medium text-secondary-text">
                What brings you here?
              </Label>
              <Select
                value={intentValue}
                onValueChange={(v) =>
                  form.setValue("intent", v as FormValues["intent"], {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger className="border-border bg-surface">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-popover">
                  {INTENT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex w-full items-center justify-between gap-2">
                        <span>{opt.label}</span>
                        <span className="text-xs text-secondary-text">{opt.hint}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {promptValue !== null && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="wl-prompt" className="text-xs font-medium text-secondary-text">
                  Your idea <span className="text-secondary-text/60">(optional)</span>
                </Label>
                <Textarea
                  id="wl-prompt"
                  rows={2}
                  placeholder="Describe what you want to create…"
                  className="resize-none border-border bg-surface"
                  {...form.register("prompt")}
                />
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="wl-message" className="text-xs font-medium text-secondary-text">
                Anything else? <span className="text-secondary-text/60">(optional)</span>
              </Label>
              <Textarea
                id="wl-message"
                rows={2}
                placeholder="Tell us what you would love to see in WALLORA"
                className="resize-none border-border bg-surface"
                {...form.register("message")}
              />
              {form.formState.errors.message && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.message.message}
                </p>
              )}
            </div>

            {submitState.status === "error" && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{submitState.message}</span>
              </div>
            )}

            <DialogFooter className="mt-2 gap-2">
              <Button
                type="button"
                variant="ghost"
                className="text-secondary-text"
                onClick={() => handleOpenChange(false)}
                disabled={isDisabled}
              >
                Maybe later
              </Button>
              <Button
                type="submit"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={isDisabled}
              >
                {submitState.status === "loading" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Joining…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Join the waitlist
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
