const { useState, useMemo, useEffect } = React;

function SavingsCalculator() {
  // Load initial values from storage or use defaults
  const loadFromStorage = (key, defaultValue) => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  };

  const [initialBalance, setInitialBalance] = useState(() => loadFromStorage('savings_initialBalance', 1000));
  const [annualRate, setAnnualRate] = useState(() => loadFromStorage('savings_annualRate', 4.5));
  const [years, setYears] = useState(() => loadFromStorage('savings_years', 5));
  const [compoundFrequency, setCompoundFrequency] = useState(() => loadFromStorage('savings_compoundFrequency', 'monthly'));
  const [defaultMonthlyContribution, setDefaultMonthlyContribution] = useState(() => loadFromStorage('savings_defaultMonthlyContribution', 200));
  const [monthlyContributions, setMonthlyContributions] = useState(() => loadFromStorage('savings_monthlyContributions', Array(12).fill(200)));

  // Save to storage whenever values change
  useEffect(() => {
    localStorage.setItem('savings_initialBalance', JSON.stringify(initialBalance));
  }, [initialBalance]);

  useEffect(() => {
    localStorage.setItem('savings_annualRate', JSON.stringify(annualRate));
  }, [annualRate]);

  useEffect(() => {
    localStorage.setItem('savings_years', JSON.stringify(years));
  }, [years]);

  useEffect(() => {
    localStorage.setItem('savings_compoundFrequency', JSON.stringify(compoundFrequency));
  }, [compoundFrequency]);

  useEffect(() => {
    localStorage.setItem('savings_defaultMonthlyContribution', JSON.stringify(defaultMonthlyContribution));
  }, [defaultMonthlyContribution]);

  useEffect(() => {
    localStorage.setItem('savings_monthlyContributions', JSON.stringify(monthlyContributions));
  }, [monthlyContributions]);

  const frequencies = {
    monthly: 12,
    quarterly: 4,
    annually: 1
  };

  const projectionData = useMemo(() => {
    const data = [];
    let balance = initialBalance;
    const periodsPerYear = frequencies[compoundFrequency];
    const ratePerPeriod = annualRate / 100 / periodsPerYear;
    
    for (let year = 0; year <= years; year++) {
      for (let month = 1; month <= 12; month++) {
        if (year === 0 && month === 1) {
          data.push({
            year: 0,
            month: 0,
            monthLabel: 'Initial',
            contribution: 0,
            interest: 0,
            balance: initialBalance
          });
          continue;
        }

        const contribution = monthlyContributions[(month - 1) % 12] ?? defaultMonthlyContribution;
        
        balance += contribution;
        
        let interest = 0;
        if (compoundFrequency === 'monthly') {
          interest = balance * ratePerPeriod;
          balance += interest;
        } else if (compoundFrequency === 'quarterly' && month % 3 === 0) {
          interest = balance * ratePerPeriod;
          balance += interest;
        } else if (compoundFrequency === 'annually' && month === 12) {
          interest = balance * ratePerPeriod;
          balance += interest;
        }

        data.push({
          year,
          month,
          monthLabel: `Year ${year}, Month ${month}`,
          contribution,
          interest,
          balance
        });

        if (year === years && month === 12) break;
      }
    }
    
    return data;
  }, [initialBalance, annualRate, years, compoundFrequency, monthlyContributions, defaultMonthlyContribution]);

  const totalContributions = useMemo(() => {
    return projectionData.reduce((sum, row) => sum + row.contribution, 0);
  }, [projectionData]);

  const totalInterest = useMemo(() => {
    return projectionData.reduce((sum, row) => sum + row.interest, 0);
  }, [projectionData]);

  const finalBalance = projectionData[projectionData.length - 1]?.balance || 0;

  const handleMonthlyChange = (index, value) => {
    const newContributions = [...monthlyContributions];
    newContributions[index] = parseFloat(value) || 0;
    setMonthlyContributions(newContributions);
  };

  const handleDefaultContributionChange = (value) => {
    const newValue = parseFloat(value) || 0;
    setDefaultMonthlyContribution(newValue);
    setMonthlyContributions(Array(12).fill(newValue));
  };

  const handleIndividualMonthChange = (yearIndex, monthIndex, value) => {
    const newValue = parseFloat(value);
    if (isNaN(newValue)) return;
    
    const newContributions = [...monthlyContributions];
    newContributions[monthIndex - 1] = newValue;
    setMonthlyContributions(newContributions);
  };

  const exportToCSV = () => {
    const headers = ['Year', 'Month', 'Monthly Contribution', 'Interest Earned', 'Balance'];
    const rows = projectionData.map(row => [
      row.year,
      row.month,
      row.contribution.toFixed(2),
      row.interest.toFixed(2),
      row.balance.toFixed(2)
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'savings_projection.csv';
    a.click();
  };

  // Lucide Download icon component
  const Download = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="7 10 12 15 17 10"></polyline>
      <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-8">Savings Projection Calculator</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-700 mb-4">Settings</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Initial Balance (£)
                </label>
                <input
                  type="number"
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Annual Interest Rate (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={annualRate}
                  onChange={(e) => setAnnualRate(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Projection Period (Years)
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={years}
                  onChange={(e) => setYears(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Compounding Frequency
                </label>
                <select
                  value={compoundFrequency}
                  onChange={(e) => setCompoundFrequency(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annually">Annually</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Monthly Contribution (£)
                </label>
                <input
                  type="number"
                  value={defaultMonthlyContribution}
                  onChange={(e) => handleDefaultContributionChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">This will reset all monthly values</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-700 mb-4">Summary</h2>
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600">Initial Balance</div>
                <div className="text-2xl font-bold text-blue-600">
                  £{initialBalance.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600">Total Contributions</div>
                <div className="text-2xl font-bold text-green-600">
                  £{totalContributions.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600">Total Interest Earned</div>
                <div className="text-2xl font-bold text-purple-600">
                  £{totalInterest.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div className="bg-indigo-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600">Final Balance</div>
                <div className="text-2xl font-bold text-indigo-600">
                  £{finalBalance.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <button
                onClick={exportToCSV}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Download />
                Export to CSV
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="p-6">
            <h2 className="text-2xl font-semibold text-gray-700 mb-4">Projection Details</h2>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Contribution</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Interest</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {projectionData.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {row.monthLabel}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {row.month === 0 ? (
                        '£0.00'
                      ) : (
                        <input
                          type="number"
                          value={monthlyContributions[(row.month - 1) % 12] ?? defaultMonthlyContribution}
                          onChange={(e) => handleIndividualMonthChange(row.year, row.month, e.target.value)}
                          className="w-24 px-2 py-1 text-right border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-purple-600">
                      £{row.interest.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                      £{row.balance.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<SavingsCalculator />);