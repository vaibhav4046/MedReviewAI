import { useState } from "react";
import { useLocation, Outlet, Link } from "react-router-dom";
import { LayoutDashboard, FileText, Search, Eye, Info, Menu, X, Brain, Upload } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";
import ThemeToggle from "@/components/ThemeToggle";

const navItems = [
  { title: "Analyzer", path: "/analyzer", icon: Upload },
  { title: "Search & Screen", path: "/search", icon: Search },
  { title: "Results", path: "/dashboard", icon: LayoutDashboard },
  { title: "Document Viewer", path: "/viewer", icon: Eye },
  { title: "About", path: "/about", icon: Info },
];

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const location = useLocation();

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={onToggle}
          />
        )}
      </AnimatePresence>

      <aside
        className={`fixed top-0 left-0 h-screen bg-sidebar border-r border-sidebar-border z-50 flex flex-col transition-transform duration-300 w-64
          ${collapsed ? "-translate-x-full lg:translate-x-0 lg:w-64" : "translate-x-0"}`}
      >
        {/* Logo */}
        <Link to="/" className="px-5 py-5 border-b border-sidebar-border flex items-center gap-3 hover:bg-muted/20 transition-colors">
          <img src="/favicon.svg" alt="MedReviewAI" className="w-9 h-9 shrink-0" />
          <div>
            <h1 className="text-sm font-bold text-sidebar-foreground">MedReviewAI</h1>
            <span className="text-[11px] text-muted-foreground">Medical Paper Analysis</span>
          </div>
          <button onClick={(e) => { e.preventDefault(); onToggle(); }} className="ml-auto lg:hidden text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </Link>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Navigation</p>
          {navItems.map((item) => {
            const active = location.pathname === item.path || (item.path !== "/dashboard" && item.path !== "/about" && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => onToggle()}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                  ${active
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-sidebar-border">
          <p className="text-[10px] text-muted-foreground">© 2026 MedReviewAI</p>
        </div>
      </aside>
    </>
  );
}

export default function DashboardLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  return (
    <div className="relative z-10 flex min-h-screen">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((p) => !p)} />

      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-30 h-16 border-b border-border bg-background/80 backdrop-blur-xl flex items-center px-4 lg:px-8 gap-4">
          <button onClick={() => setSidebarCollapsed(false)} className="lg:hidden text-muted-foreground hover:text-foreground">
            <Menu className="w-5 h-5" />
          </button>
          <h2 className="text-base font-semibold text-foreground">MedReviewAI</h2>
          <div className="ml-auto flex items-center gap-4">
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors mr-2">
              Home
            </Link>
            <ThemeToggle />
            <SignedOut>
              <SignInButton mode="modal">
                <button className="bg-primary text-primary-foreground rounded-full font-medium text-xs h-8 px-4 cursor-pointer hover:opacity-90 transition-opacity">
                  Sign In
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full min-w-0 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
