import { useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { configureAuth } from "@/lib/api";

export default function ApiAuthBinder() {
  const { getToken, isLoaded } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;
    configureAuth(() => getToken());
  }, [getToken, isLoaded]);

  return null;
}
