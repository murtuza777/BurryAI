interface AIRequestData {
  loanAmount: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  country: string;
  university: string;
  userMessage: string;
  detectedTopics: string[];
  context: {
    country: string;
    monthlyBudget: number;
    savingsPotential: number;
  };
}

interface AIErrorResponse {
  error: string;
}

interface AISuccessResponse {
  data: {
    recommendations: {
      advice: string;
      relevantData: any[];
    };
  };
}

interface ScholarshipInfo {
  name: string;
  amount: number;
  deadline: string;
  eligibility: string;
}

interface InvestmentOption {
  type: string;
  risk: string;
  minAmount: number;
  description: string;
}

const API_BASE = '/api';

export async function getAIRecommendations(data: AIRequestData) {
  try {
    console.log('Sending data to AI service:', data);

    // Use the current Worker-backed advisor endpoint. The old `/recommendations`
    // route is a legacy path and may not exist in newer deployments.
    const response = await fetch(`${API_BASE}/agent/advice`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: data.userMessage
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI service error response:', errorText);
      throw new Error(errorText || 'AI service error');
    }
    
    const result = await response.json();
    console.log('AI service response:', result);
    
    return {
      data: {
        recommendations: {
          advice: result?.response ?? '',
          relevantData: []
        }
      },
      raw: result
    };
  } catch (error) {
    console.error('Error calling AI service:', error);
    throw error;
  }
}

export async function getAvailableScholarships(country: string, university: string) {
  return fetchFromAI('/api/scholarships', { country, university })
}

export async function getInvestmentSuggestions(budget: number, riskTolerance: string) {
  return fetchFromAI('/api/investment-suggestions', { budget, riskTolerance })
}

export async function getCryptoOpportunities() {
  return fetchFromAI('/api/crypto-opportunities', {})
}

async function fetchFromAI(endpoint: string, data: any) {
  try {
    const cleanEndpoint = endpoint.startsWith('/api') ? endpoint.slice(4) : endpoint;
    const response = await fetch(`${API_BASE}${cleanEndpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) throw new Error('AI service error')
    return await response.json()
  } catch (error) {
    console.error(`Error calling ${endpoint}:`, error)
    throw error
  }
} 
