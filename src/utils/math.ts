export const poissonProbability = (lambda: number, goals: number): number => {
  if (goals < 0) return 0;
  return (Math.pow(lambda, goals) * Math.exp(-lambda)) / factorial(goals);
};

const factorial = (n: number): number => {
  if (n <= 1) return 1;
  let res = 1;
  for (let i = 2; i <= n; i += 1) {
    res *= i;
  }
  return res;
};

export const clampProbability = (value: number, min = 0.01, max = 0.97): number => {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
};
