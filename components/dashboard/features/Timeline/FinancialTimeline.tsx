import { useState } from 'react'
import { HolographicCard, HolographicButton } from '@/components/dashboard/HolographicUI'
import { Line } from 'react-chartjs-2'
import { Calendar, DollarSign, TrendingUp, Clock, AlertCircle } from 'lucide-react'
import { format, addMonths } from 'date-fns'

interface TimelineProps {
  userData: {
    loanAmount: number
    monthlyIncome: number
    monthlyExpenses: number
    loans: Array<{
      id: string
      loan_name: string
      remaining_balance: number
      interest_rate: number
      minimum_payment: number
      due_date: string | null
    }>
  }
}

export function FinancialTimeline({ userData }: TimelineProps) {
  const [timeframe, setTimeframe] = useState('1year')
  const baseMonthlyPayment = Math.max(
    userData.loans.reduce((sum, loan) => sum + loan.minimum_payment, 0),
    0
  )
  const averageInterestRate =
    userData.loans.length === 0
      ? 5.5
      : userData.loans.reduce((sum, loan) => sum + loan.interest_rate, 0) / userData.loans.length

  const generateTimelineData = () => {
    const months = timeframe === '1year' ? 12 : timeframe === '3years' ? 36 : 60
    const data = []
    let balance = userData.loanAmount
    const monthlyPayment = baseMonthlyPayment
    const interestRate = (averageInterestRate / 100) / 12

    for (let i = 0; i <= months; i++) {
      const interest = balance * interestRate
      balance = balance + interest - monthlyPayment
      if (balance < 0) balance = 0

      data.push({
        month: i,
        balance: Math.round(balance),
        payment: monthlyPayment,
        interest: Math.round(interest)
      })
    }
    return data
  }

  const timelineData = generateTimelineData()

  // Calculate payment impact metrics
  const monthlyPayment = baseMonthlyPayment
  const extraPayment = monthlyPayment + 200
  const totalInterest = timelineData.reduce((sum, d) => sum + d.interest, 0)
  
  // Calculate payoff dates
  const standardPayoffMonthRaw = timelineData.findIndex(d => d.balance <= 0)
  const standardPayoffMonth = standardPayoffMonthRaw === -1 ? timelineData.length : standardPayoffMonthRaw
  const payoffDate = format(addMonths(new Date(), standardPayoffMonth), 'MMM yyyy')
  
  // Calculate with extra payments
  const extraPaymentData = []
  let balanceWithExtra = userData.loanAmount
  let monthsWithExtra = 0
  let totalInterestWithExtra = 0

  while (balanceWithExtra > 0 && monthsWithExtra < timelineData.length) {
    const interest = balanceWithExtra * ((averageInterestRate / 100) / 12)
    totalInterestWithExtra += interest
    balanceWithExtra = balanceWithExtra + interest - extraPayment
    monthsWithExtra++
  }

  const payoffDateWithExtra = format(addMonths(new Date(), monthsWithExtra), 'MMM yyyy')
  const interestSavings = Math.round(totalInterest - totalInterestWithExtra)
  const payoffProgress =
    userData.loanAmount > 0
      ? Math.round((1 - timelineData[timelineData.length - 1].balance / userData.loanAmount) * 100)
      : 100

  return (
    <div className="space-y-6">
      {userData.loans.length === 0 ? (
        <HolographicCard>
          <p className="text-sm text-slate-300">No loans found yet. Add loan entries to generate a timeline.</p>
        </HolographicCard>
      ) : null}
      {/* Timeline Controls */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <HolographicButton
          onClick={() => setTimeframe('1year')}
          className={timeframe === '1year' ? 'bg-cyan-300 text-slate-950 font-semibold border-cyan-200' : ''}
        >
          1 Year
        </HolographicButton>
        <HolographicButton
          onClick={() => setTimeframe('3years')}
          className={timeframe === '3years' ? 'bg-cyan-300 text-slate-950 font-semibold border-cyan-200' : ''}
        >
          3 Years
        </HolographicButton>
        <HolographicButton
          onClick={() => setTimeframe('5years')}
          className={timeframe === '5years' ? 'bg-cyan-300 text-slate-950 font-semibold border-cyan-200' : ''}
        >
          5 Years
        </HolographicButton>
      </div>

      {/* Main Timeline Chart */}
      <HolographicCard>
        <h3 className="mb-4 flex items-center text-xl font-semibold">
          <Calendar className="w-6 h-6 text-cyan-500 mr-2" />
          Loan Repayment Timeline
        </h3>
        <div className="h-[280px] sm:h-[400px]">
          <Line
            data={{
              labels: timelineData.map(d => `Month ${d.month}`),
              datasets: [
                {
                  label: 'Loan Balance',
                  data: timelineData.map(d => d.balance),
                  borderColor: 'rgba(6, 182, 212, 1)',
                  backgroundColor: 'rgba(6, 182, 212, 0.1)',
                  fill: true,
                  tension: 0.4
                },
                {
                  label: 'Cumulative Interest',
                  data: timelineData.map((_, i) => 
                    timelineData.slice(0, i + 1).reduce((sum, d) => sum + d.interest, 0)
                  ),
                  borderColor: 'rgba(249, 115, 22, 1)',
                  backgroundColor: 'rgba(249, 115, 22, 0.1)',
                  fill: true,
                  tension: 0.4
                }
              ]
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'top',
                  labels: { color: '#cbd5e1' }
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  grid: { color: 'rgba(148, 163, 184, 0.18)' },
                  ticks: { 
                    color: '#cbd5e1',
                    callback: (value) => `$${value.toLocaleString()}`
                  }
                },
                x: {
                  grid: { color: 'rgba(148, 163, 184, 0.14)' },
                  ticks: { color: '#cbd5e1' }
                }
              }
            }}
          />
        </div>
      </HolographicCard>

      {/* Timeline Metrics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
        <HolographicCard>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-slate-400 text-sm">Total Interest</h4>
              <p className="text-2xl font-bold">
                ${timelineData.reduce((sum, d) => sum + d.interest, 0).toLocaleString()}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-cyan-500" />
          </div>
        </HolographicCard>

        <HolographicCard>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-slate-400 text-sm">Payoff Progress</h4>
              <p className="text-2xl font-bold">
                {payoffProgress}%
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-cyan-500" />
          </div>
        </HolographicCard>

        <HolographicCard>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-slate-400 text-sm">Time Remaining</h4>
              <p className="text-2xl font-bold">
                {standardPayoffMonth} months
              </p>
            </div>
            <Clock className="w-8 h-8 text-cyan-500" />
          </div>
        </HolographicCard>
      </div>

      {/* Payment Impact Simulator */}
      <HolographicCard>
        <h3 className="mb-4 flex items-center text-xl font-semibold">
          <AlertCircle className="w-6 h-6 text-cyan-500 mr-2" />
          Payment Impact Simulator
        </h3>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <h4 className="font-semibold">Standard Payment Plan</h4>
            <p className="text-slate-300">Monthly Payment: ${monthlyPayment.toLocaleString()}</p>
            <p className="text-slate-300">Total Interest: ${Math.round(totalInterest).toLocaleString()}</p>
            <p className="text-slate-300">Payoff Date: {payoffDate}</p>
          </div>
          <div className="space-y-4">
            <h4 className="font-semibold">With Extra Payments</h4>
            <p className="text-cyan-300">Monthly Payment: ${extraPayment.toLocaleString()}</p>
            <p className="text-cyan-300">Total Interest: ${Math.round(totalInterestWithExtra).toLocaleString()}</p>
            <p className="text-cyan-300">Payoff Date: {payoffDateWithExtra}</p>
            <p className="text-emerald-400">You could save ${interestSavings.toLocaleString()}!</p>
          </div>
        </div>
      </HolographicCard>
    </div>
  )
} 
