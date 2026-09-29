import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import { CheckCircle2, CircleAlert, X } from 'lucide-react'
import { Button } from './Button'

type SnackbarKind = 'success' | 'error'

interface SnackbarMessage {
  kind: SnackbarKind
  text: string
}

interface SnackbarContextValue {
  showSuccess: (message: string) => void
  showError: (message: string) => void
}

const fallbackSnackbar: SnackbarContextValue = {
  showSuccess: () => undefined,
  showError: () => undefined,
}
const SnackbarContext = createContext<SnackbarContextValue>(fallbackSnackbar)

export function SnackbarProvider({ children }: PropsWithChildren) {
  const [message, setMessage] = useState<SnackbarMessage | null>(null)
  const value = useMemo<SnackbarContextValue>(
    () => ({
      showSuccess: (text) => setMessage({ kind: 'success', text }),
      showError: (text) => setMessage({ kind: 'error', text }),
    }),
    [],
  )

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      {message && (
        <div className="pointer-events-none fixed inset-x-4 bottom-5 z-60 flex justify-center sm:left-auto sm:right-6 sm:justify-end">
          <div
            role={message.kind === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex max-w-sm items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-[0_18px_40px_-24px_rgba(54,41,31,0.5)] ${
              message.kind === 'error'
                ? 'border-[#efc6bd] bg-[#fff3f0] text-[#8d4c43]'
                : 'border-[#d8e4c7] bg-[#f5faed] text-[#4f6b38]'
            }`}
          >
            {message.kind === 'error' ? (
              <CircleAlert aria-hidden="true" size={19} />
            ) : (
              <CheckCircle2 aria-hidden="true" size={19} />
            )}
            <span>{message.text}</span>
            <Button
              aria-label="Dismiss notification"
              className="-mr-2 h-8 w-8 px-0 py-0"
              variant="ghost"
              onClick={() => setMessage(null)}
            >
              <X aria-hidden="true" size={16} />
            </Button>
          </div>
        </div>
      )}
    </SnackbarContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSnackbar(): SnackbarContextValue {
  return useContext(SnackbarContext)
}
