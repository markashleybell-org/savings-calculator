const { useState, useMemo, useEffect } = React;

const FREQUENCIES = { monthly: 12, quarterly: 4, annually: 1 };

const formatGBP = (n) =>
  '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const roundTo = (value, decimals) => {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const sanitizeNumericInput = (value, { allowDecimal = true } = {}) => {
  let sanitized = '';
  let hasDecimal = false;

  for (const char of String(value ?? '')) {
    if (char >= '0' && char <= '9') {
      sanitized += char;
    } else if (allowDecimal && char === '.' && !hasDecimal) {
      sanitized += char;
      hasDecimal = true;
    }
  }

  return sanitized;
};

// "" and "." both parse to the fallback, "4." parses to 4
const parseNumeric = (text, fallback = 0) => {
  const parsed = parseFloat(text);
  return isNaN(parsed) ? fallback : parsed;
};

const selectInputTextOnFocus = (event) => {
  const input = event.target;
  requestAnimationFrame(() => {
    input.select();
    input.setSelectionRange(0, input.value.length);
  });
};

// Persist a piece of state to localStorage
function usePersistedState(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage unavailable - ignore
    }
  }, [key, value]);

  return [value, setValue];
}

/**
 * A text input that owns the raw string being typed, and reports the parsed
 * number to the parent. This is what lets "4." and "4.0" survive mid-typing:
 * the displayed text is only replaced from `value` when the parent changes it
 * to something the current text doesn't already represent.
 *
 * Props:
 *   value        number from the parent
 *   onCommit     called with the parsed number on every keystroke and on blur
 *   allowDecimal false for integer-only fields
 *   decimals     round to this many places on blur (e.g. 2 for currency)
 *   min, max     clamp the committed number
 */
function NumericField({
  value,
  onCommit,
  allowDecimal = true,
  decimals = null,
  min = -Infinity,
  max = Infinity,
  ...rest
}) {
  const [text, setText] = useState(String(value));

  const normalise = (n) => {
    const rounded = decimals === null ? n : roundTo(n, decimals);
    return Math.min(max, Math.max(min, rounded));
  };

  // Sync from the parent only when it holds a different number to what the
  // user's text already means (e.g. "Default Monthly Contribution" resetting rows).
  useEffect(() => {
    if (normalise(parseNumeric(text)) !== value) {
      setText(String(value));
    }
  }, [value]);

  const handleChange = (e) => {
    let sanitized = sanitizeNumericInput(e.target.value, { allowDecimal });
    const parsed = parseNumeric(sanitized);

    if (parsed > max) sanitized = String(max);

    setText(sanitized);
    onCommit(Math.min(max, Math.max(min, parsed)));
  };

  const handleBlur = () => {
    const finalValue = normalise(parseNumeric(text));
    setText(String(finalValue));
    onCommit(finalValue);
  };

  return (
    <input
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      enterKeyHint="done"
      value={text}
      onFocus={selectInputTextOnFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      {...rest}
    />
  );
}

// Lucide Download icon
const Download = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="7 10 12 15 17 10"></polyline>
    <line x1="12" y1="15" x2="12" y2="3"></line>
  </svg>
);

