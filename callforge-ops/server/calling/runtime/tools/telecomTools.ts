import { ToolDefinition } from "../types";
import { persistentStore } from "../../../storage/persistentStore";

export const BUILTIN_TELECOM_TOOLS: ToolDefinition[] = [
  {
    name: "send_plan_details",
    description: "Sends the detailed 5G promotional plan brochure and payment link to the customer via WhatsApp or SMS.",
    parameters: {
      type: "object",
      properties: {
        channel: {
          type: "string",
          enum: ["whatsapp", "sms"],
          description: "Delivery channel preferred by the customer (WhatsApp or SMS)",
        },
        phoneNumber: {
          type: "string",
          description: "Customer phone number to send details to",
        },
        planName: {
          type: "string",
          description: "Name of the promotional plan (e.g., 'SwiftTel 5G Annual Plan ₹1,999')",
        },
      },
      required: ["channel"],
    },
    execute: async (args: Record<string, any>) => {
      const channel = args.channel || "whatsapp";
      const plan = args.planName || "SwiftTel 5G Annual Plan (₹1,999 - 2.5GB/day + OTT)";
      const phone = args.phoneNumber || "+91 98201 55432";

      // Log dispatch action
      persistentStore.addAuditLog(
        "Plan Details Dispatched",
        "SwiftTel AI Agent",
        `Sent ${plan} details via ${channel.toUpperCase()} to ${phone}`
      );

      return {
        success: true,
        channel,
        plan,
        deliveredTo: phone,
        message: `Plan details and exclusive checkout link successfully sent via ${channel.toUpperCase()}!`,
      };
    },
  },
  {
    name: "confirm_plan_activation",
    description: "Confirms customer agreement to activate the promotional 5G plan and creates an activation request.",
    parameters: {
      type: "object",
      properties: {
        customerName: {
          type: "string",
          description: "Customer full name",
        },
        customerPhone: {
          type: "string",
          description: "Customer 10-digit mobile number",
        },
        planId: {
          type: "string",
          description: "Plan code, e.g. 'swifttel_annual_1999'",
        },
        deliveryMode: {
          type: "string",
          enum: ["whatsapp", "sms"],
          description: "Channel to send invoice and SIM/eSIM activation steps",
        },
      },
      required: ["customerPhone"],
    },
    execute: async (args: Record<string, any>) => {
      const name = args.customerName || "Customer";
      const phone = args.customerPhone || "+91 98201 55432";
      const plan = args.planId || "SwiftTel 5G Annual ₹1,999";
      const delivery = args.deliveryMode || "whatsapp";

      persistentStore.addAuditLog(
        "Plan Activation Requested",
        "SwiftTel AI Agent",
        `Plan activation initiated for ${name} (${phone}) - Plan: ${plan}`
      );

      return {
        success: true,
        orderId: `ORD_${Date.now().toString().slice(-6)}`,
        customerName: name,
        customerPhone: phone,
        plan,
        activationStatus: "Order Placed",
        message: `Order confirmed for ${plan}. Activation details sent to ${delivery.toUpperCase()}.`,
      };
    },
  },
  {
    name: "check_5g_coverage",
    description: "Checks whether 5G high-speed network coverage is active in the customer's city or area.",
    parameters: {
      type: "object",
      properties: {
        cityOrPincode: {
          type: "string",
          description: "City name or 6-digit postal pincode",
        },
      },
      required: ["cityOrPincode"],
    },
    execute: async (args: Record<string, any>) => {
      const location = (args.cityOrPincode || "Mumbai").trim();
      return {
        success: true,
        location,
        has5GCoverage: true,
        speedMbps: 850,
        networkBand: "n78 (3500 MHz) True 5G SA",
        message: `Excellent news! SwiftTel True 5G SA is live in ${location} with peak speeds up to 850 Mbps.`,
      };
    },
  },
];
