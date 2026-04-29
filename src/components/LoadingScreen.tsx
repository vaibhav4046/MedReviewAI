import { motion } from "framer-motion";

export default function LoadingScreen({ label }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background">
      <div className="absolute inset-0 pointer-events-none opacity-60">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[42rem] h-[42rem] rounded-full"
          style={{ background: "radial-gradient(closest-side, hsl(var(--blue) / 0.12), transparent)" }}
        />
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative z-10 flex flex-col items-center gap-5"
      >
        <div className="relative">
          <span className="absolute inset-0 rounded-2xl bg-primary/10 blur-xl animate-pulse" />
          <motion.img
            src="/favicon.svg"
            alt="MedReviewAI"
            className="relative w-16 h-16"
            animate={{
              scale: [1, 1.06, 1],
              rotate: [0, 1.2, -1.2, 0],
            }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <p className="text-sm font-semibold tracking-tight text-foreground">MedReviewAI</p>
          {label && <p className="text-[11px] text-muted-foreground">{label}</p>}
        </div>
        <div className="relative h-[2px] w-40 overflow-hidden rounded-full bg-muted/50">
          <motion.span
            className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent"
            animate={{ x: ["-100%", "300%"] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </motion.div>
    </div>
  );
}
