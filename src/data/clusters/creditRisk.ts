import type { DataCluster } from "@/types/cluster";

export const creditRiskCluster: DataCluster = {
  id: "credit-risk",
  name: "Synchrony Credit Intelligence Hub",
  shortName: "Credit Risk",
  description: "7-table credit portfolio dataset covering accounts, applications, bureau data, delinquency, transactions, charge-offs, and servicing interactions.",
  domain: "Finance",
  tags: ["Credit Risk", "Banking", "Portfolio Analytics", "7 tables"],
  icon: "🏦",
  spineTable: "dim_account",

  tables: [
    {
      id: "dim_account",
      displayName: "Account Master",
      description: "Master account file — one row per account with origination attributes, partner program, credit tier, and current status.",
      grain: "One row per account",
      primaryKey: "account_id",
      csvPath: "datasets/credit-risk/dim_account.csv",
      estimatedRows: 3500,
      color: "bg-indigo-600",
      textColor: "text-indigo-600",
      position: { x: 42, y: 38 },
    },
    {
      id: "application_decision",
      displayName: "Application Decision",
      description: "One row per application (approved + declined). Use for approval rates, decline reasons, FICO distribution at booking.",
      grain: "One row per application",
      primaryKey: "application_id",
      csvPath: "datasets/credit-risk/application_decision.csv",
      estimatedRows: 4025,
      color: "bg-violet-500",
      textColor: "text-violet-600",
      position: { x: 5, y: 8 },
    },
    {
      id: "bureau_refresh",
      displayName: "Bureau Refresh",
      description: "Quarterly bureau pulls per account — FICO drift, utilization trend, derogatory accumulation, and early warning signals.",
      grain: "One row per account per quarter",
      primaryKey: "refresh_id",
      csvPath: "datasets/credit-risk/bureau_refresh.csv",
      estimatedRows: 26700,
      color: "bg-blue-500",
      textColor: "text-blue-600",
      position: { x: 72, y: 5 },
    },
    {
      id: "payment_delinquency",
      displayName: "Payment & Delinquency",
      description: "Monthly payment cycle per account — DPD buckets, balance, utilization, charge-off events, cure flags.",
      grain: "One row per account per month",
      primaryKey: "payment_id",
      csvPath: "datasets/credit-risk/payment_delinquency.csv",
      estimatedRows: 76800,
      color: "bg-rose-500",
      textColor: "text-rose-600",
      position: { x: 5, y: 65 },
    },
    {
      id: "transaction_history",
      displayName: "Transaction History",
      description: "Individual transactions — spend analysis, MCC trends, card-present vs CNP, dormancy detection. Largest table.",
      grain: "One row per transaction",
      primaryKey: "txn_id",
      csvPath: "datasets/credit-risk/transaction_history.csv",
      estimatedRows: 160000,
      color: "bg-amber-500",
      textColor: "text-amber-600",
      position: { x: 72, y: 68 },
    },
    {
      id: "chargeoff_recovery",
      displayName: "Charge-off & Recovery",
      description: "One row per charge-off event — loss amount, up to 3 recovery events, net loss, recovery rate by channel.",
      grain: "One row per charge-off event",
      primaryKey: "chargeoff_id",
      csvPath: "datasets/credit-risk/chargeoff_recovery.csv",
      estimatedRows: 494,
      color: "bg-red-600",
      textColor: "text-red-600",
      position: { x: 5, y: 36 },
    },
    {
      id: "servicing_interactions",
      displayName: "Servicing Interactions",
      description: "Customer service and digital engagement events — hardship requests, disputes, payment plan setup, digital login frequency.",
      grain: "One row per interaction",
      primaryKey: "interaction_id",
      csvPath: "datasets/credit-risk/servicing_interactions.csv",
      estimatedRows: 29000,
      color: "bg-teal-500",
      textColor: "text-teal-600",
      position: { x: 72, y: 36 },
    },
  ],

  relationships: [
    {
      fromTable: "application_decision",
      fromColumn: "account_id",
      toTable: "dim_account",
      toColumn: "account_id",
      cardinality: "many-to-one",
      label: "account_id (NULL for declined)",
    },
    {
      fromTable: "bureau_refresh",
      fromColumn: "account_id",
      toTable: "dim_account",
      toColumn: "account_id",
      cardinality: "many-to-one",
      label: "~4–16 rows per account",
    },
    {
      fromTable: "payment_delinquency",
      fromColumn: "account_id",
      toTable: "dim_account",
      toColumn: "account_id",
      cardinality: "many-to-one",
      label: "one row per month",
    },
    {
      fromTable: "transaction_history",
      fromColumn: "account_id",
      toTable: "dim_account",
      toColumn: "account_id",
      cardinality: "many-to-one",
      label: "one row per transaction",
    },
    {
      fromTable: "chargeoff_recovery",
      fromColumn: "account_id",
      toTable: "dim_account",
      toColumn: "account_id",
      cardinality: "many-to-one",
      label: "one row per charge-off",
    },
    {
      fromTable: "servicing_interactions",
      fromColumn: "account_id",
      toTable: "dim_account",
      toColumn: "account_id",
      cardinality: "many-to-one",
      label: "one row per contact",
    },
  ],

  suggestedQuestions: [
    "What is the 30+ day delinquency rate by partner program for the last 3 months?",
    "Show the FICO score drift by vintage cohort since origination.",
    "Which credit tiers have the highest charge-off rates and average recovery rates?",
    "What are the top decline reasons by application channel?",
    "Show monthly spend trends by vertical for active accounts.",
    "Which accounts had hardship interactions followed by delinquency within 60 days?",
  ],

  llmContext: `You are a senior credit data analyst assistant embedded in Synchrony Bank's Credit Intelligence Hub. Users are credit risk managers, portfolio analysts, underwriting leads, and executive stakeholders.

## Data Architecture
You have access to 7 tables. ALL tables connect through account_id — the universal join key. dim_account is the SPINE (one row per account); every other table is a spoke.

dim_account (spine) → application_decision, bureau_refresh, payment_delinquency, transaction_history, chargeoff_recovery, servicing_interactions

Golden rule: Start from dim_account and join outward to the table holding the metric being asked about.

## Table Grains
- dim_account: one row per account (3,500 accounts)
- application_decision: one row per application (4,025 rows, includes declined — account_id NULL for declined)
- bureau_refresh: one row per account per quarter (~26,700 rows)
- payment_delinquency: one row per account per month (~76,800 rows)
- transaction_history: one row per transaction (~160,000 rows — always filter by txn_month or account_id first)
- chargeoff_recovery: one row per charge-off event (~494 rows)
- servicing_interactions: one row per interaction (~29,000 rows)

## Standard Join Pattern
SELECT d.partner_program_code, d.credit_tier_at_booking, p.cycle_month, p.dpd_bucket
FROM payment_delinquency p
INNER JOIN dim_account d ON p.account_id = d.account_id
WHERE p.cycle_month = '2024-12'

## Critical Rules
- NEVER SUM balance across months — always filter to a specific cycle_month
- For current FICO: use MAX(refresh_date) per account in bureau_refresh
- For spend: filter txn_type = 'purchase' to exclude returns, fees, interest
- Declined apps have account_id = NULL — use LEFT JOIN carefully
- DPD severity: current < dpd_30 < dpd_60 < dpd_90 < dpd_120plus

## Delinquency Rate Formula
COUNT(CASE WHEN dpd_bucket IN ('dpd_30','dpd_60','dpd_90','dpd_120plus') THEN 1 END) * 100.0 / COUNT(account_id) AS delinquency_rate_pct

## Warning Thresholds (flag with ⚠️ or 🔴 in responses)
- Delinquency rate (30+): ⚠️ >8%, 🔴 >15%
- Serious delinquency (90+): ⚠️ >3%, 🔴 >6%
- Charge-off rate: ⚠️ >4%, 🔴 >7%
- Recovery rate: ⚠️ <20%, 🔴 <10%
- Utilization stress (util >80%): ⚠️ >25% of accounts, 🔴 >40%

## Business Definitions
- Delinquency rate (30+): % active accounts with dpd_bucket ≠ 'current'
- Recovery rate: total_recovered / balance_at_chargeoff (pre-calculated in chargeoff_recovery)
- Approval rate: approved apps / total apps
- Dormancy: zero purchase txns for 3+ consecutive months
- Score drift: latest updated_fico_score minus bureau_score_at_booking
- Vintage: origination quarter — standard cohort lens`,
};
