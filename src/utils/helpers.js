function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function formatCost(tokens, model, settings) {
  const rates = settings?.costRates || {};
  const perMillion = rates[model] ?? rates['_default'] ?? 2;
  return tokens * (perMillion / 1000000);
}

module.exports = {
  debounce,
  formatCost
};
