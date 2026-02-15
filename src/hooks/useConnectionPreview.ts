import { useConnection } from "../providers/ConnectionProvider";

export function useConnectionPreview() {
  try {
    const connection = useConnection();
    return {
      currentConnection: connection.currentConnection,
      isConnecting: connection.currentConnection !== null,
    };
  } catch {
    return {
      currentConnection: null,
      isConnecting: false,
    };
  }
}

