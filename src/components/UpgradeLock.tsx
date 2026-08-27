import React from "react";
import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UpgradeLockProps {
  message?: string;
}

const UpgradeLock: React.FC<UpgradeLockProps> = ({
  message = "This feature is available on Premium and Platinum plans.",
}) => {
  const navigate = useNavigate();

  return (
    <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-3 flex items-center justify-between gap-3">
      <div className="flex items-start gap-2 text-sm text-gray-500">
        <Lock className="h-4 w-4 mt-0.5 shrink-0 text-mediblue-500" />
        <span>{message}</span>
      </div>
      <Button size="sm" variant="outline" className="shrink-0" onClick={() => navigate("/plan")}>
        Upgrade
      </Button>
    </div>
  );
};

export default UpgradeLock;
