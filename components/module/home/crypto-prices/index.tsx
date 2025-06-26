"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";
import imagen1 from "@/public/btc.png";
import imagen2 from "@/public/eth.png";
import imagen3 from "@/public/sol.png";
import imagen4 from "@/public/ada.png";

export default function CryptoPrices() {
  const [prices] = useState([
    {
      name: "Bitcoin",
      symbol: "BTC",
      price: "$65,432",
      change: "+2.3%",
      icon: imagen1.src,
    },
    {
      name: "Ethereum",
      symbol: "ETH",
      price: "$3,512",
      change: "-0.8%",
      icon: imagen2.src,
    },
    {
      name: "Solana",
      symbol: "SOL",
      price: "$142.67",
      change: "+4.1%",
      icon: imagen3.src,
    },
    {
      name: "Cardano",
      symbol: "ADA",
      price: "$0.47",
      change: "+1.2%",
      icon: imagen4.src,
    },
  ]);

  return (
    <section id="prices" className="py-16 bg-gray-800">
      <h2 className="text-4xl font-bold text-center mb-12 container">
        Precios en Tiempo Real
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 container">
        {prices.map((crypto) => (
          <motion.div
            key={crypto.symbol}
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader className="flex flex-row items-center gap-3">
                <Image
                  src={crypto.icon}
                  alt={crypto.name}
                  width={32}
                  height={32}
                />
                <CardTitle>
                  {crypto.name} ({crypto.symbol})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{crypto.price}</p>
                <p
                  className={`text-sm ${
                    crypto.change.startsWith("+")
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {crypto.change}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
