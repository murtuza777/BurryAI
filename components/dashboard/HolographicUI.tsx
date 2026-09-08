import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface HolographicButtonProps {
  children: ReactNode;
  onClick: () => void;
  icon?: React.ComponentType<any>;
  className?: string;
}

export const HolographicButton: React.FC<HolographicButtonProps> = ({ 
  children, 
  onClick, 
  icon: Icon, 
  className = '' 
}) => (
  <motion.button
    className={`inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-white/90 px-4 py-2.5 text-sm font-medium text-slate-800 shadow-xs transition-all duration-200 hover:border-cyan-500/50 hover:bg-cyan-50/50 hover:text-cyan-900 dark:border-slate-700/70 dark:bg-slate-900/75 dark:text-slate-200 dark:hover:border-cyan-400/45 dark:hover:bg-slate-800/80 dark:hover:text-cyan-100 ${className}`}
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
  >
    {Icon && <Icon className="w-4 h-4" />}
    <span>{children}</span>
  </motion.button>
)

interface HolographicCardProps {
  children: ReactNode;
  className?: string;
}

export const HolographicCard: React.FC<HolographicCardProps> = ({ children, className = '', ...props }) => {
  return (
    <motion.div
      className={`relative overflow-hidden rounded-2xl border border-slate-200/85 bg-gradient-to-b from-white via-slate-50/90 to-slate-100/70 p-6 text-slate-900 shadow-[0_10px_30px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/[0.03] transition-colors duration-200 dark:border-slate-800/90 dark:bg-gradient-to-b dark:from-slate-900/85 dark:via-slate-950/90 dark:to-slate-950/95 dark:text-white dark:shadow-[0_14px_45px_rgba(2,6,23,0.45)] dark:ring-white/[0.04] ${className}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      {...props}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom_right,rgba(6,182,212,0.04),transparent_45%,rgba(56,189,248,0.03))] dark:bg-[linear-gradient(to_bottom_right,rgba(6,182,212,0.08),transparent_45%,rgba(56,189,248,0.05))]" />
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  )
} 