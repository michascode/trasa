export type OptimizationInput = {
  vehicles: number;
  stops: number;
};

export async function runOptimizationStub(input: OptimizationInput) {
  return {
    status: 'STUB',
    acceptedInput: input,
    message: 'Route optimizer is not implemented yet.',
  };
}
