import Link from "next/link";
import { useRouter } from "next/router";
import { ReactNode } from "react";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/domains", label: "Domains" },
  { href: "/accounts", label: "Accounts" },
  { href: "/campaigns", label: "Kampagnen" },
  { href: "/logs", label: "Logs" },
];

export default function Layout({ children }: { children: ReactNode }) {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-bold text-blue-400 text-lg">Domain Warming</span>
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
        </div>
        <button
          onClick={handleLogout}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Abmelden
        </button>
      </nav>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
