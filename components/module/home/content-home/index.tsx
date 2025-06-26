"use client";
import { TantoConnectButton } from "@sky-mavis/tanto-widget";
import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import CryptoPrices from "@/components/module/home/crypto-prices";
import Features from "@/components/module/home/features";
import News from "@/components/module/home/news";
import Testimonials from "@/components/module/home/testimonials";
import FAQ from "@/components/module/home/fqa";

export default function ContentHome() {
  return (
    <div className="dark bg-gradient-to-b from-gray-900 to-black text-white">
      <section className="flex flex-col items-center justify-center min-h-screen pt-20 container">
        <motion.h1
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-5xl md:text-7xl font-bold text-center mb-6"
        >
          Bienvenido al Futuro de las{" "}
          <span className="text-blue-400">Criptomonedas</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-lg md:text-xl text-gray-300 text-center max-w-2xl mb-8"
        >
          Invierte, gestiona y explora el mundo blockchain con nuestra
          plataforma segura y moderna.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <TantoConnectButton />
          <Button asChild>
            <Link href="/dashboard">Empezar Ahora</Link>
          </Button>
        </motion.div>
      </section>

      <CryptoPrices />
      <Features />
      <News />
      <Testimonials />
      <FAQ />
    </div>
  );
}
