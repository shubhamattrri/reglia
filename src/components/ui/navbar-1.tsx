"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Menu, X } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { HeaderAccount } from "@/components/layout/header-account";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Home" },
  { href: "/membership", label: "Membership" },
  { href: "/what-we-do", label: "What we do" },
  { href: "/services", label: "Services" },
  { href: "/assistance", label: "Assistance" },
] as const;

export function Navbar1() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const toggleMenu = () => setIsOpen((v) => !v);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const menu =
    mounted &&
    createPortal(
      <AnimatePresence>
        {isOpen ? (
          <motion.div
            key="mobile-nav"
            className="fixed inset-0 z-[300] lg:hidden"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            aria-modal
            role="dialog"
            aria-label="Navigation"
          >
            {/* Opaque layer — never fade opacity on this shell */}
            <div className="absolute inset-0 bg-ink" />

            <div className="relative z-10 flex h-full flex-col px-6 pt-24">
              <motion.button
                className="absolute right-5 top-5 rounded-full bg-warm-white/10 p-2"
                onClick={toggleMenu}
                whileTap={{ scale: 0.9 }}
                aria-label="Close menu"
              >
                <X className="h-6 w-6 text-warm-white" />
              </motion.button>

              <div className="flex flex-col space-y-5">
                {links.map((item, i) => (
                  <motion.div
                    key={item.href}
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 + 0.08 }}
                  >
                    <Link
                      href={item.href}
                      className="text-lg font-medium text-warm-white"
                      onClick={() => setIsOpen(false)}
                    >
                      {item.label}
                    </Link>
                  </motion.div>
                ))}
                <div className="pt-4">
                  <HeaderAccount pill />
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>,
      document.body
    );

  return (
    <div className="flex w-full justify-center px-4 py-4">
      <div className="relative z-10 flex w-full max-w-5xl items-center justify-between rounded-full border border-champagne/25 bg-ink/90 px-4 py-2 shadow-[0_18px_50px_-12px_rgba(59,40,25,0.3)] backdrop-blur-xl md:px-6">
        <Link
          href="/"
          className="flex min-w-0 items-center"
          onClick={() => setIsOpen(false)}
        >
          <span className="mr-3 flex h-10 items-center">
            <BrandMark
              variant="site"
              className="h-9 w-auto max-w-[148px] bg-transparent object-contain"
              fallback="LR"
            />
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
            return (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                whileHover={{ scale: 1.05 }}
              >
                <Link
                  href={item.href}
                  className={cn(
                    "rounded-full px-3 py-2 text-[11px] font-medium transition-colors",
                    active
                      ? "bg-champagne text-ink"
                      : "text-warm-white/75 hover:text-warm-white"
                  )}
                >
                  {item.label}
                </Link>
              </motion.div>
            );
          })}
        </nav>

        <div className="hidden items-center lg:flex">
          <HeaderAccount pill />
        </div>

        <motion.button
          className="flex items-center lg:hidden"
          onClick={toggleMenu}
          whileTap={{ scale: 0.9 }}
          aria-label={isOpen ? "Close menu" : "Open menu"}
        >
          <Menu className="h-6 w-6 text-warm-white" />
        </motion.button>
      </div>

      {menu}
    </div>
  );
}

export default Navbar1;
