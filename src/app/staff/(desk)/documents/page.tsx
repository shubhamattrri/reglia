"use client";

import { KycUploader } from "@/components/kyc/kyc-uploader";
import { useStaffDesk } from "@/components/staff/desk-shell";

export default function StaffDocumentsPage() {
  const { loadMe } = useStaffDesk();
  return (
    <div className="max-w-3xl">
      <KycUploader
        endpoint="/api/staff/documents"
        canDelete={false}
        onSummary={() => void loadMe()}
        intro="Administrators verify every staff member before sensitive member work. Upload a government photo ID and one supporting document (PDF, JPG or PNG, max 5 MB each)."
      />
    </div>
  );
}
