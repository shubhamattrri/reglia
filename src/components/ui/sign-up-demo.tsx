import { AuthComponent } from "@/components/ui/sign-up";
import { Layers } from "lucide-react";

const CustomLogo = () => (
  <div className="bg-blue-500 text-white rounded-md p-1.5">
    <Layers className="h-4 w-4" />
  </div>
);

export default function CustomAuthDemo() {
  return <AuthComponent logo={<CustomLogo />} brandName="MyWebApp" />;
}
