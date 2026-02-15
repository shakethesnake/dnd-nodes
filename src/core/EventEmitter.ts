type EventKey<TEvents extends object> = Extract<keyof TEvents, string>;
type Listener<TEvents extends object, K extends EventKey<TEvents>> = (payload: TEvents[K]) => void;
type WildcardListener<TEvents extends object> = (event: EventKey<TEvents>, payload: TEvents[EventKey<TEvents>]) => void;

export class EventEmitter<TEvents extends object = Record<string, unknown>> {
    private listeners = new Map<string, Set<Function>>();

    private addListener(event: string, listener: Function): void {
        const bucket = this.listeners.get(event) ?? new Set<Function>();
        bucket.add(listener);
        this.listeners.set(event, bucket);
    }

    private offInternal(event: string, listener: Function): void {
        const bucket = this.listeners.get(event);
        if (!bucket) return;
        bucket.delete(listener);
        if (bucket.size === 0) {
            this.listeners.delete(event);
        }
    }

    on<K extends EventKey<TEvents>>(event: K, listener: Listener<TEvents, K>): () => void;
    on(event: "*", listener: WildcardListener<TEvents>): () => void;
    on(event: string, listener: Function): () => void {
        this.addListener(event, listener);
        return () => this.offInternal(event, listener);
    }

    once<K extends EventKey<TEvents>>(event: K, listener: Listener<TEvents, K>): () => void;
    once(event: "*", listener: WildcardListener<TEvents>): () => void;
    once(event: string, listener: Function): () => void {
        const wrapped = (...args: unknown[]) => {
            this.offInternal(event, wrapped);
            listener(...args);
        };
        this.addListener(event, wrapped);
        return () => this.offInternal(event, wrapped);
    }

    off<K extends EventKey<TEvents>>(event: K, listener: Listener<TEvents, K>): void;
    off(event: "*", listener: WildcardListener<TEvents>): void;
    off(event: string, listener: Function): void {
        this.offInternal(event, listener);
    }

    emit<K extends EventKey<TEvents>>(event: K, payload: TEvents[K]): void {
        const bucket = this.listeners.get(event);
        if (bucket) {
            bucket.forEach((listener) => {
                (listener as Listener<TEvents, K>)(payload);
            });
        }

        const wildcardBucket = this.listeners.get("*");
        if (wildcardBucket) {
            wildcardBucket.forEach((listener) => {
                (listener as WildcardListener<TEvents>)(event, payload as TEvents[EventKey<TEvents>]);
            });
        }
    }
}
