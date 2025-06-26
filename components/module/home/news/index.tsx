import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function News() {
  const news = [
    {
      title: "Bitcoin Alcanza Nuevo Máximo",
      date: "20 Jun 2025",
      excerpt: "El precio de BTC supera los $65,000...",
    },
    {
      title: "Ethereum 2.0 en Marcha",
      date: "18 Jun 2025",
      excerpt: "La actualización mejora la escalabilidad...",
    },
    {
      title: "Solana Gana Popularidad",
      date: "15 Jun 2025",
      excerpt: "Proyectos DeFi eligen Solana por su velocidad...",
    },
  ];

  return (
    <section id="news" className="py-16 bg-gray-800">
      <h2 className="text-4xl font-bold text-center mb-12 container">
        Últimas Noticias
      </h2>
      <div className="container space-y-6">
        {news.map((article, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="bg-gray-900 border-gray-700">
              <CardContent className="pt-6">
                <h3 className="text-xl font-semibold">{article.title}</h3>
                <p className="text-sm text-gray-400">{article.date}</p>
                <p className="text-gray-300 mt-2">{article.excerpt}</p>
                <Button variant="link" asChild className="p-0 h-auto">
                  <Link href={`/news/${index}`}>Leer más</Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
