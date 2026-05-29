"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/people", label: "People", icon: "👷" },
  { href: "/admin", label: "Admin", icon: "⚙️" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <>
      {/* Top bar */}
      <header className="bg-blue-700 text-white px-4 py-3 flex items-center justify-between shadow-md sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
            <span className="text-blue-700 font-bold text-sm">V</span>
          </div>
          <span className="font-bold text-base tracking-tight">Versys Safety</span>
        </div>
        <span className="text-blue-200 text-xs font-medium">
          <span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1 animate-pulse" />
          Live
        </span>
      </header>

      {/* Bottom nav for mobile, top nav tabs for desktop */}
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto flex">
          {links.map(({ href, label, icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? "border-blue-700 text-blue-700"
                    : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
                }`}
              >
                <span>{icon}</span>
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
