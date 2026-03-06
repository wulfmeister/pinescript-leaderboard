"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/backtest", label: "Backtest" },
  { href: "/rank", label: "Rank" },
  { href: "/optimize", label: "Optimize" },
  { href: "/walk-forward", label: "Walk-Forward" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/arena", label: "LLM Arena" },
  { href: "/export", label: "Export" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-green-900 bg-green-950/90 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-white"
          >
            PineScript Utils
          </Link>
          <div className="flex gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                    isActive
                      ? "bg-green-800 text-white"
                      : "text-green-200 hover:text-white hover:bg-green-900"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
