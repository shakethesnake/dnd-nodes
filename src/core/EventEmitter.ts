
export class EventEmitter {
    private events: Map<string, typeof Function[]> = new Map();

    on(event: string, listener: typeof Function) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event)!.push(listener);
    }

    off(event: string, listener: typeof Function) {
        if (!this.events.has(event)) return;
        const listeners = this.events.get(event)!.filter(l => l !== listener);
        this.events.set(event, listeners);
    }

    emit(event: string) {
        if (this.events.has(event)) {
            this.events.get(event)!.forEach((listener: typeof Function) => listener());
        }
    }
}