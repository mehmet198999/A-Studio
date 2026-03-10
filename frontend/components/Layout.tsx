import Link from "next/link";
import { useRouter } from "next/router";
import { ReactNode } from "react";
import { Navbar, NavbarBrand, NavbarCollapse, NavbarToggle } from "flowbite-react";

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
    <div className="min-h-screen flex flex-col bg-gray-950">
      <Navbar fluid className="bg-gray-900 border-b border-gray-800 px-4">
        <NavbarBrand as="span">
          <span className="font-bold text-blue-400 text-lg cursor-pointer" onClick={() => router.push("/")}>
            Domain Warming
          </span>
        </NavbarBrand>

        <div className="flex items-center gap-2 md:order-2">
          <button
            onClick={handleLogout}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1"
          >
            Abmelden
          </button>
          <NavbarToggle className="text-gray-400 hover:bg-gray-800 focus:ring-gray-700" />
        </div>

        <NavbarCollapse>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block py-2 px-3 rounded-md text-sm font-medium transition-colors md:px-2 ${
                router.pathname === item.href
                  ? "text-blue-400 bg-blue-900/20"
                  : "text-gray-400 hover:text-gray-100 hover:bg-gray-800"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </NavbarCollapse>
      </Navbar>

      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full">{children}</main>
    </div>
  );
}
