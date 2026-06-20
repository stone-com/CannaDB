/**
 * Helpers for running database work inside a transaction when MongoDB supports it.
 */

// Returns true when this MongoDB setup cannot use transactions (common on local dev).
function isTransactionUnsupported(error) {
  const message = String(error?.message || "");
  return (
    message.includes("Transaction numbers are only allowed") ||
    message.includes("does not support transactions")
  );
}

// Runs work(session) inside a transaction when possible, otherwise runs it once without one.
async function runWithOptionalTransaction(mongoose, work) {
  const session = await mongoose.startSession();

  try {
    let result;
    let callbackStarted = false;

    try {
      await session.withTransaction(async () => {
        callbackStarted = true;
        result = await work(session);
      });
    } catch (error) {
      if (!isTransactionUnsupported(error) || callbackStarted) {
        throw error;
      }

      result = await work(null);
    }

    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = {
  runWithOptionalTransaction,
};
