export const getShortErrorMessage = (message: string): string => {
  const userRejectedMatch = message.match(/User rejected the request/i);
  if (userRejectedMatch) {
    return "You rejected the transaction.";
  }

  const insufficientFundsMatch = message.match(/insufficient funds/i);
  if (insufficientFundsMatch) {
    return "You have insufficient funds to complete this transaction.";
  }

  const revertMatch = message.match(/reverted with the following reason:\s*(.*)/);
  if (revertMatch && revertMatch[1]) {
    return revertMatch[1];
  }

  const executionRevertedMatch = message.match(/execution reverted: (.*)/i);
  if (executionRevertedMatch && executionRevertedMatch[1]) {
    return executionRevertedMatch[1];
  }

  return message;
};
