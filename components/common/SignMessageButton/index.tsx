import { Button } from "@/components/ui/button";
import { useSignMessage } from "wagmi";

export default function SignMessageButton() {
  const { signMessage } = useSignMessage();

  const handleSign = () => {
    signMessage({ message: "Hello, Web3!" });
  };

  return (
    <Button
      onClick={handleSign}
      className="bg-white text-black hover:text-white"
    >
      Sign Message
    </Button>
  );
}
