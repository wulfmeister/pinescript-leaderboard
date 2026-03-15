"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/backtest", label: "Backtest" },
  { href: "/compare", label: "Compare" },
  { href: "/rank", label: "Rank" },
  { href: "/optimize", label: "Optimize" },
  { href: "/walk-forward", label: "Walk-Forward" },
  { href: "/multi-timeframe", label: "Multi-TF" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/gallery", label: "Gallery" },
  { href: "/arena", label: "LLM Arena" },
  { href: "/alpha-lab", label: "Alpha Lab" },
  { href: "/export", label: "Export" },
];

export function NavBar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const linkClass = (href: string) => {
    const isActive =
      href === "/" ? pathname === "/" : pathname.startsWith(href);
    return `px-3 py-1.5 rounded-md text-sm transition-colors ${
      isActive
        ? "bg-brand-600/20 text-brand-500"
        : "text-zinc-400 hover:text-white hover:bg-zinc-800"
    }`;
  };

  return (
    <nav className="border-b border-zinc-800 bg-zinc-900/90 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-white"
          >
            PineScript Utils
          </Link>
          {/* Desktop nav */}
          <div className="hidden lg:flex gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={linkClass(item.href)}
              >
                {item.label}
              </Link>
            ))}
          </div>
          {/* Mobile hamburger */}
          <button
            className="lg:hidden text-zinc-400 hover:text-white p-1"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {menuOpen ? (
              <svg
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M6 6l12 12M6 18L18 6" />
              </svg>
            ) : (
              <svg
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>
      {/* Mobile panel */}
      {menuOpen && (
        <div className="lg:hidden border-t border-zinc-800 py-2 px-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block ${linkClass(item.href)}`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
