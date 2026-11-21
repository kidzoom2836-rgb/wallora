"use client";

import { motion } from "framer-motion";

import { SectionHeading } from "./section-heading";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FAQS } from "@/lib/landing-data";

export function Faq() {
  return (
    <section id="faq" className="relative py-20 sm:py-28" aria-labelledby="faq-heading">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="FAQ"
          title={<>Frequently asked questions</>}
          subtitle="Everything you need to know about WALLORA today. More answers arrive as each phase ships."
          align="center"
          className="mx-auto items-center"
        />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mt-10"
        >
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((faq, idx) => (
              <AccordionItem
                key={faq.q}
                value={`item-${idx}`}
                className="border-border"
              >
                <AccordionTrigger className="text-left font-display text-base font-medium text-foreground hover:no-underline hover:text-primary">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-secondary-text">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}
