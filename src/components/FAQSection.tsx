"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";

const faqList = [
  {
    id: "01",
    question: "What types of biodegradable tableware do you offer?",
    answer: "We provide an extensive range of eco-conscious disposables including areca leaf plates, bagasse (sugarcane pulp) containers, bowls, compartment trays, and natural wooden cutlery suitable for all events.",
  },
  {
    id: "02",
    question: "Are your biodegradable plates and spoons truly eco-friendly?",
    answer: "Absolutely. Our tableware is made from fallen palm leaves or renewable agricultural plant waste, meaning they are 100% biodegradable and compostable, returning safely to the earth without leaving microplastics.",
  },
  {
    id: "03",
    question: "How durable are your biodegradable plates, bowls, and cutlery?",
    answer: "They are sturdy, leak-proof, and designed to handle both hot and cold foods effortlessly. Unlike flimsy paper alternatives, our items won't get soggy easily during meals.",
  },
  {
    id: "04",
    question: "What sizes of biodegradable plates and trays do you stock?",
    answer: "We stock multiple sizes ranging from small snack bowls and 6-inch dessert plates to full-sized 10-inch dinner plates and multi-compartment catering trays.",
  },
  {
    id: "05",
    question: "Can I place bulk orders for catering, parties, or corporate events?",
    answer: "Yes, we specialize in bulk and wholesale supply for restaurants, event planners, weddings, and corporate gatherings across the region with special wholesale pricing.",
  },
  {
    id: "06",
    question: "How can I place orders using your mobile app?",
    answer: "You can download our mobile app directly from our platform to browse our complete catalog, check real-time stock availability, and place orders seamlessly on the go.",
  },
  {
    id: "07",
    question: "Do you offer delivery tracking through the mobile app?",
    answer: "Yes, our mobile app allows you to track your eco-friendly product orders in real-time right from dispatch to your doorstep or event venue.",
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0); // First item open by default

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="w-full bg-[#FAF9F5] py-12 sm:py-16 md:py-20 px-4 sm:px-6 md:px-12 lg:px-20">
      <div className="mx-auto max-w-4xl">
        
        {/* Section Header */}
        <div className="text-center mb-10 md:mb-14">
          <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-[#1C3516] uppercase mb-3">
            <span className="h-px w-6 bg-[#1C3516]/40"></span>
            Eco friendly products & Tableware
            <span className="h-px w-6 bg-[#1C3516]/40"></span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-serif text-[#1C3516] tracking-tight mb-3">
            Frequently Asked Questions
          </h2>
          <p className="text-xs sm:text-sm md:text-base text-stone-600 max-w-lg mx-auto leading-relaxed">
            Everything you need to know about our sustainable tableware, and eco-friendly products.
          </p>
        </div>

        {/* FAQ Container Box */}
        <div className="rounded-2xl bg-white shadow-md border border-stone-200/60 overflow-hidden">
          
          {/* Box Header Banner */}
          <div className="bg-[#1C3516] px-5 sm:px-6 py-4 sm:py-5 md:px-8 text-amber-50">
            <h3 className="text-sm sm:text-base md:text-lg font-serif font-medium tracking-wide">
              Sustainable Living
            </h3>
            <p className="text-[10px] sm:text-[11px] md:text-xs tracking-wider text-amber-200/80 font-medium uppercase mt-1">
              Biodegradable Tableware · Eco-Conscious Living
            </p>
          </div>

          {/* Accordion List */}
          <div className="divide-y divide-stone-200/70">
            {faqList.map((faq, index) => {
              const isOpen = openIndex === index;
              return (
                <div key={faq.id} className="transition-colors hover:bg-stone-50/50">
                  <button
                    onClick={() => toggleFAQ(index)}
                    className="w-full flex items-center justify-between px-5 sm:px-6 py-4 sm:py-5 md:px-8 text-left focus:outline-none"
                    aria-expanded={isOpen}
                  >
                    <div className="flex items-center gap-3 sm:gap-4 pr-3 sm:pr-4">
                      <span className="text-xs font-mono text-stone-400 font-semibold shrink-0">
                        {faq.id}
                      </span>
                      <span className="text-xs sm:text-sm md:text-base font-medium text-stone-800">
                        {faq.question}
                      </span>
                    </div>
                    
                    {/* Toggle Icon Button */}
                    <div className={`flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
                      isOpen ? "bg-[#1C3516] text-amber-100" : "bg-amber-100/70 text-[#1C3516] hover:bg-amber-200"
                    }`}>
                      {isOpen ? <Minus className="size-3.5 sm:size-4" /> : <Plus className="size-3.5 sm:size-4" />}
                    </div>
                  </button>

                  {/* Accordion Expandable Answer Body */}
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 sm:px-6 sm:pb-6 md:px-8 md:pb-6 pl-10 sm:pl-12 md:pl-14 text-xs sm:text-xs md:text-sm text-stone-600 leading-relaxed font-sans">
                      <p>{faq.answer}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>

      </div>
    </section>
  );
}