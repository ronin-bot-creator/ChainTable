import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
export default function FAQ() {
  return (
    <section id="faq" className="py-16 bg-gray-800">
      <h2 className="text-4xl font-bold text-center mb-12 container">
        Preguntas Frecuentes
      </h2>
      <div className="container">
        <Accordion type="single" collapsible>
          {[
            {
              question: "¿Es segura mi wallet?",
              answer:
                "Usamos encriptación de grado militar para proteger tus datos.",
            },
            {
              question: "¿Qué criptos soporta?",
              answer: "Soportamos BTC, ETH, SOL, ADA y más.",
            },
            {
              question: "¿Hay fees?",
              answer: "Solo cobramos fees mínimos por transacciones.",
            },
          ].map((faq, index) => (
            <AccordionItem
              key={index}
              value={`item-${index}`}
              className="border-b border-gray-700"
            >
              <AccordionTrigger>{faq.question}</AccordionTrigger>
              <AccordionContent>{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
