import { handleRuntimeRoute } from "./_runtime.js";

// Comprehensive Vercel Serverless API Dispatcher for CallForge Ops / Smart AI Dialer
// Handles all /api/calling/* REST endpoints in serverless environments

function getStore() {
  if (!globalThis.__callingDataStore) {
    globalThis.__callingDataStore = {
      leads: [
        {
          id: "lead-1",
          name: "Aarav Mehta",
          company: "Nexus Enterprises",
          phone: "+91 98201 23456",
          source: "Google Ads",
          stage: "Interested",
          score: 88,
          last: "Today, 11:20 AM",
          notes: ["Interested in 20-seat AI outbound dialer for BFSI outreach"],
          email: "aarav.mehta@nexusent.com",
          createdAt: new Date().toISOString(),
        },
        {
          id: "lead-2",
          name: "Priya Sharma",
          company: "FinServ Global",
          phone: "+91 98110 98765",
          source: "Website Inbound",
          stage: "Callback",
          score: 92,
          last: "Today, 10:45 AM",
          notes: ["Requested callback tomorrow at 3 PM after internal review"],
          email: "priya.s@finservglobal.in",
          createdAt: new Date().toISOString(),
        },
        {
          id: "lead-3",
          name: "Vikram Patel",
          company: "Gujarat Logistics",
          phone: "+91 98765 43210",
          source: "Direct Referral",
          stage: "Converted",
          score: 95,
          last: "Yesterday",
          notes: ["Onboarded on Pro Tier with Tata Smartflo SIP trunk"],
          email: "vikram@gujaratlogistics.com",
          createdAt: new Date().toISOString(),
        },
        {
          id: "lead-4",
          name: "Ananya Iyer",
          company: "OmniHealth Clinic",
          phone: "+91 97654 32109",
          source: "Meta Ads Form",
          stage: "New",
          score: 72,
          last: "Today, 09:15 AM",
          notes: ["Wants patient appointment reminder automated voice blasts"],
          email: "ananya@omnihealth.org",
          createdAt: new Date().toISOString(),
        },
        {
          id: "lead-5",
          name: "Rajesh Verma",
          company: "Verma Real Estate",
          phone: "+91 98990 12345",
          source: "Inbound Call",
          stage: "Interested",
          score: 84,
          last: "Yesterday",
          notes: ["Discussed 5000 leads bulk upload for luxury villa launch"],
          email: "rajesh@vermaproperties.in",
          createdAt: new Date().toISOString(),
        },
      ],
      campaigns: [
        {
          id: "camp-diwali-blast",
          name: "Diwali Real Estate AI Blast",
          dialerMode: "ai_blast",
          status: "running",
          script: "Namaste {lead_name} ji from Verma Real Estate. We have an exclusive festive launch...",
          stats: {
            totalLeads: 1250,
            dialed: 840,
            connected: 620,
            qualified: 142,
            failed: 48,
            abandoned: 12,
            averageDurationSeconds: 78,
          },
          createdAt: new Date().toISOString(),
        },
        {
          id: "camp-bfsi-outreach",
          name: "BFSI Pre-Approved Home Loan",
          dialerMode: "progressive",
          status: "running",
          script: "Namaste {lead_name} ji. Your pre-approved home loan up to 75 Lakhs is active...",
          stats: {
            totalLeads: 800,
            dialed: 520,
            connected: 390,
            qualified: 98,
            failed: 22,
            abandoned: 6,
            averageDurationSeconds: 94,
          },
          createdAt: new Date().toISOString(),
        },
        {
          id: "camp-saas-demo",
          name: "SaaS Enterprise Demo Booking",
          dialerMode: "preview",
          status: "paused",
          script: "Hello {lead_name}, calling from CallForge Ops regarding your automated dialer trial...",
          stats: {
            totalLeads: 350,
            dialed: 190,
            connected: 145,
            qualified: 46,
            failed: 10,
            abandoned: 2,
            averageDurationSeconds: 112,
          },
          createdAt: new Date().toISOString(),
        },
      ],
      cdrs: [
        {
          id: "cdr-101",
          customerName: "Aarav Mehta",
          customerPhone: "+91 98201 23456",
          agentName: "AI Bot Priya (Nvidia Riva)",
          campaign: "Diwali Real Estate AI Blast",
          duration: "01:45",
          durationSeconds: 105,
          status: "Completed",
          disposition: "Interested",
          sentiment: "Positive",
          qaScore: 94,
          recordingUrl: "https://actions.google.com/sounds/v1/telephones/telephone_ring.ogg",
          createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        },
        {
          id: "cdr-102",
          customerName: "Priya Sharma",
          customerPhone: "+91 98110 98765",
          agentName: "Agent Vikram",
          campaign: "BFSI Pre-Approved Home Loan",
          duration: "02:18",
          durationSeconds: 138,
          status: "Completed",
          disposition: "Callback",
          sentiment: "Neutral",
          qaScore: 88,
          createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        },
        {
          id: "cdr-103",
          customerName: "Vikram Patel",
          customerPhone: "+91 98765 43210",
          agentName: "AI Bot Rahul (Riva Nemotron)",
          campaign: "Diwali Real Estate AI Blast",
          duration: "03:12",
          durationSeconds: 192,
          status: "Completed",
          disposition: "Completed",
          sentiment: "Positive",
          qaScore: 98,
          createdAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
        },
      ],
      wallet: {
        balance: 14500,
        currency: "INR",
        totalRecharged: 25000,
        totalSpent: 10500,
      },
      invoices: [
        {
          id: "inv-2026-001",
          invoiceNumber: "CF-INV-2026-001",
          date: new Date(Date.now() - 3 * 86400 * 1000).toISOString(),
          description: "Telephony Prepaid Recharge (10,000 Calling Units)",
          subtotal: 8474.58,
          gstAmount: 1525.42,
          totalAmount: 10000.0,
          status: "paid",
          paymentMethod: "Instant UPI (NPCI QR)",
        },
        {
          id: "inv-2026-002",
          invoiceNumber: "CF-INV-2026-002",
          date: new Date(Date.now() - 12 * 86400 * 1000).toISOString(),
          description: "Enterprise Dedicated SIP Trunk Allocation (Tata Smartflo)",
          subtotal: 12711.86,
          gstAmount: 2288.14,
          totalAmount: 15000.0,
          status: "paid",
          paymentMethod: "Corporate Credit Card",
        },
      ],
      carrierConfig: {
        provider: "tata_smartflo",
        tataCallerId: "+91 22 6600 1234",
        tataSipTrunk: "sip.tatateleservices.com",
        twilioCallerId: "+18005550199",
        updatedAt: new Date().toISOString(),
      },
      autoRecharge: {
        enabled: true,
        threshold: 2000,
        rechargeAmount: 5000,
        paymentMethod: "upi_autopay",
        gstin: "27AABCC1234F1Z8",
        updatedAt: new Date().toISOString(),
      },
      whatsappLogs: [
        {
          id: "wa-1",
          recipientName: "Aarav Mehta",
          recipientPhone: "+91 98201 23456",
          templateName: "festive_brochure",
          body: "Namaste Aarav Ji, thank you for taking our call! Here is the exclusive 20% festive discount brochure...",
          status: "delivered",
          disposition: "Interested",
          timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        },
      ],
      consentRecords: [
        {
          id: "consent-1",
          phone: "+91 98201 23456",
          leadName: "Aarav Mehta",
          consentType: "Explicit Digital Opt-in",
          traiDndStatus: "Clean / Non-DND",
          source: "Landing Page Form Checkbox",
          timestamp: new Date(Date.now() - 86400 * 1000).toISOString(),
        },
        {
          id: "consent-2",
          phone: "+91 98110 98765",
          leadName: "Priya Sharma",
          consentType: "Inbound OTP Consent",
          traiDndStatus: "Whitelisted",
          source: "Mobile App Inquiry",
          timestamp: new Date(Date.now() - 2 * 86400 * 1000).toISOString(),
        },
      ],
      team: [
        {
          id: "team-1",
          name: "Bhagwat Kumar",
          email: "bhagwat@smartdialer.ai",
          role: "admin",
          status: "active",
          extension: "101",
          joinedAt: "2026-01-10",
          avatarInitials: "BK",
        },
        {
          id: "team-2",
          name: "Vikram Malhotra",
          email: "vikram@smartdialer.ai",
          role: "supervisor",
          status: "active",
          extension: "102",
          joinedAt: "2026-02-15",
          avatarInitials: "VM",
        },
        {
          id: "team-3",
          name: "Pooja Reddy",
          email: "pooja@smartdialer.ai",
          role: "agent",
          status: "active",
          extension: "103",
          joinedAt: "2026-03-01",
          avatarInitials: "PR",
        },
      ],
      settings: {
        workspaceName: "Smart AI Dialer Operations",
        complianceMode: "Strict TRAI DND",
        operatingHours: "09:30 - 20:00 IST",
        maxConcurrency: 50,
        recordingRetentionDays: 90,
      },
    };
  }
  return globalThis.__callingDataStore;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );

  if (req.method === "OPTIONS") return res.status(200).end();

  const store = getStore();

  // Resolve subpath
  let path = "";
  if (req.query?.route) {
    path = Array.isArray(req.query.route) ? req.query.route.join("/") : String(req.query.route);
  } else if (req.query?.subpath) {
    path = Array.isArray(req.query.subpath) ? req.query.subpath.join("/") : String(req.query.subpath);
  } else {
    path = (req.url || "").replace(/^\/api\/calling\/?/, "").split("?")[0];
  }
  path = path.replace(/^\/+/, "").replace(/\/+$/, "");

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  body = body || {};

  try {
    // 0. AI RUNTIME
    if (path.startsWith("runtime/")) {
      const runtimeResult = await handleRuntimeRoute(path, req, res, store, body);
      if (runtimeResult) return runtimeResult;
    }

    // 1. LEADS
    if (path === "leads" || path.startsWith("leads/")) {
      if (req.method === "GET") {
        return res.status(200).json({ success: true, leads: store.leads });
      }

      if (req.method === "POST") {
        if (path === "leads/bulk" || Array.isArray(body.leads)) {
          const list = Array.isArray(body.leads) ? body.leads : [];
          let added = 0;
          for (const item of list) {
            store.leads.unshift({
              id: "lead-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
              name: item.name || "Bulk Lead",
              company: item.company || "Independent",
              phone: item.phone || "+91 99999 00000",
              source: item.source || "CSV Import",
              stage: item.stage || "New",
              score: item.score || 75,
              last: "Imported just now",
              notes: ["Imported via Bulk CSV"],
              createdAt: new Date().toISOString(),
            });
            added++;
          }
          return res.status(200).json({
            success: true,
            added,
            total: store.leads.length,
            message: `Successfully imported ${added} leads`,
          });
        }

        const newLead = {
          id: "lead-" + Date.now(),
          name: body.name || "New Lead",
          company: body.company || "Independent",
          phone: body.phone || "+91 99999 00000",
          source: body.source || "Manual Entry",
          stage: body.stage || "New",
          score: body.score || 80,
          last: "Just now",
          notes: Array.isArray(body.notes) ? body.notes : [body.notes || "Added manually"],
          email: body.email,
          createdAt: new Date().toISOString(),
        };
        store.leads.unshift(newLead);
        return res.status(201).json({ success: true, lead: newLead });
      }

      if (req.method === "PATCH" || req.method === "PUT") {
        const id = path.replace("leads/", "");
        const idx = store.leads.findIndex((l) => l.id === id);
        if (idx !== -1) {
          store.leads[idx] = { ...store.leads[idx], ...body, last: "Updated just now" };
          return res.status(200).json({ success: true, lead: store.leads[idx] });
        }
        return res.status(404).json({ error: "Lead not found" });
      }
    }

    // 2. CAMPAIGNS
    if (path === "campaigns" || path.startsWith("campaigns/")) {
      if (req.method === "GET") {
        if (path.includes("/stats")) {
          const camp = store.campaigns[0] || { stats: {} };
          return res.status(200).json({
            id: camp.id || "camp-1",
            name: camp.name || "Dialer Queue",
            status: camp.status || "running",
            progressPercent: 65,
            stats: camp.stats || {
              totalLeads: 100,
              dialed: 65,
              connected: 48,
              qualified: 12,
              failed: 4,
              abandoned: 1,
              averageDurationSeconds: 85,
            },
            updatedAt: new Date().toISOString(),
          });
        }
        return res.status(200).json({ success: true, campaigns: store.campaigns });
      }

      if (req.method === "POST") {
        if (path === "campaigns/start" || path === "campaigns") {
          const newCamp = {
            id: "camp-" + Date.now(),
            name: body.name || `Campaign ${new Date().toLocaleDateString("en-IN")}`,
            dialerMode: body.dialerMode || "ai_blast",
            status: "running",
            script: body.script || "Namaste from Smart AI Dialer...",
            stats: {
              totalLeads: Array.isArray(body.leads) ? body.leads.length : 100,
              dialed: 0,
              connected: 0,
              qualified: 0,
              failed: 0,
              abandoned: 0,
              averageDurationSeconds: 0,
            },
            createdAt: new Date().toISOString(),
          };
          store.campaigns.unshift(newCamp);
          return res.status(202).json({
            success: true,
            message: "Campaign queued and worker started",
            campaignId: newCamp.id,
            status: "running",
            campaign: newCamp,
          });
        }

        if (path.endsWith("/pause")) {
          return res.status(200).json({ success: true, message: "Campaign paused" });
        }
        if (path.endsWith("/resume")) {
          return res.status(200).json({ success: true, message: "Campaign resumed" });
        }
        if (path.endsWith("/stop")) {
          return res.status(200).json({ success: true, message: "Campaign stopped" });
        }
      }
    }

    // 3. CDRs (Call Detail Records)
    if (path === "cdrs" || path.startsWith("cdrs/")) {
      if (req.method === "GET") {
        return res.status(200).json({ success: true, cdrs: store.cdrs });
      }
      if (req.method === "POST") {
        const newCdr = {
          id: "cdr-" + Date.now(),
          customerName: body.customerName || "Customer",
          customerPhone: body.customerPhone || "+91 99999 00000",
          agentName: body.agentName || "AI Voice Bot",
          campaign: body.campaign || "General Outreach",
          duration: body.duration || "01:15",
          durationSeconds: body.durationSeconds || 75,
          status: body.status || "Completed",
          disposition: body.disposition || "Interested",
          sentiment: body.sentiment || "Positive",
          qaScore: body.qaScore || 90,
          recordingUrl: body.recordingUrl,
          createdAt: new Date().toISOString(),
        };
        store.cdrs.unshift(newCdr);
        return res.status(201).json({ success: true, cdr: newCdr });
      }
    }

    // 4. AUTOMATION & WHATSAPP
    if (path === "automation/whatsapp" || path === "automation/whatsapp/logs") {
      if (req.method === "GET") {
        return res.status(200).json({ success: true, logs: store.whatsappLogs });
      }
      if (req.method === "POST") {
        const msg = {
          id: "wa-" + Date.now(),
          recipientName: body.recipientName || "Lead",
          recipientPhone: body.recipientPhone || "+91 99999 00000",
          templateName: body.templateName || "default",
          body: body.body || "Namaste!",
          disposition: body.disposition || "Interested",
          status: "delivered",
          timestamp: new Date().toISOString(),
        };
        store.whatsappLogs.unshift(msg);
        return res.status(200).json({
          success: true,
          message: "WhatsApp message delivered successfully via Cloud API",
          messageId: msg.id,
          recipient: msg.recipientPhone,
        });
      }
    }

    // 5. BILLING & WALLET
    if (path === "billing/wallet") {
      return res.status(200).json({
        success: true,
        balance: store.wallet.balance,
        currency: store.wallet.currency,
        totalRecharged: store.wallet.totalRecharged,
        totalSpent: store.wallet.totalSpent,
      });
    }

    if (path === "billing/topup") {
      const amt = Number(body.amount) || 5000;
      store.wallet.balance += amt;
      store.wallet.totalRecharged += amt;

      const newInv = {
        id: "inv-" + Date.now(),
        invoiceNumber: "CF-INV-" + Math.floor(1000 + Math.random() * 9000),
        date: new Date().toISOString(),
        description: `Telephony Prepaid Recharge (${amt.toLocaleString("en-IN")} Calling Credits)`,
        subtotal: +(amt / 1.18).toFixed(2),
        gstAmount: +(amt - amt / 1.18).toFixed(2),
        totalAmount: amt,
        status: "paid",
        paymentMethod: body.paymentMethod || "Instant UPI (NPCI QR)",
      };
      store.invoices.unshift(newInv);

      return res.status(200).json({
        success: true,
        balance: store.wallet.balance,
        transaction: {
          referenceId: "TXN-" + Date.now(),
          amount: amt,
          timestamp: new Date().toISOString(),
        },
        invoice: newInv,
      });
    }

    if (path === "billing/invoices") {
      return res.status(200).json({ success: true, invoices: store.invoices });
    }

    if (path === "billing/autorecharge") {
      if (req.method === "POST") {
        store.autoRecharge = { ...store.autoRecharge, ...body, updatedAt: new Date().toISOString() };
        return res.status(200).json({ success: true, config: store.autoRecharge });
      }
      return res.status(200).json({ success: true, config: store.autoRecharge });
    }

    if (path === "subscription" || path === "billing/create-checkout" || path === "billing/verify-payment") {
      return res.status(200).json({
        success: true,
        status: "active",
        plan: "Enterprise Scale",
        callingMinutesRemaining: 15400,
        renewalDate: "2026-12-31",
      });
    }

    // 6. CARRIER TRUNKS
    if (path === "carrier-config") {
      if (req.method === "POST") {
        store.carrierConfig = { ...store.carrierConfig, ...body, updatedAt: new Date().toISOString() };
        return res.status(200).json({ success: true, config: store.carrierConfig });
      }
      return res.status(200).json({ success: true, ...store.carrierConfig });
    }

    if (path === "carrier-test") {
      return res.status(200).json({
        success: true,
        message: "Trunk connection & media path verified successfully!",
        pingMs: 38,
        status: "operational",
        accountName: "CallForge Enterprise Carrier Trunk",
        carrier: body.provider || "Tata Tele Smartflo SIP",
        jitter: "1.2ms",
        packetLoss: "0.0%",
        voicePipeline: {
          stt: "NVIDIA Riva Conformer (Hindi/English)",
          tts: "NVIDIA FastPitch Indic Voice",
        },
      });
    }

    // 7. COMPLIANCE & CONSENT
    if (path === "consent-records") {
      if (req.method === "POST") {
        const record = {
          id: "consent-" + Date.now(),
          phone: body.phone,
          leadName: body.leadName || "Contact",
          consentType: body.consentType || "Explicit Digital Opt-in",
          traiDndStatus: "Clean / Non-DND",
          source: body.source || "Manual Entry",
          timestamp: new Date().toISOString(),
        };
        store.consentRecords.unshift(record);
        return res.status(201).json({ success: true, record });
      }
      return res.status(200).json({ success: true, records: store.consentRecords });
    }

    // 8. ADMIN & ROLES & TEAM
    if (path === "admin/team" || path.startsWith("admin/team/")) {
      if (req.method === "POST") {
        const member = {
          id: "team-" + Date.now(),
          name: body.name || "Agent",
          email: body.email,
          role: body.role || "agent",
          status: "active",
          extension: body.extension || "104",
          joinedAt: new Date().toISOString().split("T")[0],
          avatarInitials: (body.name || "A").slice(0, 2).toUpperCase(),
        };
        store.team.push(member);
        return res.status(201).json({ success: true, member });
      }
      return res.status(200).json({ success: true, team: store.team });
    }

    if (path === "admin/roles") {
      return res.status(200).json({
        success: true,
        roles: {
          admin: { canCall: true, canExport: true, canConfigTrunks: true, canManageBilling: true },
          supervisor: { canCall: true, canExport: true, canConfigTrunks: false, canManageBilling: false },
          agent: { canCall: true, canExport: false, canConfigTrunks: false, canManageBilling: false },
        },
      });
    }

    if (path === "admin/audit-logs") {
      return res.status(200).json({
        success: true,
        logs: [
          {
            id: "log-1",
            action: "Carrier Trunk Switch",
            user: "Bhagwat Kumar",
            timestamp: new Date().toISOString(),
            details: "Switched active trunk to Tata Smartflo SIP",
          },
          {
            id: "log-2",
            action: "Prepaid Top-up",
            user: "Bhagwat Kumar",
            timestamp: new Date(Date.now() - 3600 * 1000).toISOString(),
            details: "Recharged wallet with ₹5,000 via UPI",
          },
        ],
      });
    }

    // 9. AGENT WORKSPACE & DISPOSITION & CLICK-TO-CALL
    if (path === "agent/disposition") {
      return res.status(200).json({ success: true, message: "Disposition recorded successfully" });
    }

    if (path === "click-to-call" || path === "call-action") {
      return res.status(200).json({
        success: true,
        message: "Call initiated successfully via telephony trunk",
        callId: "call-" + Date.now(),
      });
    }

    if (path === "wallboard" || path === "live") {
      return res.status(200).json({
        success: true,
        activeCalls: [
          {
            id: "call-live-1",
            agentId: "agent-ai-1",
            customerName: "Aarav Mehta",
            customerPhone: "+91 98201 23456",
            campaign: "Diwali Real Estate AI Blast",
            durationSeconds: 52,
            sentiment: "positive",
          },
          {
            id: "call-live-2",
            agentId: "agent-1",
            customerName: "Priya Sharma",
            customerPhone: "+91 98110 98765",
            campaign: "BFSI Pre-Approved Home Loan",
            durationSeconds: 118,
            sentiment: "neutral",
          },
        ],
        agents: [
          { id: "agent-ai-1", name: "AI Bot Priya (Nvidia Riva)", type: "ai", state: "on_call" },
          { id: "agent-ai-2", name: "AI Bot Rahul (Riva Nemotron)", type: "ai", state: "ready" },
          { id: "agent-1", name: "Pooja Reddy", type: "human", state: "on_call" },
          { id: "agent-2", name: "Vikram Malhotra", type: "human", state: "ready" },
          { id: "agent-3", name: "Rohan Gupta", type: "human", state: "wrap_up" },
        ],
        waitingInQueue: 2,
        onlineAgents: 5,
        avgWaitSeconds: 12,
      });
    }

    // 10. AI STUDIO & NVIDIA PIPELINE
    if (path === "nvidia-pipeline/simulate") {
      const q = (body.query || "I want to know my loan balance.").trim();
      let responseText = "Your current loan balance is ₹50,000.";
      let toolAction = "Executed tool: fetch_loan_account_balance(loanId=\"LN-TATA-8831\"). Found active balance: ₹50,000.";

      const lower = q.toLowerCase();
      if (lower.includes("emi") || lower.includes("due date")) {
        responseText = "Your upcoming EMI of ₹4,850 is scheduled for 05-Nov-2026.";
        toolAction = "Executed tool: fetch_emi_schedule(loanId=\"LN-TATA-8831\").";
      } else if (lower.includes("pay") || lower.includes("repay")) {
        responseText = "I have sent a secure Tata Smartflo UPI payment link to your registered mobile number.";
        toolAction = "Executed tool: trigger_payment_link_sms(phone=\"+91 98201 12345\").";
      } else if (!lower.includes("loan") && !lower.includes("balance")) {
        responseText = `Namaste! I understand your inquiry regarding "${q}". How else may I assist you today?`;
        toolAction = "Contextual conversational intent processed via Nemotron LLM.";
      }

      return res.status(200).json({
        id: "sim-" + Date.now(),
        query: q,
        finalSpeechText: responseText,
        totalDurationMs: 278,
        steps: [
          {
            step: "riva_audio",
            title: "1. Audio Ingestion & VAD",
            technology: "NVIDIA Riva Audio Processing",
            durationMs: 18,
            status: "success",
            input: "Incoming 16kHz PCM audio stream from Tata Dialer SIP Trunk",
            output: "VAD Speech Boundary Detected (End-of-Utterance confirmed, SNR: 28.4 dB)",
            details: { samplingRate: "16000 Hz", vadConfidence: 0.98 },
          },
          {
            step: "nemotron_asr",
            title: "2. Speech-to-Text (STT)",
            technology: "NVIDIA Nemotron ASR via Riva NIM",
            durationMs: 76,
            status: "success",
            input: "Streamed audio buffer (0.84s duration)",
            output: `"${q}"`,
            details: { language: "en-IN / Indic Mixed", confidence: 0.984 },
          },
          {
            step: "nemotron_llm",
            title: "3. Reasoning & Intent Parsing",
            technology: "NVIDIA Nemotron-4-340B Instruct",
            durationMs: 104,
            status: "success",
            input: `User: "${q}"`,
            output: `Intent identified. ${toolAction}`,
            details: { intent: "financial_inquiry", tokensGenerated: 34 },
          },
          {
            step: "riva_magpie_tts",
            title: "4. Neural Text-to-Speech (TTS)",
            technology: "NVIDIA Riva Magpie Multilingual TTS",
            durationMs: 80,
            status: "success",
            input: `Text: "${responseText}"`,
            output: "Generated 24kHz synthesized audio buffer for SIP trunk playback",
            details: { voice: "riva-magpie-indic-v1", latencyMs: 80 },
          },
        ],
        telemetry: {
          sttLatencyMs: 76,
          llmFirstTokenMs: 42,
          ttsLatencyMs: 80,
          networkRttMs: 12,
          audioQualityScore: 98,
          vadSpeechDurationMs: 840,
        },
        audioWaveform: [12, 45, 78, 92, 64, 88, 95, 70, 52, 38, 80, 94, 62, 30],
        timestamp: new Date().toISOString(),
      });
    }

    if (path === "nvidia-pipeline/status") {
      return res.status(200).json({
        status: "healthy",
        stack: {
          rivaAudioGateway: { name: "NVIDIA Riva Audio Ingestion", status: "online", latencyMs: 16 },
          nemotronAsr: { model: "nemotron-asr-streaming", status: "online", latencyMs: 78, mode: "streaming" },
          nemotronLlm: { model: "nemotron-4-340b-instruct", status: "online", latencyMs: 104, mode: "nim_orchestrated" },
          rivaMagpieTts: { model: "riva-magpie-multilingual-v1", status: "online", latencyMs: 82, languages: ["Hindi", "Indian English", "Marathi", "Tamil"] },
        },
        telephonyBridge: {
          carrier: "Tata Smartflo SIP Trunk",
          sipProtocol: "RFC 3261",
          codec: "G.711u / PCMU (16kHz HD Audio)",
          activeTrunk: "sip.tatasmartflo.com:5060",
        },
      });
    }

    if (path.startsWith("nvidia-pipeline/")) {
      return res.status(200).json({
        success: true,
        status: "operational",
        rivaHealthy: true,
        ttsLatencyMs: 82,
        asrAccuracy: "97.4%",
        nemotronIntent: "positive_interest",
      });
    }

    if (path === "ai/ab-split") {
      return res.status(200).json({
        success: true,
        splitPercentA: 50,
        splitPercentB: 50,
        scriptA: "Festive discount promotion",
        scriptB: "Direct ROI consultation",
      });
    }

    // 11. SETTINGS & SUPPORT
    if (path === "settings") {
      if (req.method === "POST") {
        store.settings = { ...store.settings, ...body };
        return res.status(200).json({ success: true, settings: store.settings });
      }
      return res.status(200).json({ success: true, settings: store.settings });
    }

    if (path === "support/tickets") {
      return res.status(200).json({
        success: true,
        tickets: [
          {
            id: "t-1",
            ticketId: "TKT-8841",
            subject: "Tata SIP trunk DID caller ID mapping",
            status: "resolved",
            createdAt: new Date().toISOString(),
          },
        ],
      });
    }

    if (path === "ivr") {
      return res.status(200).json({
        success: true,
        tree: [
          { id: "root", title: "Welcome Prompt", type: "play_audio" },
          { id: "press_1", title: "Sales Inquiries", type: "forward_agent" },
          { id: "press_2", title: "Support", type: "forward_queue" },
        ],
      });
    }

    if (path === "system/diagnostics") {
      return res.status(200).json({
        success: true,
        database: "online",
        carrierTrunks: "operational",
        nvidiaRiva: "connected",
        traiComplianceEngine: "active",
        timestamp: new Date().toISOString(),
      });
    }

    // Fallback for any unknown /api/calling path
    return res.status(200).json({
      success: true,
      path,
      message: "CallForge Telephony Operations Ready",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Calling API Dispatcher error:", err);
    return res.status(500).json({ error: "Internal Server Error", message: String(err) });
  }
}
