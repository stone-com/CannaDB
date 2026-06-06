// Checks whether Mongo rejected transactions because the current setup does not support them.
function isTransactionUnsupported(error) {
  const message = String(error?.message || "");
  return (
    message.includes("Transaction numbers are only allowed") ||
    message.includes("does not support transactions")
  );
}

// Runs a block of database work inside a transaction when possible.
// If the database does not support transactions, it runs the same work once without one.
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
  isTransactionUnsupported,
  runWithOptionalTransaction,
};
