import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16 relative z-10">
      <div className="text-center max-w-md">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-3">404 · Not Found</p>
        <h1 className="text-5xl sm:text-6xl font-extrabold text-foreground mb-3 tracking-tight">Page not found</h1>
        <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
          We couldn&apos;t find a page at <code className="px-1.5 py-0.5 rounded bg-muted text-foreground/80 font-mono text-xs">{location.pathname}</code>.
          It may have moved or never existed.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/" className="btn-glow inline-flex items-center justify-center gap-2 text-sm">
            <Home className="w-4 h-4" /> Back to home
          </Link>
          <button onClick={() => window.history.back()} className="px-5 py-3 rounded-xl border border-border bg-muted/30 text-foreground text-sm font-semibold hover:bg-muted/60 inline-flex items-center justify-center gap-2 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Go back
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
