import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { MaterialSymbol } from "react-material-symbols";

export default function Features() {
  type MaterialSymbolIcon = "wallet" | "trending_up" | "lock";

  const features: {
    icon: MaterialSymbolIcon;
    title: string;
    description: string;
  }[] = [
    {
      icon: "wallet",
      title: "Wallet Segura",
      description: "Conecta tu wallet con máxima seguridad.",
    },
    {
      icon: "trending_up",
      title: "Análisis en Tiempo Real",
      description: "Gráficos y datos actualizados al instante.",
    },
    {
      icon: "lock",
      title: "Privacidad Garantizada",
      description: "Tus datos están protegidos con encriptación.",
    },
  ];

  return (
    <section id="features" className="py-16 container">
      <h2 className="text-4xl font-bold text-center mb-12">
        Por Qué Elegirnos
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {features.map((feature, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.2 }}
          >
            <Card className="bg-gray-900 border-gray-700 text-center">
              <CardContent className="pt-6">
                <MaterialSymbol
                  icon={feature.icon}
                  className="material-symbols-outlined !text-4xl text-blue-400 mb-4"
                />

                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-300">{feature.description}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
