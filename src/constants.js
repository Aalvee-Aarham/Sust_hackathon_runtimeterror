const TRANSACTION_TYPES = [
    "transfer",
    "payment",
    "cash_in",
    "cash_out",
    "settlement",
    "refund"
  ];
  
  const TRANSACTION_STATUS = [
    "completed",
    "failed",
    "pending",
    "reversed"
  ];
  
  const CASE_TYPES = [
    "wrong_transfer",
    "payment_failed",
    "refund_request",
    "duplicate_payment",
    "merchant_settlement_delay",
    "agent_cash_in_issue",
    "phishing_or_social_engineering",
    "other"
  ];
  
  const DEPARTMENTS = {
    wrong_transfer: "dispute_resolution",
    payment_failed: "payments_ops",
    refund_request: "customer_support",
    duplicate_payment: "payments_ops",
    merchant_settlement_delay: "merchant_operations",
    agent_cash_in_issue: "agent_operations",
    phishing_or_social_engineering: "fraud_risk",
    other: "customer_support"
  };
  
  module.exports = {
    TRANSACTION_TYPES,
    TRANSACTION_STATUS,
    CASE_TYPES,
    DEPARTMENTS
  };