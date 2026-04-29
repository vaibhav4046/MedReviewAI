import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Brain, Upload, Search, Sparkles, FileText, ShieldCheck, BarChart3, ArrowRight, Cpu, Database, Globe } from "lucide-react";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";
import ThemeToggle from "@/components/ThemeToggle";

const features = [
  { icon: Upload, title: "PDF Upload", desc: "Upload medical research papers in PDF format for instant AI-powered analysis." },
  { icon: Search, title: "PubMed Search", desc: "Search millions of papers on PubMed by keyword, filter and sort results." },
  { icon: FileText, title: "URL / DOI Input", desc: "Paste a PubMed URL, PMID, or DOI to fetch and analyze a specific paper." },
  { icon: Sparkles, title: "PICO Extraction", desc: "Automatically extract Population, Intervention, Comparison, and Outcome data." },
  { icon: BarChart3, title: "Demographics & Methodology", desc: "Extract sample sizes, age ranges, study designs, randomization, and more." },
  { icon: ShieldCheck, title: "Confidence Scoring", desc: "AI-generated confidence scores with hallucination flags for unreliable data." },
];

const techStack = [
  { icon: Cpu, label: "Groq AI (Llama 3.3 70B)", desc: "LLM-powered data extraction with structured JSON output" },
  { icon: Globe, label: "PubMed E-Utils API", desc: "Access to 35M+ biomedical literature citations" },
  { icon: Database, label: "React + TypeScript", desc: "Modern frontend with shadcn/ui components" },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen relative z-10">
      <nav className="sticky top-0 z-50 border-b border-border bg-background/60 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src="/favicon.svg" alt="MedReviewAI" className="w-9 h-9" />
            <span className="text-base font-bold text-foreground">MedReviewAI</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline">
              Home
            </Link>
            <ThemeToggle />
            <SignedOut>
              <SignInButton mode="modal">
                <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">Sign In</button>
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
    <div className="space-y-8 max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <span className="section-label mb-4">ℹ️ About</span>
        <h1 className="text-2xl font-extrabold text-foreground mt-3 mb-2">About MedReviewAI</h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          MedReviewAI is an AI-powered platform for analyzing medical research papers. It automates the extraction
          of structured data from scientific literature, including PICO frameworks, demographics, methodology,
          outcomes, and confidence scoring — helping researchers and clinicians make evidence-based decisions faster.
        </p>
      </motion.div>

      {/* How It Works */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6">
        <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" /> How It Works
        </h2>
        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <div className="flex gap-4">
            <span className="text-xl font-black text-primary/30 shrink-0">01</span>
            <div>
              <p className="font-semibold text-foreground">Input Your Paper</p>
              <p>Upload a PDF file, paste a PubMed URL or DOI, or search PubMed by keyword to find papers.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <span className="text-xl font-black text-primary/30 shrink-0">02</span>
            <div>
              <p className="font-semibold text-foreground">AI Analysis</p>
              <p>Groq AI (Llama 3.3 70B) reads the full paper text or abstract and extracts structured data following the PICO framework, plus demographics, methodology, and outcomes.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <span className="text-xl font-black text-primary/30 shrink-0">03</span>
            <div>
              <p className="font-semibold text-foreground">Confidence Scoring</p>
              <p>The AI cross-validates its extractions internally and generates per-field confidence scores (0–100%). Low-confidence fields are flagged as potential hallucinations.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <span className="text-xl font-black text-primary/30 shrink-0">04</span>
            <div>
              <p className="font-semibold text-foreground">Review Results</p>
              <p>View results in structured cards, a side-by-side document viewer, or export as JSON/CSV for further analysis.</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Features */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <h2 className="text-base font-bold text-foreground mb-4">Features</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.05 }}
              className="glass-card-hover p-4"
            >
              <f.icon className="w-6 h-6 text-primary mb-3" />
              <h3 className="text-sm font-semibold text-foreground mb-1">{f.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Tech Stack */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-6">
        <h2 className="text-base font-bold text-foreground mb-4">Technology Stack</h2>
        <div className="space-y-3">
          {techStack.map((t) => (
            <div key={t.label} className="flex items-center gap-4 p-3 rounded-xl border border-border bg-card/40">
              <t.icon className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">{t.label}</p>
                <p className="text-xs text-muted-foreground">{t.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* CTA */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="text-center py-6">
        <Link to="/analyzer" className="btn-glow inline-flex items-center gap-2 text-base">
          Get Started <ArrowRight className="w-4 h-4" />
        </Link>
      </motion.div>
    </div>
    </div>
  );
}
