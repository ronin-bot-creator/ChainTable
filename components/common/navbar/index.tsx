"use client";
import { Button } from "@/components/ui/button";
import { TantoConnectButton } from "@sky-mavis/tanto-widget";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import SignMessageButton from "../SignMessageButton";
import { MaterialSymbol } from "react-material-symbols";

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 w-full bg-gray-900/80 backdrop-blur-md z-50">
      <div className=" container py-4 flex justify-between items-center">
        <Link href="/" className="text-2xl font-bold text-blue-400">
          CryptoApp
        </Link>
        <div className="hidden md:flex gap-4 items-center">
          <Link href="#features" className="hover:text-blue-400 text-white">
            Características
          </Link>
          <Link href="#prices" className="hover:text-blue-400 text-white">
            Precios
          </Link>
          <Link href="#news" className="hover:text-blue-400 text-white">
            Noticias
          </Link>
          <Link href="#faq" className="hover:text-blue-400 text-white">
            FAQ
          </Link>
          <TantoConnectButton />
          <SignMessageButton />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <MaterialSymbol
            icon={isMenuOpen ? "close" : "menu"}
            className="!text-2xl text-white"
          />
        </Button>
      </div>
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden bg-gray-900 px-4 pb-4"
          >
            <Link href="#features" className="block py-2 hover:text-blue-400">
              Características
            </Link>
            <Link href="#prices" className="block py-2 hover:text-blue-400">
              Precios
            </Link>
            <Link href="#news" className="block py-2 hover:text-blue-400">
              Noticias
            </Link>
            <Link href="#faq" className="block py-2 hover:text-blue-400">
              FAQ
            </Link>
            <div className="py-2">
              <TantoConnectButton />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
