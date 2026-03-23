'use client';

import React from 'react';
import { motion } from 'framer-motion';

const FinanceLoader = () => {
  // Variants for the bars
  const barVariants = {
    initial: { height: 10 },
    animate: (i: number) => ({
      height: [10, 40 + (i % 3) * 15 + (i % 2) * 10, 10],
      backgroundColor: ['#34d399', '#f87171', '#34d399'], // Green to Red to Green (volatility)
      transition: {
        duration: 1.5,
        repeat: Infinity,
        delay: i * 0.2,
        ease: "easeInOut",
      },
    }),
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_50%,#0891b22b,transparent_50%),linear-gradient(#020617,#020617)] text-slate-100">
      <div className="relative flex items-end justify-center h-32 space-x-2">
        {/* Animated Bars */}
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            custom={i}
            variants={barVariants}
            initial="initial"
            animate="animate"
            className="w-4 rounded-t-sm"
          />
        ))}

        {/* Animated Line Graph Overlay */}
        <svg className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-visible">
          <motion.path
            d="M0 100 C 20 80, 40 120, 60 40 S 100 20, 140 60"
            fill="none"
            stroke="rgba(34, 211, 238, 0.8)"
            strokeWidth="3"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        </svg>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-8 flex flex-col items-center"
      >
        <h2 className="text-2xl font-bold tracking-tight text-cyan-400">BurryAI</h2>
        <motion.p
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-sm text-cyan-200/70 mt-2"
        >
          Analyzing your financial data...
        </motion.p>
      </motion.div>
    </div>
  );
};

export default FinanceLoader;
