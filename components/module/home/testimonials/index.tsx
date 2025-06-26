import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";

export default function Testimonials() {
  const testimonials = [
    {
      name: "Juan Pérez",
      quote: "La mejor plataforma para gestionar mis criptos, súper intuitiva.",
    },
    {
      name: "Ana Gómez",
      quote:
        "Los análisis en tiempo real me ayudaron a tomar mejores decisiones.",
    },
  ];

  return (
    <section className="py-16 container">
      <h2 className="text-4xl font-bold text-center mb-12">
        Qué Dicen Nuestros Usuarios
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 ">
        {testimonials.map((testimonial, index) => (
          <motion.div
            key={index}
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <Card className="bg-gray-900 border-gray-700">
              <CardContent className="pt-6">
                <p className="text-gray-300 italic">
                  &quot;{testimonial.quote}&quot;
                </p>
                <p className="mt-4 font-semibold">{testimonial.name}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
