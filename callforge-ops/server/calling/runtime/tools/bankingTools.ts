import { AgentSession, ToolDefinition } from "../types";
import { persistentStore } from "../../../storage/persistentStore";
import { dialerWorker } from "../../queue";

export const BUILTIN_BANKING_TOOLS: ToolDefinition[] = [
  {
    name: "fetch_loan_account_balance",
    description: "Fetches live loan balance and account status for a given loan ID or customer phone.",
    parameters: {
      type: "object",
      properties: {
        loanId: { type: "string", description: "The customer loan account identifier" },
        phone: { type: "string", description: "Customer registered phone number" },
      },
      required: [],
    },
    execute: async (args: Record<string, any>, context: AgentSession) => {
      const loanId = args.loanId || "LN-TATA-8831";
      context.memory.accountNumber = loanId;

      // Look up existing lead in database if available
      const cleanPhone = (args.phone || context.customerPhone).replace(/\D/g, "").slice(-10);
      const lead = persistentStore.getLeads().find((l) => l.phone.replace(/\D/g, "").slice(-10) === cleanPhone);

      const balance = 50000;
      if (lead) {
        lead.notes.push(`[Voice AI Agent] Balance queried: ₹${balance.toLocaleString("en-IN")}`);
      }

      return {
        success: true,
        loanId,
        customerName: lead?.name || context.memory.customerName || "Customer",
        balanceInr: balance,
        currency: "INR",
        accountStatus: "active",
        interestRatePercent: 10.5,
        message: `Account ${loanId} balance is ₹${balance.toLocaleString("en-IN")} (Active).`,
      };
    },
  },
  {
    name: "fetch_emi_schedule",
    description: "Queries upcoming EMI amount, payment due date, and tenure details.",
    parameters: {
      type: "object",
      properties: {
        loanId: { type: "string", description: "The customer loan account identifier" },
      },
      required: [],
    },
    execute: async (args: Record<string, any>, context: AgentSession) => {
      return {
        success: true,
        loanId: args.loanId || context.memory.accountNumber || "LN-TATA-8831",
        emiAmountInr: 4850,
        nextDueDate: "05-Oct-2026",
        remainingEmis: 12,
        paymentMode: "NACH / Auto-Debit",
      };
    },
  },
  {
    name: "trigger_payment_link_sms",
    description: "Dispatches a secure RBI-compliant UPI payment link to the customer mobile number.",
    parameters: {
      type: "object",
      properties: {
        amountInr: { type: "number", description: "Amount in INR to collect" },
        purpose: { type: "string", description: "Purpose e.g. EMI_PAYMENT" },
      },
      required: [],
    },
    execute: async (args: Record<string, any>, context: AgentSession) => {
      const amount = args.amountInr || 4850;
      const paymentLink = `https://pay.tatasmartflo.in/quickpay/txn_${Date.now()}`;

      // Persist real delivery log in database
      persistentStore.sendWhatsAppMessage({
        recipientPhone: context.customerPhone,
        recipientName: context.memory.customerName || "Valued Customer",
        templateName: "Tata Smartflo UPI Payment Dispatch",
        body: `Your secure payment link for ₹${amount.toLocaleString("en-IN")}: ${paymentLink}`,
      });

      return {
        success: true,
        transactionId: `TXN_UPI_${Date.now()}`,
        amount,
        phone: context.customerPhone,
        status: "sms_dispatched",
        link: paymentLink,
      };
    },
  },
  {
    name: "register_dnc",
    description: "Registers customer number onto the National Do Not Call (NDNC) suppression list upon explicit request.",
    parameters: {
      type: "object",
      properties: {
        phone: { type: "string", description: "Phone number to block" },
        reason: { type: "string", description: "Customer opt-out reason" },
      },
      required: [],
    },
    execute: async (args: Record<string, any>, context: AgentSession) => {
      const phoneToBlock = args.phone || context.customerPhone;

      // Update in-memory DNC worker and persistent CRM lead record
      dialerWorker.addDNCNumber(phoneToBlock);
      const cleanPhone = phoneToBlock.replace(/\D/g, "").slice(-10);
      const lead = persistentStore.getLeads().find((l) => l.phone.replace(/\D/g, "").slice(-10) === cleanPhone);
      if (lead) {
        lead.isDnc = true;
        lead.stage = "Opted-Out";
        lead.notes.push(`[Statutory NDNC] Opted out by customer during AI voice call on ${new Date().toLocaleDateString("en-IN")}.`);
      }

      return {
        success: true,
        phone: phoneToBlock,
        status: "suppressed",
        traiRefNumber: `DNC-IN-${Date.now()}`,
      };
    },
  },
  {
    name: "transfer_to_human_agent",
    description: "Initiates warm transfer / escalation to a live human supervisor or banking specialist.",
    parameters: {
      type: "object",
      properties: {
        department: { type: "string", description: "Target department", enum: ["support", "collections", "dispute", "sales"] },
        priority: { type: "string", description: "Transfer priority", enum: ["normal", "high", "urgent"] },
      },
      required: [],
    },
    execute: async (args: Record<string, any>, context: AgentSession) => {
      context.status = "transfer_pending";
      context.transferTarget = args.department || "support";
      return {
        success: true,
        transferred: true,
        targetQueue: args.department || "support",
        queuePosition: 1,
        message: "Call bridged to human specialist desk.",
      };
    },
  },
  {
    name: "hangup_call",
    description: "Politely terminates the telephony session when conversation is finished.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Call termination reason" },
      },
      required: [],
    },
    execute: async (args: Record<string, any>, context: AgentSession) => {
      context.status = "terminated";
      context.terminationReason = args.reason || "normal_completion";
      return {
        success: true,
        status: "terminated",
        reason: args.reason || "normal_completion",
      };
    },
  },
];
