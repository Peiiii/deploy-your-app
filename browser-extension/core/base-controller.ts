/**
 * Base Extension Controller
 * 
 * Provides a generic foundation for handling RPC messages and dispatching events.
 * 
 * @template H - Type of Handlers (RPC methods provided by this controller)
 * @template E - Type of Events (Events capable of being sent by this controller)
 */
export abstract class BaseExtensionController<H extends Record<string, any>, E = void> {
    protected handlers: H = {} as H;

    /**
     * Registers handlers implementation.
     */
    public provideHandlers = (handlers: H) => {
        this.handlers = { ...this.handlers, ...handlers };
    };

    /**
     * Processes an incoming RPC message using registered handlers.
     * Returns true if the message was handled (and kept open for async), false otherwise.
     */
    protected handleMessage = (
        message: any,
        sender: chrome.runtime.MessageSender,
        sendResponse: (res: any) => void
    ): boolean => {
        const handler = this.handlers[message.type];

        if (handler) {
            this.dispatchToHandler(handler, message, sender, sendResponse);
            return true;
        }
        return false;
    };

    /**
     * Sends an event notification to the extension system.
     * Type-safe wrapper for chrome.runtime.sendMessage.
     */
    protected sendEvent<K extends keyof E>(
        type: K,
        args: E[K] extends (...args: any[]) => any ? Parameters<E[K]> : any[]
    ) {
        // ... implementation
        this.sendEventImpl(type as string, args);
    }

    private sendEventImpl = async (type: string, payload: any[]) => {
        try {
            await chrome.runtime.sendMessage({
                type,
                payload,
            });
        } catch (e) {
            console.debug('[GemiGo] Failed to send event:', e);
        }
    };


    /**
     * Internal dispatch logic handling both sync and async results.
     */
    private dispatchToHandler = async (
        handler: (...args: any[]) => any,
        message: any,
        sender: chrome.runtime.MessageSender,
        sendResponse: (res: any) => void
    ) => {
        try {
            const args = Array.isArray(message.payload) ? message.payload : [];
            const result = handler(...args, sender);

            if (result instanceof Promise) {
                const resolvedValue = await result;
                sendResponse(resolvedValue);
            } else {
                sendResponse(result);
            }
        } catch (e) {
            console.error(`[GemiGo] Handler error [${message.type}]:`, e);
            sendResponse({ success: false, error: String(e) });
        }
    };
}