function SavingsCalculator() {
  const [initialBalance, setInitialBalance] = usePersistedState('savings_initialBalance', 1000);
  const [annualRate, setAnnualRate] = usePersistedState('savings_annualRate', 4.5);
  const [years, setYears] = usePersistedState('savings_years', 5);
  const [compoundFrequency, setCompoundFrequency] = usePersistedState('savings_compoundFrequency', 'monthly');
  const [defaultMonthlyContribution, setDefaultMonthlyContribution] = usePersistedState('savings_defaultMonthlyContribution', 200);
  const [monthlyContributions, setMonthlyContributions] = usePersistedState('savings_monthlyContributions', Array(12).fill(200));

  const projectionData = useMemo(() => {
    const data = [];
    let balance = initialBalance;
    const periodsPerYear = FREQUENCIES[compoundFrequency];
    const ratePerPeriod = annualRate / 100 / periodsPerYear;

    let monthCount = 1;

    for (let year = 1; year <= years; year++) {
      for (let month = 1; month <= 12; month++) {
        const contribution = monthlyContributions[month - 1] ?? defaultMonthlyContribution;

        balance += contribution;

        let interest = 0;
        if (
          compoundFrequency === 'monthly' ||
          (compoundFrequency === 'quarterly' && month % 3 === 0) ||
          (compoundFrequency === 'annually' && month === 12)
        ) {
          interest = balance * ratePerPeriod;
          balance += interest;
        }

        data.push({
          year,
          month,
          monthLabel: `Month ${monthCount++}`,
          contribution,
          interest,
          balance
        });
      }
    }

    return data;
  }, [initialBalance, annualRate, years, compoundFrequency, monthlyContributions, defaultMonthlyContribution]);

  const totalContributions = useMemo(
    () => projectionData.reduce((sum, row) => sum + row.contribution, 0),
    [projectionData]
  );

  const totalInterest = useMemo(
    () => projectionData.reduce((sum, row) => sum + row.interest, 0),
    [projectionData]
  );

  const finalBalance = projectionData[projectionData.length - 1]?.balance || 0;

  const handleDefaultContributionChange = (newValue) => {
    setDefaultMonthlyContribution(newValue);
    setMonthlyContributions(Array(12).fill(newValue));
  };

  const handleIndividualMonthChange = (month, newValue) => {
    setMonthlyContributions((current) => {
      const next = [...current];
      next[month - 1] = newValue;
      return next;
    });
  };

  const exportToCSV = () => {
    const headers = ['Year', 'Month', 'Monthly Contribution', 'Interest Earned', 'Balance'];
    const rows = projectionData.map((row) => [
      row.year,
      row.month,
      row.contribution.toFixed(2),
      row.interest.toFixed(2),
      row.balance.toFixed(2)
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'savings_projection.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-8">Savings Projection</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-700 mb-4">Settings</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Initial Balance (£)
                </label>
                <NumericField
                  value={initialBalance}
                  onCommit={setInitialBalance}
                  decimals={2}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Annual Interest Rate (%)
                </label>
                <NumericField
                  value={annualRate}
                  onCommit={setAnnualRate}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Projection Period (Years)
                </label>
                <NumericField
                  value={years}
                  onCommit={setYears}
                  allowDecimal={false}
                  min={1}
                  max={30}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Compounding Frequency
                </label>
                <select
                  value={compoundFrequency}
                  onChange={(e) => setCompoundFrequency(e.target.value)}
                  className={inputClass}
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
                <NumericField
                  value={defaultMonthlyContribution}
                  onCommit={handleDefaultContributionChange}
                  decimals={2}
                  className={inputClass}
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
                <div className="text-2xl font-bold text-blue-600">{formatGBP(initialBalance)}</div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600">Total Contributions</div>
                <div className="text-2xl font-bold text-green-600">{formatGBP(totalContributions)}</div>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600">Total Interest Earned</div>
                <div className="text-2xl font-bold text-purple-600">{formatGBP(totalInterest)}</div>
              </div>

              <div className="bg-indigo-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600">Final Balance</div>
                <div className="text-2xl font-bold text-indigo-600">{formatGBP(finalBalance)}</div>
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
            <h2 className="text-2xl font-semibold text-gray-700">Projection Details</h2>
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
                    <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900">
                      {row.monthLabel}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-sm text-right text-gray-900">
                      <NumericField
                        value={monthlyContributions[row.month - 1] ?? defaultMonthlyContribution}
                        onCommit={(v) => handleIndividualMonthChange(row.month, v)}
                        decimals={2}
                        className="w-24 px-2 py-1 text-right border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-sm text-right text-purple-600">
                      £{row.interest.toFixed(2)}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-sm text-right font-medium text-gray-900">
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