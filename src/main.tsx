import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import { AuthGate } from "@/components/AuthGate.tsx"
import { AuthProvider } from "@/contexts/AuthContext.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { TooltipProvider } from "@/components/ui/tooltip"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="light">
      <TooltipProvider>
        <AuthProvider>
          <AuthGate />
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>
)
