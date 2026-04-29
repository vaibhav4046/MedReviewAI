import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Upload, Search, ArrowRight, FileText, BarChart3, ShieldCheck, ScanSearch, BrainCircuit } from "lucide-react";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";
import ThemeToggle from "@/components/ThemeToggle";

const features = [
  {
    icon: Upload,
    title: "PDF Analysis",
    desc: "Upload medical research papers directly and extract structured data instantly.",
    color: "from-blue-500/20 to-blue-600/10 border-blue-500/25 text-blue-400",
  },
  {
    icon: Search,
    title: "PubMed Search",
    desc: "Search millions of medical papers by keyword, PMID, or DOI and analyze them.",
    color: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/25 text-emerald-400",
  },
  {
    icon: ScanSearch,
    title: "AI Extraction",
    desc: "Extract PICO, demographics, methodology, outcomes, and confidence scores automatically.",
    color: "from-violet-500/20 to-violet-600/10 border-violet-500/25 text-violet-400",
  },
];

const steps = [
  { num: "01", icon: FileText, title: "Input", desc: "Upload a PDF, paste a URL/DOI, or search PubMed" },
  { num: "02", icon: BrainCircuit, title: "AI Analysis", desc: "Groq AI (Llama 3.3 70B) extracts structured data with confidence scoring" },
  { num: "03", icon: BarChart3, title: "Results", desc: "View PICO tables, demographics, and source-referenced data" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen relative z-10">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/60 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="MedReviewAI" className="w-9 h-9 animate-float-slow" />
            <span className="text-base font-bold text-foreground">MedReviewAI</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline">
              About
            </Link>
            <ThemeToggle />
            <SignedOut>
              <SignInButton mode="modal">
                <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Sign In
                </button>
              </SignInButton>
              <Link to="/analyzer" className="btn-glow text-sm py-2 px-4 flex items-center gap-2">
                Get Started <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </SignedOut>
            <SignedIn>
              <Link to="/analyzer" className="btn-glow text-sm py-2 px-4 flex items-center gap-2">
                Open App <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section id="main-content" className="pt-16 pb-12 sm:pt-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="hero-pill mb-6">
              <span className="hero-pill-dot" />
              AI-Powered Medical Research Analysis
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-foreground mt-6 mb-6 leading-[1.05] tracking-tight">
              Extract Insights from{" "}
              <span className="hero-gradient-text">Medical Papers</span>{" "}
              in Seconds
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Upload PDFs, search PubMed, or paste DOIs — MedReviewAI automatically extracts PICO data,
              demographics, methodology, outcomes, and confidence scores using Groq AI.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link to="/analyzer" className="btn-glow text-base py-3.5 px-8 flex items-center justify-center gap-2">
              <Upload className="w-4 h-4" /> Upload a Paper
            </Link>
            <Link
              to="/search"
              className="px-8 py-3.5 rounded-xl border border-border bg-muted/30 text-foreground font-semibold text-base hover:bg-muted/60 transition-all flex items-center justify-center gap-2"
            >
              <Search className="w-4 h-4" /> Search PubMed
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="pt-8 pb-12 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                whileHover={{ y: -4 }}
                className="card-refined p-6 group"
              >
                <div className={`inline-flex w-12 h-12 rounded-xl items-center justify-center mb-4 bg-gradient-to-br ${f.color} border transition-transform duration-300 group-hover:scale-110`}>
                  <f.icon className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <h3 className="text-base font-bold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center mb-12"
          >
            <span className="hero-pill">
              <span className="hero-pill-dot" />
              How It Works
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground mt-4">Three Simple Steps</h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 relative">
            <svg className="hidden md:block absolute inset-0 w-full h-full pointer-events-none z-0" preserveAspectRatio="none" viewBox="0 0 100 100">
              <defs>
                <linearGradient id="flowGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="hsl(var(--blue))" stopOpacity="0"/>
                  <stop offset="0.2" stopColor="hsl(var(--blue))" stopOpacity="0.7"/>
                  <stop offset="0.5" stopColor="hsl(var(--violet))" stopOpacity="0.9"/>
                  <stop offset="0.8" stopColor="hsl(var(--blue))" stopOpacity="0.7"/>
                  <stop offset="1" stopColor="hsl(var(--blue))" stopOpacity="0"/>
                </linearGradient>
              </defs>
              <motion.line
                x1="18" y1="50" x2="82" y2="50"
                stroke="url(#flowGrad)"
                strokeWidth="0.6"
                strokeDasharray="2 1"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                initial={{ strokeDashoffset: 20 }}
                animate={{ strokeDashoffset: 0 }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
              />
            </svg>
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + i * 0.1 }}
                whileHover={{ y: -4 }}
                className="card-refined p-6 text-center relative z-10"
              >
                <span className="text-5xl font-black text-primary/10 absolute top-3 right-4">{step.num}</span>
                <div className="icon-badge w-12 h-12 mx-auto mb-4">
                  <step.icon className="w-5 h-5 text-primary" strokeWidth={1.75} />
                </div>
                <h3 className="text-sm font-bold text-foreground mb-2">{step.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pt-12 pb-16 px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="max-w-3xl mx-auto card-refined p-8 sm:p-12 text-center"
        >
          <div className="icon-badge w-14 h-14 mx-auto mb-5">
            <ShieldCheck className="w-6 h-6 text-primary" strokeWidth={1.75} />
          </div>
          <h2 className="text-2xl font-extrabold text-foreground mb-3">Ready to Analyze?</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Start extracting structured data from medical research papers with AI-powered confidence scoring.
          </p>
          <Link to="/analyzer" className="btn-glow inline-flex items-center gap-2 text-base">
            Get Started <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <span>© 2026 MedReviewAI. AI-powered medical research analysis.</span>
          <div className="flex gap-4">
            <Link to="/about" className="hover:text-foreground transition-colors">About</Link>
            <Link to="/analyzer" className="hover:text-foreground transition-colors">Analyzer</Link>
            <Link to="/search" className="hover:text-foreground transition-colors">Search</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
