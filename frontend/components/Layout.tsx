import Link from "next/link";
import { useRouter } from "next/router";
import { ReactNode, useState } from "react";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/domains", label: "Domains" },
  { href: "/accounts", label: "Accounts" },
  { href: "/campaigns", label: "Kampagnen" },
  { href: "/logs", label: "Logs" },
];

export default function Layout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="bg-gray-900 border-b border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="font-bold text-blue-400 text-lg">Domain Warming</span>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition-colors ${
                  router.pathname === item.href
                    ? "text-blue-400"
                    : "text-gray-400 hover:text-gray-100"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Abmelden
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden flex flex-col gap-1.5 p-1"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menü"
          >
            <span className={`block w-6 h-0.5 bg-gray-400 transition-transform ${menuOpen ? "rotate-45 translate-y-2" : ""}`} />
            <span className={`block w-6 h-0.5 bg-gray-400 transition-opacity ${menuOpen ? "opacity-0" : ""}`} />
            <span className={`block w-6 h-0.5 bg-gray-400 transition-transform ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden mt-3 pt-3 border-t border-gray-800 flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  router.pathname === item.href
                    ? "bg-blue-900/40 text-blue-400"
                    : "text-gray-400 hover:bg-gray-800 hover:text-gray-100"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="px-3 py-2.5 text-left text-sm text-red-400 hover:bg-gray-800 rounded-lg"
            >
              Abmelden
            </button>
          </div>
        )}
      </nav>
      <main className="flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
