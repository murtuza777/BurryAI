'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { HolographicButton, HolographicCard } from './dashboard/HolographicUI'
import FinanceLoader from './ui/FinanceLoader'
import {
  Brain,
  Sparkles,
  TrendingUp,
  DollarSign,
  Shield,
  Rocket,
  Compass,
  BarChart3,
  Target
} from 'lucide-react'
import Scene3D from './3d/Scene3D'
import { useRouter } from 'next/navigation'
import { BrandIdentity } from './BrandIdentity'
import { useAuth } from '@/contexts/AuthContext'

export default function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false)
  const router = useRouter()
  const { user, isGuest } = useAuth()

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (user || isGuest) {
      router.replace('/dashboard')
    }
  }, [isGuest, router, user])

  if (user || isGuest) {
    return <FinanceLoader />
  }

  const features = [
    {
      title: 'AI Financial Advisor',
      description: 'Personalized financial health guidance using your real spending and loan profile.',
      icon: Brain,
      color: 'from-cyan-500 to-blue-500'
    },
    {
      title: 'Expense Tracking',
      description: 'Track categories like food, transport, education, subscriptions, and more.',
      icon: Sparkles,
      color: 'from-purple-500 to-pink-500'
    },
    {
      title: 'Financial Insights',
      description: 'Visualize monthly cash flow, savings progress, and debt trends in one place.',
      icon: TrendingUp,
      color: 'from-green-500 to-emerald-500'
    },
    {
      title: 'AI Cost Cutter',
      description: 'Identify wasteful spend, optimize budgets, and prioritize repayment strategy.',
      icon: DollarSign,
      color: 'from-orange-500 to-red-500'
    }
  ]

  const howItWorks = [
    {
      title: 'Connect Your Financial Snapshot',
      description: 'Add your monthly income, expenses, and loan details so the advisor understands your baseline.',
      icon: Compass
    },
    {
      title: 'Analyze Risks And Spending',
      description: 'BurryAI detects stress points, overspending patterns, and debt-to-income pressure in real time.',
      icon: BarChart3
    },
    {
      title: 'Act On Clear Recommendations',
      description: 'Get concrete actions to improve savings, reduce debt risk, and stay on a realistic plan.',
      icon: Target
    }
  ]

  const outcomes = [
    { value: '20-35%', label: 'Potential spend optimization range' },
    { value: '7 days', label: 'To establish a baseline score' },
    { value: '1 dashboard', label: 'For profile, cash flow, and AI actions' }
  ]

  const faqs = [
    {
      question: 'Is BurryAI only for students with loans?',
      answer: 'No. It works for students with or without debt by focusing on spending behavior, savings, and planning.'
    },
    {
      question: 'Does BurryAI store my data securely?',
      answer: 'Yes. Core user data is stored in Cloudflare D1 and records are user-scoped at the API layer.'
    },
    {
      question: 'Can I start without creating a full account?',
      answer: 'Yes. Guest mode is available, and you can upgrade to a full account later.'
    }
  ]

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      <style jsx global>{`
        ::-webkit-scrollbar {
          display: none;
        }
        * {
          scrollbar-width: none;
        }
      `}</style>

      <div className="fixed inset-0">
        <Scene3D />
      </div>

      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-black/80 backdrop-blur-lg' : ''
      }`}>
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <BrandIdentity size={36} textClassName="text-2xl font-bold text-cyan-400" />
          <HolographicButton
            onClick={() => router.push('/login')}
            className="min-w-[150px] rounded-xl px-5 py-2.5 bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 text-slate-50 border-cyan-300/80 shadow-[0_10px_30px_rgba(34,211,238,0.55)] hover:brightness-110 hover:text-slate-50"
          >
            Sign in
          </HolographicButton>
        </div>
      </nav>

      <section className="relative min-h-screen flex items-center justify-center px-4">
        <div className="container mx-auto flex justify-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-4xl text-center"
          >
            <h1 className="text-5xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">
              AI Financial Advisor For Students
            </h1>
            <p className="text-xl text-gray-300 mb-8">
              BurryAI combines financial analytics, agentic AI, and real data to help you optimize spending,
              reduce debt risk, and build better money habits.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <HolographicButton
                onClick={() => router.push('/login')}
                icon={Rocket}
                className="bg-cyan-500 text-slate-50 hover:bg-cyan-400 hover:text-slate-50"
              >
                Get Started
              </HolographicButton>
              <HolographicButton
                onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
                icon={Shield}
              >
                Learn More
              </HolographicButton>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="relative py-20 px-4">
        <div className="container mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-3xl lg:text-5xl font-bold text-center mb-12 bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent"
          >
            Core Features
          </motion.h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <HolographicCard className="h-full">
                  <div className="p-6 space-y-4">
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${feature.color} flex items-center justify-center`}>
                      <feature.icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white">{feature.title}</h3>
                    <p className="text-gray-400">{feature.description}</p>
                  </div>
                </HolographicCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-20 px-4">
        <div className="container mx-auto">
          <h2 className="text-3xl lg:text-5xl font-bold text-center mb-12 text-cyan-300">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {howItWorks.map((item, idx) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
              >
                <HolographicCard className="h-full p-6">
                  <item.icon className="w-7 h-7 text-cyan-400 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-gray-300">{item.description}</p>
                </HolographicCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-20 px-4 bg-gradient-to-b from-black to-black/50">
        <div className="container mx-auto">
          <h2 className="text-3xl lg:text-5xl font-bold text-center mb-10 text-cyan-300">Student Outcomes</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {outcomes.map((item) => (
              <HolographicCard key={item.label} className="p-6 text-center">
                <p className="text-4xl font-bold text-cyan-400 mb-2">{item.value}</p>
                <p className="text-gray-300">{item.label}</p>
              </HolographicCard>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-20 px-4">
        <div className="container mx-auto">
          <h2 className="text-3xl lg:text-5xl font-bold text-center mb-12 text-cyan-300">What Students Say</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <HolographicCard className="p-6">
              <p className="text-gray-200 mb-4">"This finally showed me where my money was leaking every month."</p>
              <p className="text-cyan-400 font-medium">Ayesha, Computer Science</p>
            </HolographicCard>
            <HolographicCard className="p-6">
              <p className="text-gray-200 mb-4">"The debt-risk view helped me set a realistic repayment plan."</p>
              <p className="text-cyan-400 font-medium">Rohan, Economics</p>
            </HolographicCard>
            <HolographicCard className="p-6">
              <p className="text-gray-200 mb-4">"It feels like having a personal financial analyst in my pocket."</p>
              <p className="text-cyan-400 font-medium">Nina, Business Analytics</p>
            </HolographicCard>
          </div>
        </div>
      </section>

      <section className="relative py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl lg:text-5xl font-bold text-center mb-10 text-cyan-300">FAQ</h2>
          <div className="space-y-4">
            {faqs.map((item) => (
              <HolographicCard key={item.question} className="p-5">
                <h3 className="text-lg font-semibold text-white mb-2">{item.question}</h3>
                <p className="text-gray-300">{item.answer}</p>
              </HolographicCard>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <HolographicCard className="p-8 text-center border-cyan-400/50">
            <h2 className="text-3xl lg:text-5xl font-bold text-cyan-300 mb-4">Ready To Build Financial Clarity?</h2>
            <p className="text-gray-300 mb-8">
              Start with one account, one dashboard, and one plan that actually matches your student life.
            </p>
            <HolographicButton
              onClick={() => router.push('/login')}
              className="bg-cyan-500 text-slate-50 hover:bg-cyan-400 hover:text-slate-50 px-8 py-3"
              icon={Rocket}
            >
              Sign in
            </HolographicButton>
          </HolographicCard>
        </div>
      </section>

      <footer className="relative py-8 px-4 border-t border-cyan-500/20">
        <div className="container mx-auto text-center text-gray-400 space-y-3">
          <div className="flex justify-center">
            <BrandIdentity size={30} textClassName="text-xl font-semibold text-cyan-400" />
          </div>
          <p>© 2026 BurryAI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
