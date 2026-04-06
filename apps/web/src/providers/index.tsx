import type { ReactNode } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { FirebaseAuthProvider } from "./FirebaseAuthProvider"

export const Providers = ({ children }: { children: ReactNode }) => {
  return (
    <TooltipProvider>
      <FirebaseAuthProvider>
        {children}
      </FirebaseAuthProvider>
    </TooltipProvider>
  )
}