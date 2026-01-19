/**
 * UpdatePrompt component for displaying PWA update notifications
 *
 * A basic, unstyled component that shows when a service worker update
 * is available. Users should style this component according to their
 * application's design system.
 *
 * @module next-pwa-turbo/react
 */

import { useCallback, type JSX } from "react";
import { usePWA } from "../index.js";

/**
 * Props for the UpdatePrompt component
 */
export interface UpdatePromptProps {
  /** Callback fired when user clicks the update button */
  onUpdate?: () => void;
  /** Callback fired when user dismisses the prompt */
  onDismiss?: () => void;
  /** Custom message to display (default: "A new version is available!") */
  message?: string;
  /** Text for the update button (default: "Update") */
  updateText?: string;
  /** Text for the dismiss button (default: "Later") */
  dismissText?: string;
  /** Additional CSS class name for the container */
  className?: string;
}

/**
 * A basic, unstyled update prompt component.
 *
 * Shows when a service worker update is available and provides
 * buttons to update immediately or dismiss the prompt.
 *
 * The component is intentionally unstyled - wrap it or use the className
 * prop to apply your own styles.
 *
 * @example
 * ```tsx
 * import { UpdatePrompt } from 'next-pwa-turbo/react';
 *
 * function App() {
 *   return (
 *     <div>
 *       <UpdatePrompt
 *         message="New version available!"
 *         updateText="Refresh"
 *         dismissText="Not now"
 *         onUpdate={() => console.log('User chose to update')}
 *         onDismiss={() => console.log('User dismissed update')}
 *         className="my-update-prompt"
 *       />
 *       {/* rest of your app *\/}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```css
 * // Example styles (not included by default)
 * .update-prompt {
 *   position: fixed;
 *   bottom: 1rem;
 *   right: 1rem;
 *   padding: 1rem;
 *   background: #333;
 *   color: white;
 *   border-radius: 8px;
 *   display: flex;
 *   align-items: center;
 *   gap: 1rem;
 *   box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
 * }
 * ```
 */
export function UpdatePrompt({
  onUpdate,
  onDismiss,
  message = "A new version is available!",
  updateText = "Update",
  dismissText = "Later",
  className,
}: UpdatePromptProps): JSX.Element | null {
  const [state, actions] = usePWA();

  const handleUpdate = useCallback(() => {
    // Call skipWaiting to activate the new service worker
    actions.skipWaiting();

    // Call user's callback if provided
    onUpdate?.();

    // Reload to get the new version
    // Small delay to allow the new SW to take control
    setTimeout(() => {
      window.location.reload();
    }, 100);
  }, [actions, onUpdate]);

  const handleDismiss = useCallback(() => {
    onDismiss?.();
  }, [onDismiss]);

  // Only render when an update is available
  if (!state.isUpdateAvailable) {
    return null;
  }

  return (
    <div
      className={className}
      role="alert"
      aria-live="polite"
      data-testid="pwa-update-prompt"
    >
      <span data-testid="pwa-update-message">{message}</span>
      <div>
        <button
          type="button"
          onClick={handleUpdate}
          data-testid="pwa-update-button"
        >
          {updateText}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          data-testid="pwa-dismiss-button"
        >
          {dismissText}
        </button>
      </div>
    </div>
  );
}
