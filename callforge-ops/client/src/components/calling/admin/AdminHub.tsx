import React from "react";
import { ShieldCheck, Users, Radio, Activity, Key } from "lucide-react";
import { TeamManagementUI } from "./TeamManagementUI";
import { RoleManagementUI } from "./RoleManagementUI";
import { CarrierConfigCard } from "./CarrierConfigCard";
import { SystemStatusPage } from "./SystemStatusPage";
import { AuditLogsUI } from "./AuditLogsUI";

export const AdminHub: React.FC = () => {
  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div>
        <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-400">
          ENTERPRISE GOVERNANCE & ACCESS
        </p>
        <h2 className="text-xl font-bold text-zinc-100">Platform Administration & Operator Control</h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          Manage operator teams, role matrices, carrier SIP gateways, WebRTC network health and audit trails
        </p>
      </div>

      {/* 1. Team & Calling Operator Management */}
      <TeamManagementUI />

      {/* 2. Role-Based Access Control (RBAC) */}
      <RoleManagementUI />

      {/* 3. Carrier GSM Trunk Gateway */}
      <CarrierConfigCard />

      {/* 4. Live WebRTC Health & Diagnostics */}
      <SystemStatusPage />

      {/* 5. Security & Activity Audit Trail */}
      <AuditLogsUI />
    </div>
  );
};
